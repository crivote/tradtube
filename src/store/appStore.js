/**
 * store/appStore.js
 * Estado global de la app via SolidJS signals
 */

import { createSignal, createEffect } from 'solid-js';
import { initDB, searchTunes, searchTunesByType, getTuneById, getRandomTunes, getCountsByType } from '../lib/db';
import { getEntriesForTune, getVideoCountsByTune, getTuneIdsByInstrument, onAuthChange } from '../lib/supabase';
import { SEARCH_LIMIT, INSTRUMENT_KEYS } from '../constants';

// ── DB ──────────────────────────────────────────────────────────────────────
const [dbReady, setDbReady] = createSignal(false);
const [videoCountsByTune, setVideoCountsByTune] = createSignal(new Map());
const [videoThumbnailsByTune, setVideoThumbnailsByTune] = createSignal(new Map());
const [videoDataReady, setVideoDataReady] = createSignal(false);
const TUNE_TYPES = ['jig', 'reel', 'hornpipe', 'polka', 'slide', 'waltz', 'march', 'slip jig'];

const [placeholderExamples, setPlaceholderExamples] = createSignal([]);
const [typeCounts, setTypeCounts] = createSignal({});

// ── Auth ────────────────────────────────────────────────────────────────────
const [currentUser, setCurrentUser] = createSignal(null);

// ── Búsqueda ────────────────────────────────────────────────────────────────
const [searchQuery, setSearchQuery] = createSignal('');
const [searchResults, setSearchResults] = createSignal([]);
const [filterType, setFilterType] = createSignal(null);
const [filterInstrument, setFilterInstrument] = createSignal(null);

// ── Tune seleccionado ───────────────────────────────────────────────────────
const [selectedTune, setSelectedTune] = createSignal(null);
const [tuneEntries, setTuneEntries] = createSignal([]);
const [loadingEntries, setLoadingEntries] = createSignal(false);

// ── Vote state (separate to avoid re-rendering entries list) ─────────────────
const [voteScores, setVoteScores] = createSignal(new Map());
const [userVotes, setUserVotes] = createSignal(new Map());

// ── Vídeo activo en el reproductor ──────────────────────────────────────────
const [activeEntry, setActiveEntry] = createSignal(null);

// ── Formulario de aportación ─────────────────────────────────────────────────
const [showAddForm, setShowAddForm] = createSignal(false);
const [addFormInitialTune, setAddFormInitialTune] = createSignal(null);

