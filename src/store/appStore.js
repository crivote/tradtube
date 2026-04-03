/**
 * store/appStore.js
 * Estado global de la app via SolidJS signals
 */

import { createSignal, createEffect } from 'solid-js';
import { initDB, searchTunes, searchTunesByType, getTuneById } from '../lib/db';
import { getEntriesForTune, getVideoCountsByTune, onAuthChange } from '../lib/supabase';
import { SEARCH_LIMIT } from '../constants';

// ── DB ──────────────────────────────────────────────────────────────────────
const [dbReady, setDbReady] = createSignal(false);
const [videoCountsByTune, setVideoCountsByTune] = createSignal(new Map());
const [videoThumbnailsByTune, setVideoThumbnailsByTune] = createSignal(new Map());
const [videoDataReady, setVideoDataReady] = createSignal(false);

// ── Auth ────────────────────────────────────────────────────────────────────
const [currentUser, setCurrentUser] = createSignal(null);

// ── Búsqueda ────────────────────────────────────────────────────────────────
const [searchQuery, setSearchQuery] = createSignal('');
const [searchResults, setSearchResults] = createSignal([]);
const [filterType, setFilterType] = createSignal(null);

// ── Tune seleccionado ───────────────────────────────────────────────────────
const [selectedTune, setSelectedTune] = createSignal(null);
const [tuneEntries, setTuneEntries] = createSignal([]);
const [loadingEntries, setLoadingEntries] = createSignal(false);

// ── Vídeo activo en el reproductor ──────────────────────────────────────────
const [activeEntry, setActiveEntry] = createSignal(null);

// ── Formulario de aportación ─────────────────────────────────────────────────
const [showAddForm, setShowAddForm] = createSignal(false);
const [addFormInitialTune, setAddFormInitialTune] = createSignal(null);

export function useAppStore() {

  // Inicializar DB al montar la app
  const loadVideoData = () => {
    getVideoCountsByTune().then(({ counts, thumbnails }) => {
      setVideoCountsByTune(counts);
      setVideoThumbnailsByTune(thumbnails);
      setVideoDataReady(true);
    });
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

  // Buscar tunes cuando cambia el query (texto)
  createEffect(() => {
    const q = searchQuery();
    if (!dbReady() || q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setFilterType(null);
    const results = searchTunes(q, SEARCH_LIMIT);
    setSearchResults(results);
  });

  // Filtrar por tipo — solo tunes con vídeos
  createEffect(() => {
    const type = filterType();
    if (!type || !dbReady() || !videoDataReady()) return;
    const all = searchTunesByType(type, 500);
    const counts = videoCountsByTune();
    setSearchResults(all.filter(t => counts.has(t.tune_id)));
  });

  // Cargar entries cuando se selecciona un tune
  createEffect(async () => {
    const tune = selectedTune();
    if (!tune) { setTuneEntries([]); setActiveEntry(null); return; }

    setLoadingEntries(true);
    setTuneEntries([]);
    setActiveEntry(null);

    const entries = await getEntriesForTune(tune.tune_id);
    setTuneEntries(entries);

    // Autoplay del primero
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
    setTuneEntries(entries =>
      entries.map(e =>
        e.id === entryId ? { ...e, voteScore, userVote } : e
      )
    );
    const current = activeEntry();
    if (current?.id === entryId) {
      setActiveEntry({ ...current, voteScore, userVote });
    }
  };

  return {
    // Estado
    dbReady, currentUser,
    videoCountsByTune, videoThumbnailsByTune, videoDataReady,
    searchQuery, setSearchQuery,
    filterType, setFilterType,
    searchResults,
    selectedTune, tuneEntries, loadingEntries,
    activeEntry, setActiveEntry,
    showAddForm, setShowAddForm,
    addFormInitialTune, setAddFormInitialTune,
    // Acciones
    loadDB, initAuth, loadVideoData,
    loadTuneById, updateEntryVote,
    openAddFormForTune: (tune) => {
      setAddFormInitialTune(tune);
      setShowAddForm(true);
    },
  };
}
