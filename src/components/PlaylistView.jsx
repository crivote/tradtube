/**
 * PlaylistView.jsx
 * Display a playlist with embedded player and auto-advance support.
 */

import { For, Show, createEffect, createSignal } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { Play, ExternalLink, Globe, Lock } from 'lucide-solid';
import { getPlaylist } from '../lib/supabase';
import { getTuneById } from '../lib/db';
import { extractYoutubeId, formatTime } from '../lib/utils';
import { useAppStore } from '../store/appStore';
import { useI18n } from '../i18n';
import YoutubePlayer from './YoutubePlayer';
import AudioPlayer from './AudioPlayer';
import AddToPlaylistButton from './AddToPlaylistButton';

const TYPE_COLOR = {
  jig:        'text-[var(--color-primary)]',
  reel:       'text-blue-400',
  hornpipe:   'text-[var(--color-warning)]',
  polka:      'text-rose-400',
  slide:      'text-violet-400',
  waltz:      'text-cyan-400',
  march:      'text-orange-400',
  'slip jig': 'text-pink-400',
};

function PlaylistView() {
  const params = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { authUser } = useAppStore();

  const [playlist, setPlaylist] = createSignal(null);
  const [items, setItems] = createSignal([]);
  const [loading, setLoading] = createSignal(true);
  const [activeIdx, setActiveIdx] = createSignal(-1);
  const [autoPlaying, setAutoPlaying] = createSignal(false);

  createEffect(() => {
    setLoading(true);
    setActiveIdx(-1);
    setAutoPlaying(false);
    getPlaylist(params.id)
      .then((pl) => {
        setPlaylist(pl);

        // Resolve tune names from SQLite
        const resolved = (pl.items || []).map(item => {
          const tune = getTuneById(item.tune_id);
          return { ...item, tune };
        });
        setItems(resolved);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  });

  const isOwner = () => playlist()?.user_id === authUser()?.id;
  const activeItem = () => (activeIdx() >= 0 && activeIdx() < items().length) ? items()[activeIdx()] : null;

  const handlePlayAll = () => {
    if (items().length === 0) return;
    setActiveIdx(0);
    setAutoPlaying(true);
  };

  const handleEntryClick = (idx) => {
    setActiveIdx(idx);
    setAutoPlaying(true);
  };

  const handleNavigateToTune = (tuneId) => {
    navigate(`/tune/${tuneId}`);
  };

  const handleVideoEnd = () => {
    const next = activeIdx() + 1;
    if (autoPlaying() && next < items().length) {
      setActiveIdx(next);
      // Scroll the next item into view
      setTimeout(() => {
        const el = document.querySelector(`[data-pl-entry="${next}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    } else if (next >= items().length) {
      setAutoPlaying(false);
    }
  };

  return (
    <div class="flex flex-col gap-6">
      {/* Back */}
      <button
        onClick={() => navigate('/')}
        class="flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors w-fit"
      >
        ← Back
      </button>

      {/* Loading */}
      <Show when={loading()}>
        <div class="flex items-center gap-3 py-8 justify-center">
          <div class="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <span class="text-sm text-[var(--color-muted)]">Loading playlist...</span>
        </div>
      </Show>

      {/* Not found */}
      <Show when={!loading() && !playlist()}>
        <div class="text-center py-16">
          <p class="text-4xl mb-4">📋</p>
          <p class="text-xl font-semibold text-[var(--color-text)] mb-2">Playlist not found</p>
          <button
            onClick={() => navigate('/')}
            class="text-sm px-4 py-2 rounded-lg bg-[var(--color-primary)] text-black font-semibold hover:opacity-90 transition-opacity mt-4"
          >
            Go home
          </button>
        </div>
      </Show>

      <Show when={!loading() && playlist()}>
        {/* Header */}
        <div class="flex items-start justify-between gap-4">
          <div class="flex flex-col gap-1">
            <h2 class="text-2xl font-black text-[var(--color-text)]">{playlist()?.name}</h2>
            <div class="flex items-center gap-2 text-xs text-[var(--color-muted)]">
              <span>{items().length} {items().length === 1 ? 'tune' : 'tunes'}</span>
              <Show when={playlist()?.is_public} fallback={
                <span class="inline-flex items-center gap-0.5"><Lock size={10} /> Private</span>
              }>
                <span class="inline-flex items-center gap-0.5 text-[var(--color-primary)]"><Globe size={10} /> Public</span>
              </Show>
            </div>
          </div>

          <div class="flex items-center gap-2 flex-shrink-0">
            <Show when={isOwner()}>
              <button
                onClick={() => navigate(`/playlist/${params.id}/edit`)}
                class="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
              >
                Edit
              </button>
            </Show>
            <Show when={items().length > 0}>
              <button
                onClick={handlePlayAll}
                class={`inline-flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-lg font-semibold transition-colors ${
                  autoPlaying()
                    ? 'bg-green-400 text-black'
                    : 'bg-[var(--color-primary)] text-black hover:bg-green-400'
                }`}
              >
                <Play size={14} fill="currentColor" />
                Play All
              </button>
            </Show>
          </div>
        </div>

        {/* Active player */}
        <Show when={activeItem()}>
          <div class="rounded-xl overflow-hidden border border-[var(--color-border)] bg-black">
            <Show
              when={activeItem()?.tune_media?.source_type === 'user_recording'}
              fallback={
                <YoutubePlayer
                  youtubeId={extractYoutubeId(activeItem()?.tune_media?.media_uri)}
                  startSec={activeItem()?.start_sec}
                  endSec={activeItem()?.end_sec}
                  autoplay={true}
                  onEnd={handleVideoEnd}
                />
              }
            >
              <div class="aspect-video flex items-center justify-center p-4">
                <AudioPlayer
                  mediaUri={activeItem()?.tune_media?.media_uri}
                  startSec={activeItem()?.start_sec}
                  endSec={activeItem()?.end_sec}
                  autoplay={true}
                  onEnd={handleVideoEnd}
                  performerName={activeItem()?.tune_media?.performer_name}
                  notes={activeItem()?.tune_media?.recording_notes}
                />
              </div>
            </Show>
          </div>
        </Show>

        {/* Empty state */}
        <Show when={items().length === 0}>
          <div class="flex flex-col items-center gap-3 py-6 px-6 rounded-2xl border border-[var(--color-border)] bg-white/60 dark:bg-white/5">
            <p class="text-4xl">🎵</p>
            <p class="text-sm text-[var(--color-text)]/90 font-medium">
              No tunes yet. Add some from tune pages!
            </p>
          </div>
        </Show>

        {/* Entry list */}
        <Show when={items().length > 0}>
          <div class="flex flex-col gap-1.5">
            <For each={items()}>
              {(item, index) => {
                const isActive = () => activeIdx() === index();
                const tune = item.tune;
                const typeColor = TYPE_COLOR[tune?.type] ?? 'text-[var(--color-muted)]';
                const startFmt = formatTime(item.start_sec);
                const endFmt   = formatTime(item.end_sec);
                const mediaTitle = item.tune_media?.title;
                const sourceType = item.tune_media?.source_type;
                const isUnavailable = item.tune_media?.unavailable;

                return (
                  <div
                    onClick={() => handleEntryClick(index())}
                    data-pl-entry={index()}
                    class={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                      ${isActive()
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                        : 'border-[var(--color-border)] hover:border-[var(--color-muted)]'
                      }
                      ${isUnavailable ? 'opacity-60' : ''}`}
                  >
                    {/* Play icon */}
                    <div class={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs
                      ${isActive() ? 'bg-[var(--color-primary)] text-black' : 'bg-[var(--color-border)] text-[var(--color-muted)]'}`}
                    >
                      ▶
                    </div>

                    {/* Info */}
                    <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                      <div class="flex items-center gap-1.5">
                        <span
                          class="text-sm font-semibold text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors truncate cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); handleNavigateToTune(item.tune_id); }}
                        >
                          {tune?.name || `Tune #${item.tune_id}`}
                        </span>
                        <Show when={tune}>
                          <a
                            href={`https://thesession.org/tunes/${tune.tune_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            class="text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors flex-shrink-0"
                          >
                            <ExternalLink size={14} />
                          </a>
                        </Show>
                      </div>

                      <div class="flex items-center gap-1.5 flex-wrap">
                        <Show when={tune?.type}>
                          <span class={`text-[10px] font-bold uppercase tracking-widest ${typeColor}`}>
                            {tune.type}
                          </span>
                        </Show>
                        <Show when={mediaTitle}>
                          <span class="text-[10px] text-[var(--color-muted)]">{mediaTitle}</span>
                        </Show>
                        <Show when={sourceType}>
                          <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-border)] text-[var(--color-muted)]">
                            {sourceType}
                          </span>
                        </Show>
                        <Show when={isUnavailable}>
                          <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                            unavailable
                          </span>
                        </Show>
                        <Show when={startFmt}>
                          <span class="text-[10px] text-[var(--color-muted)] font-mono">
                            {startFmt}{endFmt ? ` – ${endFmt}` : ''}
                          </span>
                        </Show>
                      </div>
                    </div>

                    {/* Add to playlist button (for re-adding to other playlists) */}
                    <div onClick={e => e.stopPropagation()}>
                      <AddToPlaylistButton entryId={item.entry_id || item.id} />
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
}

export default PlaylistView;
