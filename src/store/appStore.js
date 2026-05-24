/**
 * store/appStore.js
 * Estado global de la app via SolidJS signals
 */

import { createSignal, createEffect, onCleanup } from 'solid-js';
import { initDB, searchTunes, searchTunesByType, getTuneById, getRandomTunes, getCountsByType } from '../lib/db';
import { getEntriesForTune, getVideoCountsByTune, getTuneIdsByInstrument, getPendingCount, onAuthChange, getUserRole } from '../lib/supabase';
import { SEARCH_LIMIT, INSTRUMENT_KEYS } from '../constants';

// ── DB ──────────────────────────────────────────────────────────────────────
const [dbReady, setDbReady] = createSignal(false);
const [videoCountsByTune, setVideoCountsByTune] = createSignal(new Map());
const [videoThumbnailsByTune, setVideoThumbnailsByTune] = createSignal(new Map());
const [videoDataReady, setVideoDataReady] = createSignal(false);
const TUNE_TYPES = ['jig', 'reel', 'hornpipe', 'polka', 'slide', 'waltz', 'march', 'slip jig'];

const [placeholderExamples, setPlaceholderExamples] = createSignal([]);
const [typeCounts, setTypeCounts] = createSignal({});

// ── Toast ───────────────────────────────────────────────────────────────────
const [toasts, setToasts] = createSignal([]);
const dismissedIds = new Set();
let toastId = 0;

const showToast = (message, type = 'info', duration = 3000, action = null) => {
  const id = ++toastId;
  dismissedIds.delete(id);
  setToasts(prev => [...prev, { id, message, type, action }]);
  if (duration > 0) {
    setTimeout(() => {
      if (!dismissedIds.has(id)) {
        dismissToast(id);
        if (action?.onTimeout) action.onTimeout();
      }
    }, duration);
  }
};

const dismissToast = (id) => {
  dismissedIds.add(id);
  setToasts(prev => prev.filter(t => t.id !== id));
};

// ── Auth ────────────────────────────────────────────────────────────────────
const [authUser, setAuthUser] = createSignal(null);
const [authInitialized, setAuthInitialized] = createSignal(false);
const [loggingIn, setLoggingIn] = createSignal(false);
const [pendingReviewCount, setPendingReviewCount] = createSignal(null);

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

// ── Theme ────────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'tradtube-theme';
const savedTheme = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
const [theme, setTheme] = createSignal(savedTheme === 'light' ? 'light' : 'dark');

const applyTheme = (value) => {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = value;
  }
};

applyTheme(theme());

createEffect(() => {
  const value = theme();
  applyTheme(value);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, value);
  }
});

const tuneIdsByInstrument = new Map();

