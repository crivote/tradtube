/**
 * AdminView.jsx
 * Panel de administración: lista vídeos pending con reproductor slidedown,
 * botones aprobar / rechazar / editar.
 *
 * Props: { onClose }
 */

import { createSignal, onMount, For, Show } from 'solid-js';
import { getPendingVideos, approveVideo, deleteVideo } from '../lib/supabase';
import { getTuneById } from '../lib/db';
import { SOURCE_TYPES } from '../constants';
import YoutubePlayer from './YoutubePlayer';
import AddVideoForm from './AddVideoForm';

function formatTime(sec) {
  if (sec == null) return '';
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function AdminView(props) {
  const [videos, setVideos] = createSignal([]);
  const [loading, setLoading] = createSignal(true);
  const [expandedId, setExpandedId] = createSignal(null);
  const [previewEntry, setPreviewEntry] = createSignal(null);
  const [actionId, setActionId] = createSignal(null);
  const [editingVideo, setEditingVideo] = createSignal(null);

  const loadVideos = async () => {
    setLoading(true);
    const data = await getPendingVideos();
    setVideos(data.map(v => ({
      ...v,
      tune_video_entries: v.tune_video_entries.map(e => ({
        ...e,
        tune: getTuneById(e.tune_id),
      })),
    })));
    setLoading(false);
  };

  onMount(loadVideos);

  const togglePreview = (video) => {
    if (expandedId() === video.id) {
      setExpandedId(null);
      setPreviewEntry(null);
    } else {
      setExpandedId(video.id);
      const first = video.tune_video_entries[0];
      setPreviewEntry(first ? { ...first, youtube_id: video.youtube_id } : null);
    }
  };

  const selectEntry = (video, entry) => {
    setPreviewEntry({ ...entry, youtube_id: video.youtube_id });
  };

  const handleApprove = async (video) => {
    setActionId(video.id);
    try {
      await approveVideo(video.id);
      setVideos(prev => prev.filter(v => v.id !== video.id));
      if (expandedId() === video.id) { setExpandedId(null); setPreviewEntry(null); }
    } catch (e) { console.error(e); }
    finally { setActionId(null); }
  };

  const handleReject = async (video) => {
    if (!confirm(`¿Eliminar el vídeo "${video.youtube_id}"? Esta acción no se puede deshacer.`)) return;
    setActionId(video.id);
    try {
      await deleteVideo(video.id);
      setVideos(prev => prev.filter(v => v.id !== video.id));
      if (expandedId() === video.id) { setExpandedId(null); setPreviewEntry(null); }
    } catch (e) { console.error(e); }
    finally { setActionId(null); }
  };

  const handleEditClose = () => {
    setEditingVideo(null);
    loadVideos();
  };

  // ── Modo edición ─────────────────────────────────────────────────────────
  return (
    <Show
      when={!editingVideo()}
      fallback={<AddVideoForm editVideo={editingVideo()} onClose={handleEditClose} />}
    >
      <div class="flex flex-col gap-6">

        {/* Header */}
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-2xl font-black text-white">Admin</h2>
            <p class="text-sm text-[var(--color-muted)] mt-0.5">
              Pending videos
              <Show when={!loading()}>
                {' '}— <span class="text-amber-400">{videos().length}</span> to review
              </Show>
            </p>
          </div>
          <button
            onClick={props.onClose}
            class="text-sm text-[var(--color-muted)] hover:text-white transition-colors"
          >
            ✕ Close
          </button>
        </div>

        {/* Loading */}
        <Show when={loading()}>
          <div class="flex items-center gap-3 py-16 justify-center">
            <div class="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <span class="text-sm text-[var(--color-muted)]">Loading pending videos…</span>
          </div>
        </Show>

        {/* Empty */}
        <Show when={!loading() && videos().length === 0}>
          <div class="text-center py-16 border border-dashed border-[var(--color-border)] rounded-xl">
            <p class="text-2xl mb-2">✓</p>
            <p class="text-[var(--color-muted)] text-sm">No pending videos. Queue is clear.</p>
          </div>
        </Show>

        {/* Lista */}
        <Show when={!loading() && videos().length > 0}>
          <div class="flex flex-col gap-3">
            <For each={videos()}>
              {(video) => {
                const isExpanded = () => expandedId() === video.id;
                const isBusy = () => actionId() === video.id;

                return (
                  <div class={`border rounded-xl overflow-hidden transition-colors
                    ${isExpanded()
                      ? 'border-amber-500/40'
                      : 'border-[var(--color-border)]'
                    }`}
                  >
                    {/* ── Card header ───────────────────────────────────── */}
                    <div class="flex items-start gap-4 p-4 bg-[var(--color-surface)]">

                      {/* Thumbnail */}
                      <img
                        src={`https://img.youtube.com/vi/${video.youtube_id}/mqdefault.jpg`}
                        alt=""
                        class="w-28 h-16 object-cover rounded-lg flex-shrink-0 bg-[var(--color-border)]"
                      />

                      {/* Info */}
                      <div class="flex-grow min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="text-xs font-mono text-white">{video.youtube_id}</span>
                          <span class="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-muted)]">
                            {SOURCE_TYPES[video.source_type] ?? video.source_type}
                          </span>
                          <span class="text-[10px] text-[var(--color-muted)]">
                            {formatDate(video.created_at)}
                          </span>
                        </div>

                        {/* Tune chips */}
                        <div class="flex flex-wrap gap-1.5 mt-2">
                          <For each={video.tune_video_entries}>
                            {(entry) => (
                              <span class="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-muted)]">
                                {entry.tune?.name ?? `tune #${entry.tune_id}`}
                                <Show when={entry.start_sec != null}>
                                  <span class="font-mono ml-1 opacity-50">
                                    {formatTime(entry.start_sec)}
                                    {entry.end_sec != null ? `–${formatTime(entry.end_sec)}` : ''}
                                  </span>
                                </Show>
                              </span>
                            )}
                          </For>
                        </div>
                      </div>
                    </div>

                    {/* ── Action bar ────────────────────────────────────── */}
                    <div class="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-bg)] border-t border-[var(--color-border)] flex-wrap">
                      <button
                        onClick={() => togglePreview(video)}
                        class={`text-xs px-3 py-1.5 rounded-lg border transition-colors
                          ${isExpanded()
                            ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                            : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-white'
                          }`}
                      >
                        {isExpanded() ? '▲ Hide' : '▶ Preview'}
                      </button>

                      <button
                        onClick={() => setEditingVideo(video)}
                        disabled={isBusy()}
                        class="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-white hover:border-[var(--color-muted)]/50 transition-colors disabled:opacity-30"
                      >
                        Edit
                      </button>

                      <div class="flex-grow" />

                      <button
                        onClick={() => handleReject(video)}
                        disabled={isBusy()}
                        class="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30"
                      >
                        {isBusy() ? '…' : '✕ Reject'}
                      </button>

                      <button
                        onClick={() => handleApprove(video)}
                        disabled={isBusy()}
                        class="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-primary)]/50 bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 transition-colors disabled:opacity-30"
                      >
                        {isBusy() ? '…' : '✓ Approve'}
                      </button>
                    </div>

                    {/* ── Slidedown player ──────────────────────────────── */}
                    <Show when={isExpanded()}>
                      <div class="border-t border-[var(--color-border)] bg-[var(--color-bg)] p-4 flex flex-col gap-3">

                        {/* Entry selector — solo si hay más de uno */}
                        <Show when={video.tune_video_entries.length > 1}>
                          <div class="flex gap-2 flex-wrap">
                            <For each={video.tune_video_entries}>
                              {(entry) => {
                                const isActive = () => previewEntry()?.id === entry.id;
                                return (
                                  <button
                                    onClick={() => selectEntry(video, entry)}
                                    class={`text-xs px-3 py-1 rounded-full border transition-colors
                                      ${isActive()
                                        ? 'border-amber-500/60 bg-amber-500/10 text-amber-400'
                                        : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-white'
                                      }`}
                                  >
                                    {entry.tune?.name ?? `Tune ${entry.position + 1}`}
                                    <span class="font-mono ml-1.5 opacity-50 text-[10px]">
                                      {formatTime(entry.start_sec)}
                                    </span>
                                  </button>
                                );
                              }}
                            </For>
                          </div>
                        </Show>

                        {/* Player */}
                        <Show when={previewEntry()}>
                          <YoutubePlayer
                            youtubeId={previewEntry().youtube_id}
                            startSec={previewEntry().start_sec}
                            endSec={previewEntry().end_sec}
                            autoplay={true}
                          />
                        </Show>

                      </div>
                    </Show>

                  </div>
                );
              }}
            </For>
          </div>
        </Show>

      </div>
    </Show>
  );
}

export default AdminView;
