/**
 * store/appStore.js
 * Estado global de la app via SolidJS signals
 */

import { createSignal, createEffect } from 'solid-js';
import { initDB, searchTunes } from '../lib/db';
import { getEntriesForTune, getVideoCountsByTune, onAuthChange } from '../lib/supabase';
import { SEARCH_LIMIT } from '../constants';

// ── DB ──────────────────────────────────────────────────────────────────────
const [dbReady, setDbReady] = createSignal(false);
const [videoCountsByTune, setVideoCountsByTune] = createSignal(new Map());
const [videoDataReady, setVideoDataReady] = createSignal(false);

// ── Auth ────────────────────────────────────────────────────────────────────
const [currentUser, setCurrentUser] = createSignal(null);

// ── Búsqueda ────────────────────────────────────────────────────────────────
const [searchQuery, setSearchQuery] = createSignal('');
const [searchResults, setSearchResults] = createSignal([]);

// ── Tune seleccionado ───────────────────────────────────────────────────────
const [selectedTune, setSelectedTune] = createSignal(null);
const [tuneEntries, setTuneEntries] = createSignal([]);
const [loadingEntries, setLoadingEntries] = createSignal(false);

// ── Vídeo activo en el reproductor ──────────────────────────────────────────
const [activeEntry, setActiveEntry] = createSignal(null);

// ── Formulario de aportación ─────────────────────────────────────────────────
const [showAddForm, setShowAddForm] = createSignal(false);

// ── Vista de administración ───────────────────────────────────────────────────
const [showAdminView, setShowAdminView] = createSignal(false);

export function useAppStore() {

  // Inicializar DB al montar la app
  const loadDB = async () => {
    await initDB();
    setDbReady(true);
    // Carga en paralelo los conteos de vídeos por tune (no bloquea la UI)
    getVideoCountsByTune().then(counts => {
      setVideoCountsByTune(counts);
      setVideoDataReady(true);
    });
  };

  // Escuchar cambios de auth
  const initAuth = () => {
    const { data: { subscription } } = onAuthChange(setCurrentUser);
    return () => subscription.unsubscribe();
  };

  // Buscar tunes cuando cambia el query
  createEffect(() => {
    const q = searchQuery();
    if (!dbReady() || q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const results = searchTunes(q, SEARCH_LIMIT);
    setSearchResults(results);
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

  const selectTune = (tune) => {
    setSelectedTune(tune);
    setSearchQuery('');
    setSearchResults([]);
  };

  const backToSearch = () => {
    setSelectedTune(null);
    setActiveEntry(null);
    setTuneEntries([]);
  };

  return {
    // Estado
    dbReady, currentUser,
    videoCountsByTune, videoDataReady,
    searchQuery, setSearchQuery,
    searchResults,
    selectedTune, tuneEntries, loadingEntries,
    activeEntry, setActiveEntry,
    showAddForm, setShowAddForm,
    showAdminView, setShowAdminView,
    // Acciones
    loadDB, initAuth,
    selectTune, backToSearch,
  };
}