export function useAppStore() {

  const loadVideoData = async () => {
    try {
      const { counts, thumbnails } = await getVideoCountsByTune();
      setVideoCountsByTune(counts);
      setVideoThumbnailsByTune(thumbnails);
      setVideoDataReady(true);

      const tunesWithVideos = Array.from(counts.keys());
      if (tunesWithVideos.length > 0) {
        const shuffled = tunesWithVideos.sort(() => Math.random() - 0.5);
        const sample = shuffled.slice(0, 2);
        const randomTunes = sample.map(id => getTuneById(id)).filter(Boolean);
        setPlaceholderExamples(randomTunes.map(t => t.name));
      }

      setTypeCounts(getCountsByType(TUNE_TYPES, counts));
    } catch (err) {
      console.error('Failed to load video data:', err);
      showToast('Failed to load video data. Please reload.', 'error', 0);
    }
  };

  const loadDB = async () => {
    await initDB();
    setDbReady(true);
    loadVideoData();
  };

  // Escuchar cambios de auth
  const initAuth = () => {
    const { data: { subscription } } = onAuthChange(async (user) => {
      if (user) {
        getPendingCount().then(setPendingReviewCount).catch((err) => console.error('getPendingCount failed:', err));
        try {
          const role = await getUserRole(user.id);
          setAuthUser({ ...user, isAdmin: role === 'admin' });
        } catch (err) {
          console.error('getUserRole failed:', err);
          setAuthUser({ ...user, isAdmin: false });
        }
      } else {
        setPendingReviewCount(null);
        setAuthUser(null);
      }
      setAuthInitialized(true);
    });
    return () => subscription.unsubscribe();
  };

  const loadInstrumentFilter = async (instrument) => {
    if (tuneIdsByInstrument.has(instrument)) return tuneIdsByInstrument.get(instrument);
    const ids = await getTuneIdsByInstrument(instrument);
    tuneIdsByInstrument.set(instrument, ids);
    return ids;
  };

  // Buscar tunes cuando cambia el query (texto) — con debounce 300ms
  createEffect(() => {
    const q = searchQuery();
    const instrument = filterInstrument();
    const type = filterType();
    if (!dbReady()) {
      setSearchResults([]);
      return;
    }
    if (q.trim().length < 2) {
      // Only clear if no filter is active — dedicated effects handle type/instrument filtering
      if (!type && !instrument) setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        let results = searchTunes(q, SEARCH_LIMIT);
        if (type) {
          results = results.filter(t => t.type === type);
        }
        if (instrument) {
          const ids = await loadInstrumentFilter(instrument);
          results = results.filter(t => ids.has(t.tune_id));
        }
        setSearchResults(results);
      } catch (err) {
        console.error('Search effect error:', err);
        setSearchResults([]);
      }
    }, 300);
    onCleanup(() => clearTimeout(timer));
  });

  // Filtrar por tipo — solo tunes con vídeos (solo si no hay búsqueda de texto)
  createEffect(() => {
    const type = filterType();
    const instrument = filterInstrument();
    const q = searchQuery();
    if (!type || !dbReady() || !videoDataReady() || q.trim().length >= 2) { setSearchResults([]); return; }

    let cancelled = false;
    onCleanup(() => { cancelled = true; });

    (async () => {
      try {
        let all = searchTunesByType(type, 500);
        if (cancelled) return;
        const counts = videoCountsByTune();
        all = all.filter(t => counts.has(t.tune_id));
        if (instrument) {
          const ids = await loadInstrumentFilter(instrument);
          if (cancelled) return;
          all = all.filter(t => ids.has(t.tune_id));
        }
        if (!cancelled) setSearchResults(all);
      } catch (err) {
        console.error('Type filter effect error:', err);
        if (!cancelled) setSearchResults([]);
      }
    })();
  });

  // Filtrar solo por instrumento (sin tipo)
  createEffect(() => {
    const type = filterType();
    const instrument = filterInstrument();
    if (type || !instrument || !dbReady() || !videoDataReady()) { setSearchResults([]); return; }

    let cancelled = false;
    onCleanup(() => { cancelled = true; });

    (async () => {
      try {
        const ids = await loadInstrumentFilter(instrument);
        if (cancelled) return;
        const counts = videoCountsByTune();
        const all = Array.from(ids).map(id => getTuneById(id)).filter(Boolean);
        if (!cancelled) setSearchResults(all.filter(t => counts.has(t.tune_id)));
      } catch (err) {
        console.error('Instrument filter effect error:', err);
        if (!cancelled) setSearchResults([]);
      }
    })();
  });

  // Cargar entries cuando se selecciona un tune
  createEffect(() => {
    const tune = selectedTune();
    if (!tune) { setTuneEntries([]); setActiveEntry(null); return; }

    setLoadingEntries(true);
    setTuneEntries([]);
    setActiveEntry(null);
    setVoteScores(new Map());
    setUserVotes(new Map());

    let cancelled = false;
    onCleanup(() => { cancelled = true; });

    const load = async () => {
      try {
        const entries = await getEntriesForTune(tune.tune_id);
        if (cancelled) return;

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
      } catch (err) {
        if (cancelled) return;
        console.error('Tune entries effect error:', err);
        setTuneEntries([]);
      } finally {
        if (!cancelled) setLoadingEntries(false);
      }
    };

    load();
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
    dbReady,     authUser, loggingIn, setLoggingIn, pendingReviewCount, authInitialized,
    videoCountsByTune, videoThumbnailsByTune, videoDataReady,
    placeholderExamples, typeCounts,
    searchQuery, setSearchQuery,
    filterType, setFilterType,
    filterInstrument, setFilterInstrument,
    searchResults,
    selectedTune, setSelectedTune, tuneEntries, loadingEntries,
    activeEntry, setActiveEntry,
    showAddForm, setShowAddForm,
    addFormInitialTune, setAddFormInitialTune,
    theme, toggleTheme: () => setTheme(v => v === 'dark' ? 'light' : 'dark'),
    // Acciones
    loadDB, initAuth, loadVideoData,
    loadTuneById, updateEntryVote, getEntryVoteScore, getEntryUserVote,
    openAddFormForTune: (tune) => {
      setAddFormInitialTune(tune);
      setShowAddForm(true);
    },
    toasts, showToast, dismissToast,
  };
}
