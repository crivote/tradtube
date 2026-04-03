/**
 * TuneView.jsx
 * Vista de detalle de una tune: reproductor + lista de entries con votos.
 */

import { Show, For, createEffect, createSignal, onCleanup } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { useAppStore } from '../store/appStore';
import { castVote, loginWithGoogle } from '../lib/supabase';
import { SOURCE_TYPES, INSTRUMENTS } from '../constants';
import YoutubePlayer from './YoutubePlayer';
import SheetMusic from './SheetMusic';
import SameTypeTunes from './SameTypeTunes';

function formatTime(sec) {
  if (sec == null) return null;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function TuneView() {
  const params = useParams();
  const navigate = useNavigate();
  const {
    dbReady,
    selectedTune, tuneEntries, loadingEntries,
    activeEntry, setActiveEntry,
    currentUser, loadTuneById, updateEntryVote,
  } = useAppStore();

  // Sync selectedTune from URL param — handles both in-app nav and direct links
  createEffect(() => {
    if (dbReady()) loadTuneById(params.tuneId);
  });

  const [showSheet, setShowSheet] = createSignal(true);
  const [splitPct, setSplitPct] = createSignal(25);

  let containerRef;
  let cleanupDrag = null;
  onCleanup(() => cleanupDrag?.());

  const startDrag = (e) => {
    e.preventDefault();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev) => {
      const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const rect = containerRef.getBoundingClientRect();
      const pct = (clientX - rect.left) / rect.width * 100;
      setSplitPct(Math.min(Math.max(pct, 10), 70));
    };
    const onUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      cleanupDrag = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    cleanupDrag = onUp;
  };

  const handleVideoEnd = () => {
    const entries = tuneEntries();
    const current = activeEntry();
    if (!current) return;
    const idx = entries.findIndex(e => e.id === current.id);
    if (idx !== -1 && idx < entries.length - 1) setActiveEntry(entries[idx + 1]);
  };

  const handleVote = async (e, entry, vote, isReport = false) => {
    e.stopPropagation();
    if (!currentUser()) { loginWithGoogle(); return; }
    
    const currentVote = entry.userVote || 0;
    const newUserVote = currentVote === vote ? 0 : vote;
    const scoreDelta = newUserVote - currentVote;
    const newScore = (entry.voteScore || 0) + scoreDelta;
    
    updateEntryVote(entry.id, newScore, newUserVote);
    
    try {
      await castVote(entry.id, vote, isReport);
    } catch (err) {
      updateEntryVote(entry.id, entry.voteScore, currentVote);
      console.error('[TradTube] vote error', err);
    }
  };

  return (
    <div class="flex flex-col gap-6">

      {/* Back */}
      <button
        onClick={() => navigate('/')}
        class="flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-white transition-colors w-fit"
      >
        ← Back to search
      </button>

      {/* Tune header */}
      <div class="flex items-start justify-between gap-4">
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2">
            <h2 class="text-2xl font-black text-white">{selectedTune()?.name}</h2>
            <a
              href={`https://thesession.org/tunes/${selectedTune()?.tune_id}`}
              target="_blank"
              rel="noopener noreferrer"
              class="text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors"
              title={`View ${selectedTune()?.name} on TheSession.org`}
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
          <p class="text-sm text-[var(--color-muted)] capitalize">
            {selectedTune()?.type}
            <Show when={selectedTune()?.meter}>
              {' · '}{selectedTune()?.meter}
            </Show>
          </p>
        </div>

        {/* Sheet music toggle */}
        <Show when={activeEntry()}>
          <label class="flex items-center gap-2 cursor-pointer select-none flex-shrink-0 mt-1">
            <span class="text-xs text-[var(--color-muted)]">Sheet</span>
            <button
              onClick={() => setShowSheet(v => !v)}
              class={`relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none
                ${showSheet() ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'}`}
              role="switch"
              aria-checked={showSheet()}
            >
              <span class={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200
                ${showSheet() ? 'translate-x-4' : 'translate-x-0'}`}
              />
            </button>
          </label>
        </Show>
      </div>

      {/* Reproductor activo */}
      <Show when={activeEntry()}>
        <div ref={el => { containerRef = el; }} class="flex items-start">

          {/* Video panel */}
          <div style={showSheet()
            ? { flex: `0 0 ${splitPct()}%`, 'min-width': '160px' }
            : { width: '100%' }
          }>
            <YoutubePlayer
              youtubeId={activeEntry()?.tune_videos?.youtube_id}
              startSec={activeEntry()?.start_sec}
              endSec={activeEntry()?.end_sec}
              autoplay={true}
              onEnd={handleVideoEnd}
            />
          </div>

          {/* Draggable divider */}
          <Show when={showSheet()}>
            <div
              onMouseDown={startDrag}
              onTouchStart={startDrag}
              class="flex-none self-stretch cursor-col-resize flex items-center justify-center px-1.5 select-none group"
            >
              <div class="flex flex-col gap-[3px] opacity-40 group-hover:opacity-100 transition-opacity">
                <div class="w-[3px] h-[3px] rounded-full bg-[var(--color-muted)] group-hover:bg-[var(--color-primary)] transition-colors" />
                <div class="w-[3px] h-[3px] rounded-full bg-[var(--color-muted)] group-hover:bg-[var(--color-primary)] transition-colors" />
                <div class="w-[3px] h-[3px] rounded-full bg-[var(--color-muted)] group-hover:bg-[var(--color-primary)] transition-colors" />
                <div class="w-[3px] h-[3px] rounded-full bg-[var(--color-muted)] group-hover:bg-[var(--color-primary)] transition-colors" />
                <div class="w-[3px] h-[3px] rounded-full bg-[var(--color-muted)] group-hover:bg-[var(--color-primary)] transition-colors" />
              </div>
            </div>

            {/* Sheet panel */}
            <div class="flex-1 min-w-0">
              <SheetMusic
                tune={selectedTune()}
                settingId={activeEntry()?.setting_id ?? null}
              />
            </div>
          </Show>

        </div>
      </Show>

      {/* Spinner de carga */}
      <Show when={loadingEntries()}>
        <div class="flex items-center gap-3 py-8 justify-center">
          <div class="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <span class="text-sm text-[var(--color-muted)]">Loading videos…</span>
        </div>
      </Show>

      {/* Sin vídeos */}
      <Show when={!loadingEntries() && tuneEntries().length === 0}>
        <p class="text-[var(--color-muted)] text-sm py-4">
          No videos yet for this tune.
        </p>
      </Show>

      {/* Lista de entries */}
      <Show when={!loadingEntries() && tuneEntries().length > 0}>
        <div class="flex flex-col gap-2">
          <h3 class="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider mb-1">
            Videos ({tuneEntries().length})
          </h3>
          <For each={tuneEntries()}>
            {(entry) => {
              const isActive = () => activeEntry()?.id === entry.id;
              const startFmt = formatTime(entry.start_sec);
              const endFmt   = formatTime(entry.end_sec);
              const label    = SOURCE_TYPES[entry.tune_videos?.source_type]
                            ?? entry.tune_videos?.source_type
                            ?? 'Unknown';

              return (
                <div
                  onClick={() => setActiveEntry(entry)}
                  class={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                    ${isActive()
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                      : 'border-[var(--color-border)] hover:border-[var(--color-muted)]'
                    }`}
                >
                  {/* Icono play */}
                  <div class={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs
                    ${isActive() ? 'bg-[var(--color-primary)] text-black' : 'bg-[var(--color-border)] text-[var(--color-muted)]'}`}
                  >
                    ▶
                  </div>

                  {/* Metadatos */}
                  <div class="flex-grow min-w-0 flex flex-col gap-1">
                    <Show when={entry.tune_videos?.title}>
                      <div class="flex items-center gap-1.5">
                        <span class="text-sm text-white font-medium truncate">
                          {entry.tune_videos.title}
                        </span>
                        <Show when={entry.tune_videos?.thesession_recording_id}>
                          <a
                            href={`https://thesession.org/recordings/${entry.tune_videos.thesession_recording_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors flex-shrink-0"
                            title="View recording on TheSession.org"
                            onClick={e => e.stopPropagation()}
                          >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        </Show>
                      </div>
                    </Show>
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-xs px-2 py-0.5 rounded-full bg-[var(--color-border)] text-[var(--color-muted)] w-fit">
                        {label}
                      </span>
                      <Show when={entry.main_instrument}>
                        <span class="text-xs px-2 py-0.5 rounded-full bg-[var(--color-border)] text-[var(--color-muted)] w-fit">
                          {INSTRUMENTS[entry.main_instrument] ?? entry.main_instrument}
                        </span>
                      </Show>
                      <Show when={startFmt}>
                        <span class="text-xs text-[var(--color-muted)] font-mono">
                          {startFmt}{endFmt ? ` – ${endFmt}` : ''}
                        </span>
                      </Show>
                    </div>
                  </div>

                  {/* Votos */}
                  <div class="flex items-center gap-1 lg:gap-1.5 flex-shrink-0">
                    <span class={`text-sm lg:text-base font-bold w-8 lg:w-10 text-right
                      ${entry.voteScore > 0 ? 'text-green-400'
                        : entry.voteScore < 0 ? 'text-red-400'
                        : 'text-[var(--color-muted)]'}`}
                    >
                      {entry.voteScore > 0 ? '+' : ''}{entry.voteScore}
                    </span>
                    <button
                      onClick={(e) => handleVote(e, entry, 1)}
                      class={`p-1 transition-colors ${entry.userVote === 1 ? 'text-green-400' : 'text-[var(--color-muted)] hover:text-green-400'}`}
                      title="Upvote"
                    >▲</button>
                    <button
                      onClick={(e) => handleVote(e, entry, -1)}
                      class={`p-1 transition-colors ${entry.userVote === -1 ? 'text-red-400' : 'text-[var(--color-muted)] hover:text-red-400'}`}
                      title="Downvote"
                    >▼</button>
                    <button
                      onClick={(e) => handleVote(e, entry, -1, true)}
                      class="p-1 text-[var(--color-muted)] hover:text-yellow-400 transition-colors text-xs"
                      title="Report"
                    >⚑</button>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </Show>

      {/* Más tunes del mismo tipo */}
      <SameTypeTunes />

    </div>
  );
}

export default TuneView;
