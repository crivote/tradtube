/**
 * PlaylistView.jsx
 * Vista unificada de detalle de playlist: reproductor activo, edición integrada,
 * ordenación y eliminación de items.
 */

import { For, Show, createEffect, createSignal } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { Trash2, Globe, Lock, ArrowUp, ArrowDown, Pencil, ExternalLink, Check, X } from 'lucide-solid';
import {
  getPlaylist,
  updatePlaylist,
  deletePlaylist,
  removeFromPlaylist,
  reorderPlaylist,
} from '../lib/supabase';
import { getTuneById } from '../lib/db';
import { extractYoutubeId, formatTime, relativeTime } from '../lib/utils';
import { useAppStore } from '../store/appStore';
import { useI18n } from '../i18n';
import YoutubePlayer from './YoutubePlayer';
import AudioPlayer from './AudioPlayer';

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
  const { authUser, showToast } = useAppStore();

  const [playlist, setPlaylist] = createSignal(null);
  const [items, setItems] = createSignal([]);
  const [loading, setLoading] = createSignal(true);
  const [activeIdx, setActiveIdx] = createSignal(-1);
  const [autoPlaying, setAutoPlaying] = createSignal(false);

  // Inline title editing
  const [editingTitle, setEditingTitle] = createSignal(false);
  const [titleDraft, setTitleDraft] = createSignal('');
  const [savingTitle, setSavingTitle] = createSignal(false);

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

        // Auto-play first item
        if (resolved.length > 0) {
          setActiveIdx(0);
          setAutoPlaying(true);
        }
      })
      .catch(() => {
        setLoading(false);
      });
  });

  const isOwner = () => playlist()?.user_id === authUser()?.id;
  const activeItem = () => (activeIdx() >= 0 && activeIdx() < items().length) ? items()[activeIdx()] : null;

  const handleEntryClick = (idx) => {
    setActiveIdx(idx);
    setAutoPlaying(true);
  };

  const handleNavigateToTune = (e, tuneId) => {
    e.stopPropagation();
    navigate(`/tune/${tuneId}`);
  };

  const handleVideoEnd = () => {
    const next = activeIdx() + 1;
    if (autoPlaying() && next < items().length) {
      setActiveIdx(next);
      setTimeout(() => {
        const el = document.querySelector(`[data-pl-entry="${next}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    } else if (next >= items().length) {
      setAutoPlaying(false);
    }
  };

  // ── Edit actions ──

  const handleRemoveItem = async (entryId) => {
    try {
      await removeFromPlaylist(params.id, entryId);
      setItems(prev => prev.filter(i => i.entry_id !== entryId));
      // If active item was removed, reset
      if (activeItem()?.entry_id === entryId) {
        const newItems = items().filter(i => i.entry_id !== entryId);
        if (newItems.length > 0) {
          setActiveIdx(0);
          setAutoPlaying(true);
        } else {
          setActiveIdx(-1);
          setAutoPlaying(false);
        }
      }
      showToast('Removed from playlist', 'success');
    } catch (err) {
      showToast('Failed to remove', 'error');
    }
  };

  const handleMoveItem = async (index, direction) => {
    const currentItems = [...items()];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= currentItems.length) return;

    [currentItems[index], currentItems[newIndex]] = [currentItems[newIndex], currentItems[index]];
    setItems(currentItems);

    try {
      await reorderPlaylist(
        params.id,
        currentItems.map(i => i.entry_id)
      );
      // Update activeIdx if we moved the playing item
      if (activeIdx() === index) setActiveIdx(newIndex);
      else if (activeIdx() === newIndex) setActiveIdx(index);
    } catch (err) {
      showToast('Failed to reorder', 'error');
    }
  };

  const handleSaveTitle = async () => {
    const name = titleDraft().trim();
    if (!name || name === playlist()?.name) {
      setEditingTitle(false);
      return;
    }
    setSavingTitle(true);
    try {
      await updatePlaylist(params.id, { name });
      setPlaylist(prev => ({ ...prev, name }));
      setEditingTitle(false);
      showToast('Title updated', 'success');
    } catch (err) {
      showToast('Failed to update title', 'error');
    } finally {
      setSavingTitle(false);
    }
  };

  const handleDeletePlaylist = async () => {
    if (!confirm(`Delete "${playlist()?.name}"? This cannot be undone.`)) return;
    try {
      await deletePlaylist(params.id);
      showToast('Playlist deleted', 'success');
      navigate('/playlists');
    } catch (err) {
      showToast('Failed to delete playlist', 'error');
    }
  };

  return (
    <div class="flex flex-col gap-6">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
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
          <div class="flex flex-col gap-1 flex-1 min-w-0">
            {/* Title row */}
            <div class="flex items-center gap-2">
              <Show
                when={editingTitle()}
                fallback={
                  <>
                    <h2 class="text-2xl font-black text-[var(--color-text)] truncate">
                      {playlist()?.name}
                    </h2>
                    <Show when={isOwner()}>
                      <button
                        onClick={() => { setTitleDraft(playlist()?.name); setEditingTitle(true); }}
                        class="p-1 text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors flex-shrink-0"
                        title="Edit title"
                      >
                        <Pencil size={14} />
                      </button>
                    </Show>
                  </>
                }
              >
                <div class="flex items-center gap-1.5 flex-1 min-w-0">
                  <input
                    type="text"
                    value={titleDraft()}
                    onInput={e => setTitleDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                    class="flex-1 text-2xl font-black bg-[var(--color-bg)] border border-[var(--color-primary)] rounded-lg px-2 py-1 text-[var(--color-text)] focus:outline-none min-w-0"
                    ref={el => el?.focus()}
                  />
                  <button
                    onClick={handleSaveTitle}
                    disabled={savingTitle()}
                    class="p-1 text-green-400 hover:text-green-300 transition-colors flex-shrink-0"
                    title="Save"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => setEditingTitle(false)}
                    class="p-1 text-[var(--color-muted)] hover:text-red-400 transition-colors flex-shrink-0"
                    title="Cancel"
                  >
                    <X size={16} />
                  </button>
                </div>
              </Show>
            </div>

            {/* Meta row */}
            <div class="flex items-center gap-2 text-xs text-[var(--color-muted)] flex-wrap">
              <span>{items().length} {items().length === 1 ? 'tune' : 'tunes'}</span>
              <Show when={playlist()?.is_public} fallback={
                <span class="inline-flex items-center gap-0.5"><Lock size={10} /> Private</span>
              }>
                <span class="inline-flex items-center gap-0.5 text-[var(--color-primary)]"><Globe size={10} /> Public</span>
              </Show>
              <Show when={playlist()?.created_at}>
                <span>· created {relativeTime(playlist()?.created_at)}</span>
              </Show>
              <Show when={playlist()?.updated_at && playlist()?.updated_at !== playlist()?.created_at}>
                <span>· updated {relativeTime(playlist()?.updated_at)}</span>
              </Show>
            </div>
          </div>

          {/* Delete button (owner only) */}
          <Show when={isOwner()}>
            <button
              onClick={handleDeletePlaylist}
              class="p-2 text-[var(--color-muted)] hover:text-red-400 transition-colors flex-shrink-0"
              title="Delete playlist"
            >
              <Trash2 size={16} />
            </button>
          </Show>
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
                    data-pl-entry={index()}
                    class={`flex items-center gap-3 p-3 rounded-lg border transition-colors
                      ${isActive()
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                        : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-muted)]'
                      }
                      ${isUnavailable ? 'opacity-60' : ''}`}
                  >
                    {/* Reorder arrows (owner only) */}
                    <Show when={isOwner()}>
                      <div class="flex flex-col gap-0.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMoveItem(index(), -1); }}
                          disabled={index() === 0}
                          class="p-1 text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-30 transition-colors"
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMoveItem(index(), 1); }}
                          disabled={index() === items().length - 1}
                          class="p-1 text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-30 transition-colors"
                        >
                          <ArrowDown size={12} />
                        </button>
                      </div>
                    </Show>

                    {/* Play button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEntryClick(index()); }}
                      class={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs transition-colors
                        ${isActive() ? 'bg-[var(--color-primary)] text-black' : 'bg-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-primary)]/30'}`}
                      title="Play"
                    >
                      ▶
                    </button>

                    {/* Info */}
                    <div class="flex-1 min-w-0 flex flex-col gap-0.5 cursor-pointer" onClick={() => handleEntryClick(index())}>
                      <div class="flex items-center gap-1.5">
                        <span class="text-sm font-semibold text-[var(--color-text)] truncate">
                          {tune?.name || `Tune #${item.tune_id}`}
                        </span>
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

                    {/* Go to tune page */}
                    <button
                      onClick={(e) => handleNavigateToTune(e, item.tune_id)}
                      class="p-1.5 text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors flex-shrink-0"
                      title="Go to tune page"
                    >
                      <ExternalLink size={14} />
                    </button>

                    {/* Delete from playlist (owner only) */}
                    <Show when={isOwner()}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveItem(item.entry_id); }}
                        class="p-1.5 text-[var(--color-muted)] hover:text-red-400 transition-colors flex-shrink-0"
                        title="Remove from playlist"
                      >
                        <Trash2 size={14} />
                      </button>
                    </Show>
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