export function useAppStore() {

  // Inicializar DB al montar la app
  const loadVideoData = async () => {
    const { counts, thumbnails } = await getVideoCountsByTune();
    setVideoCountsByTune(counts);
    setVideoThumbnailsByTune(thumbnails);
    setVideoDataReady(true);

    // Set placeholder examples only from tunes with videos
    const tunesWithVideos = Array.from(counts.keys());
    if (tunesWithVideos.length > 0) {
      const shuffled = tunesWithVideos.sort(() => Math.random() - 0.5);
      const sample = shuffled.slice(0, 2);
      const randomTunes = sample.map(id => getTuneById(id)).filter(Boolean);
      setPlaceholderExamples(randomTunes.map(t => t.name));
    }

    // Load type counts (tunes with videos)
    setTypeCounts(getCountsByType(TUNE_TYPES, counts));
  };

  const loadDB = async () => {
    await initDB();
    setDbReady(true);
    loadVideoData();
  };

  // Escuchar cambios de auth
  const initAuth = () => {
    const { data: { subscription } } = onAuthChange(setCurrentUser);
    return () => subscription.unsubscribe();
  };

  const tuneIdsByInstrument = new Map();

  const loadInstrumentFilter = async (instrument) => {
    if (tuneIdsByInstrument.has(instrument)) return tuneIdsByInstrument.get(instrument);
    const ids = await getTuneIdsByInstrument(instrument);
    tuneIdsByInstrument.set(instrument, ids);
    return ids;
  };

  // Buscar tunes cuando cambia el query (texto)
  createEffect(async () => {
    const q = searchQuery();
    const instrument = filterInstrument();
    if (!dbReady() || q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setFilterType(null);
    let results = searchTunes(q, SEARCH_LIMIT);
    if (instrument) {
      const ids = await loadInstrumentFilter(instrument);
      results = results.filter(t => ids.has(t.tune_id));
    }
    setSearchResults(results);
  });

  // Filtrar por tipo — solo tunes con vídeos
  createEffect(async () => {
    const type = filterType();
    const instrument = filterInstrument();
    if (!type || !dbReady() || !videoDataReady()) return;
    let all = searchTunesByType(type, 500);
    const counts = videoCountsByTune();
    all = all.filter(t => counts.has(t.tune_id));
    if (instrument) {
      const ids = await loadInstrumentFilter(instrument);
      all = all.filter(t => ids.has(t.tune_id));
    }
    setSearchResults(all);
  });

  // Filtrar solo por instrumento (sin tipo)
  createEffect(async () => {
    const type = filterType();
    const instrument = filterInstrument();
    if (type || !instrument || !dbReady() || !videoDataReady()) return;
    const ids = await loadInstrumentFilter(instrument);
    const counts = videoCountsByTune();
    const all = Array.from(ids).map(id => getTuneById(id)).filter(Boolean);
    setSearchResults(all.filter(t => counts.has(t.tune_id)));
  });

  // Cargar entries cuando se selecciona un tune
  createEffect(async () => {
    const tune = selectedTune();
    if (!tune) { setTuneEntries([]); setActiveEntry(null); return; }

    setLoadingEntries(true);
    setTuneEntries([]);
    setActiveEntry(null);
    setVoteScores(new Map());
    setUserVotes(new Map());

    const entries = await getEntriesForTune(tune.tune_id);
    
    const scores = new Map();
    const votes = new Map();
    for (const e of entries) {
      scores.set(e.id, e.voteScore);
      votes.set(e.id, e.userVote);
    }
    setVoteScores(scores);
    setUserVotes(votes);
    
    setTuneEntries(entries);

    if (entries.length > 0) setActiveEntry(entries[0]);

    setLoadingEntries(false);
  });

  // Carga un tune por ID desde SQLite y lo establece como seleccionado.
  // Llamado por TuneView al montar o cuando cambia el param de URL.
  const loadTuneById = (tuneId) => {
    const id = parseInt(tuneId, 10);
    if (!dbReady() || !id) return;
    const tune = getTuneById(id);
    if (tune) setSelectedTune(tune);
  };

  const updateEntryVote = (entryId, voteScore, userVote) => {
    setVoteScores(scores => new Map(scores).set(entryId, voteScore));
    setUserVotes(votes => new Map(votes).set(entryId, userVote));
  };

  const getEntryVoteScore = (entryId, fallback) => {
    return voteScores().get(entryId) ?? fallback;
  };

  const getEntryUserVote = (entryId, fallback) => {
    return userVotes().get(entryId) ?? fallback;
  };

  return {
    // Estado
    dbReady, currentUser,
    videoCountsByTune, videoThumbnailsByTune, videoDataReady,
    placeholderExamples, typeCounts,
    searchQuery, setSearchQuery,
    filterType, setFilterType,
    filterInstrument, setFilterInstrument,
    searchResults,
    selectedTune, tuneEntries, loadingEntries,
    activeEntry, setActiveEntry,
    showAddForm, setShowAddForm,
    addFormInitialTune, setAddFormInitialTune,
    // Acciones
    loadDB, initAuth, loadVideoData,
    loadTuneById, updateEntryVote, getEntryVoteScore, getEntryUserVote,
    openAddFormForTune: (tune) => {
      setAddFormInitialTune(tune);
      setShowAddForm(true);
    },
  };
}
