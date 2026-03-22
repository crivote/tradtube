/**
 * TuneView.jsx
 * Vista de detalle de una tune: reproductor + lista de entries con votos.
 */

import { Show, For } from 'solid-js';
import { useAppStore } from '../store/appStore';
import { castVote, loginWithGoogle } from '../lib/supabase';
import { SOURCE_TYPES } from '../constants';
import YoutubePlayer from './YoutubePlayer';

function formatTime(sec) {
  if (sec == null) return null;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function TuneView() {
  const {
    selectedTune, tuneEntries, loadingEntries,
    activeEntry, setActiveEntry,
    backToSearch, currentUser,
  } = useAppStore();

  const handleVote = async (e, entry, vote, isReport = false) => {
    e.stopPropagation();
    if (!currentUser()) { loginWithGoogle(); return; }
    try {
      await castVote(entry.id, vote, isReport);
    } catch (err) {
      console.error('[TradTube] vote error', err);
    }
  };

  return (
    <div class="flex flex-col gap-6">

      {/* Back */}
      <button
        onClick={backToSearch}
        class="flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-white transition-colors w-fit"
      >
        ← Back to search
      </button>

      {/* Tune header */}
      <div class="flex flex-col gap-1">
        <h2 class="text-2xl font-black text-white">{selectedTune()?.name}</h2>
        <p class="text-sm text-[var(--color-muted)] capitalize">
          {selectedTune()?.type}
          <Show when={selectedTune()?.meter}>
            {' · '}{selectedTune()?.meter}
          </Show>
        </p>
      </div>

      {/* Reproductor activo */}
      <Show when={activeEntry()}>
        <YoutubePlayer
          youtubeId={activeEntry()?.tune_videos?.youtube_id}
          startSec={activeEntry()?.start_sec}
          endSec={activeEntry()?.end_sec}
          autoplay={true}
        />
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
                      <span class="text-sm text-white font-medium truncate">
                        {entry.tune_videos.title}
                      </span>
                    </Show>
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-xs px-2 py-0.5 rounded-full bg-[var(--color-border)] text-[var(--color-muted)] w-fit">
                        {label}
                      </span>
                      <Show when={startFmt}>
                        <span class="text-xs text-[var(--color-muted)] font-mono">
                          {startFmt}{endFmt ? ` – ${endFmt}` : ''}
                        </span>
                      </Show>
                    </div>
                  </div>

                  {/* Votos */}
                  <div class="flex items-center gap-0.5 flex-shrink-0">
                    <span class={`text-sm font-bold w-8 text-right
                      ${entry.voteScore > 0 ? 'text-green-400'
                        : entry.voteScore < 0 ? 'text-red-400'
                        : 'text-[var(--color-muted)]'}`}
                    >
                      {entry.voteScore > 0 ? '+' : ''}{entry.voteScore}
                    </span>
                    <button
                      onClick={(e) => handleVote(e, entry, 1)}
                      class="p-1 text-[var(--color-muted)] hover:text-green-400 transition-colors"
                      title="Upvote"
                    >▲</button>
                    <button
                      onClick={(e) => handleVote(e, entry, -1)}
                      class="p-1 text-[var(--color-muted)] hover:text-red-400 transition-colors"
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

    </div>
  );
}

export default TuneView;
