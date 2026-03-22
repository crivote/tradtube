/**
 * AdminView.jsx
 * Panel de administración con tres tabs:
 *   - Pending: vídeos pendientes (badge con count)
 *   - Latest approved: últimos 20 vídeos aprobados
 *   - Search by tune: vídeos filtrados por tune
 */

import { createSignal, onMount, For, Show } from 'solid-js';
import {
  getPendingVideos, getPendingCount,
  getLatestApprovedVideos, getTunesWithVideos, getVideosByTune,
  approveVideo, deleteVideo,
} from '../lib/supabase';
import { getTuneById } from '../lib/db';
import { SOURCE_TYPES } from '../constants';
import YoutubePlayer from './YoutubePlayer';
import AddVideoForm from './AddVideoForm';
import { useAppStore } from '../store/appStore';

function formatTime(sec) {
  if (sec == null) return '';
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

const STATUS_STYLE = {
  approved: 'text-green-400 border-green-400/30 bg-green-400/10',
  pending:  'text-amber-400 border-amber-400/30 bg-amber-400/10',
  rejected: 'text-red-400 border-red-400/30 bg-red-400/10',
};

function enrichVideos(data) {
  return data.map(v => ({
    ...v,
    tune_video_entries: v.tune_video_entries.map(e => ({
      ...e,
      tune: getTuneById(e.tune_id),
    })),
  }));
}

function TuneChips(props) {
  return (
    <div class="flex flex-wrap gap-1.5 mt-2">
      <For each={props.entries}>
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
  );
}

// ── Shared video row (for Latest Approved and Search by Tune tabs) ────────────
function VideoRow(props) {
  const { video, onEdit, onDelete, actionId } = props;
  const isBusy = () => actionId() === video.id;
  return (
    <div class="flex items-start gap-4 p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl">
      <img
        src={`https://img.youtube.com/vi/${video.youtube_id}/mqdefault.jpg`}
        alt="" class="w-24 h-14 object-cover rounded-lg flex-shrink-0 bg-[var(--color-border)]"
      />
      <div class="flex-grow min-w-0">
        <Show when={video.title}>
          <p class="text-sm text-white font-semibold truncate">{video.title}</p>
        </Show>
        <div class="flex items-center gap-2 flex-wrap mt-0.5">
          <span class="text-xs font-mono text-[var(--color-muted)]">{video.youtube_id}</span>
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-muted)]">
            {SOURCE_TYPES[video.source_type] ?? video.source_type}
          </span>
          <span class={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_STYLE[video.status] ?? ''}`}>
            {video.status}
          </span>
          <span class="text-[10px] text-[var(--color-muted)]">{formatDate(video.created_at)}</span>
        </div>
        <TuneChips entries={video.tune_video_entries} />
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => onEdit(video)}
          disabled={isBusy()}
          class="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-white hover:border-[var(--color-primary)]/50 transition-colors disabled:opacity-30"
        >Edit</button>
        <button
          onClick={() => onDelete(video)}
          disabled={isBusy()}
          class="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30"
        >{isBusy() ? '…' : '✕'}</button>
      </div>
    </div>
  );
}

// ── Tab: Pending ─────────────────────────────────────────────────────────────
function PendingTab(props) {
  const { loadVideoData } = useAppStore();
  const [videos, setVideos] = createSignal([]);
  const [loading, setLoading] = createSignal(true);
  const [expandedId, setExpandedId] = createSignal(null);
  const [previewEntry, setPreviewEntry] = createSignal(null);
  const [actionId, setActionId] = createSignal(null);

  const load = async () => {
    setLoading(true);
    const data = enrichVideos(await getPendingVideos());
    setVideos(data);
    props.onCountLoaded(data.length);
    setLoading(false);
  };
  onMount(load);

  const togglePreview = (video) => {
    if (expandedId() === video.id) { setExpandedId(null); setPreviewEntry(null); return; }
    setExpandedId(video.id);
    const first = video.tune_video_entries[0];
    setPreviewEntry(first ? { ...first, youtube_id: video.youtube_id } : null);
  };

  const handleApprove = async (video) => {
    setActionId(video.id);
    try {
      await approveVideo(video.id);
      const next = videos().filter(v => v.id !== video.id);
      setVideos(next);
      props.onCountLoaded(next.length);
      if (expandedId() === video.id) { setExpandedId(null); setPreviewEntry(null); }
      loadVideoData();
    } finally { setActionId(null); }
  };

  const handleReject = async (video) => {
    if (!confirm(`¿Eliminar "${video.youtube_id}"? No se puede deshacer.`)) return;
    setActionId(video.id);
    try {
      await deleteVideo(video.id);
      const next = videos().filter(v => v.id !== video.id);
      setVideos(next);
      props.onCountLoaded(next.length);
      if (expandedId() === video.id) { setExpandedId(null); setPreviewEntry(null); }
    } finally { setActionId(null); }
  };

  return (
    <>
      <Show when={loading()}>
        <div class="flex items-center gap-3 py-16 justify-center">
          <div class="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <span class="text-sm text-[var(--color-muted)]">Loading…</span>
        </div>
      </Show>

      <Show when={!loading() && videos().length === 0}>
        <div class="text-center py-16 border border-dashed border-[var(--color-border)] rounded-xl">
          <p class="text-2xl mb-2">✓</p>
          <p class="text-[var(--color-muted)] text-sm">No pending videos.</p>
        </div>
      </Show>

      <Show when={!loading() && videos().length > 0}>
        <div class="flex flex-col gap-3">
          <For each={videos()}>
            {(video) => {
              const isExpanded = () => expandedId() === video.id;
              const isBusy = () => actionId() === video.id;
              return (
                <div class={`border rounded-xl overflow-hidden transition-colors
                  ${isExpanded() ? 'border-amber-500/40' : 'border-[var(--color-border)]'}`}>

                  <div class="flex items-start gap-4 p-4 bg-[var(--color-surface)]">
                    <img
                      src={`https://img.youtube.com/vi/${video.youtube_id}/mqdefault.jpg`}
                      alt="" class="w-28 h-16 object-cover rounded-lg flex-shrink-0 bg-[var(--color-border)]"
                    />
                    <div class="flex-grow min-w-0">
                      <Show when={video.title}>
                        <p class="text-sm text-white font-semibold truncate">{video.title}</p>
                      </Show>
                      <div class="flex items-center gap-2 flex-wrap mt-0.5">
                        <span class="text-xs font-mono text-[var(--color-muted)]">{video.youtube_id}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-muted)]">
                          {SOURCE_TYPES[video.source_type] ?? video.source_type}
                        </span>
                        <span class="text-[10px] text-[var(--color-muted)]">{formatDate(video.created_at)}</span>
                      </div>
                      <TuneChips entries={video.tune_video_entries} />
                    </div>
                  </div>

                  <div class="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-bg)] border-t border-[var(--color-border)] flex-wrap">
                    <button
                      onClick={() => togglePreview(video)}
                      class={`text-xs px-3 py-1.5 rounded-lg border transition-colors
                        ${isExpanded()
                          ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                          : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-white'}`}
                    >
                      {isExpanded() ? '▲ Hide' : '▶ Preview'}
                    </button>
                    <button
                      onClick={() => props.onEdit(video)}
                      disabled={isBusy()}
                      class="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-white hover:border-[var(--color-muted)]/50 transition-colors disabled:opacity-30"
                    >Edit</button>
                    <div class="flex-grow" />
                    <button
                      onClick={() => handleReject(video)}
                      disabled={isBusy()}
                      class="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30"
                    >{isBusy() ? '…' : '✕ Reject'}</button>
                    <button
                      onClick={() => handleApprove(video)}
                      disabled={isBusy()}
                      class="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-primary)]/50 bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 transition-colors disabled:opacity-30"
                    >{isBusy() ? '…' : '✓ Approve'}</button>
                  </div>

                  <Show when={isExpanded()}>
                    <div class="border-t border-[var(--color-border)] bg-[var(--color-bg)] p-4 flex flex-col gap-3">
                      <Show when={video.tune_video_entries.length > 1}>
                        <div class="flex gap-2 flex-wrap">
                          <For each={video.tune_video_entries}>
                            {(entry) => {
                              const isActive = () => previewEntry()?.id === entry.id;
                              return (
                                <button
                                  onClick={() => setPreviewEntry({ ...entry, youtube_id: video.youtube_id })}
                                  class={`text-xs px-3 py-1 rounded-full border transition-colors
                                    ${isActive()
                                      ? 'border-amber-500/60 bg-amber-500/10 text-amber-400'
                                      : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-white'}`}
                                >
                                  {entry.tune?.name ?? `Tune ${entry.position + 1}`}
                                  <span class="font-mono ml-1.5 opacity-50 text-[10px]">{formatTime(entry.start_sec)}</span>
                                </button>
                              );
                            }}
                          </For>
                        </div>
                      </Show>
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
    </>
  );
}

// ── Tab: Latest Approved ──────────────────────────────────────────────────────
function LatestApprovedTab(props) {
  const [videos, setVideos] = createSignal([]);
  const [loading, setLoading] = createSignal(true);
  const [actionId, setActionId] = createSignal(null);

  const load = async () => {
    setLoading(true);
    setVideos(enrichVideos(await getLatestApprovedVideos()));
    setLoading(false);
  };
  onMount(load);
  props.onRegisterRefresh(() => load());

  const handleDelete = async (video) => {
    if (!confirm(`¿Eliminar "${video.title || video.youtube_id}"? No se puede deshacer.`)) return;
    setActionId(video.id);
    try {
      await deleteVideo(video.id);
      setVideos(p => p.filter(v => v.id !== video.id));
    } finally { setActionId(null); }
  };

  return (
    <>
      <Show when={loading()}>
        <div class="flex items-center gap-3 py-16 justify-center">
          <div class="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <span class="text-sm text-[var(--color-muted)]">Loading…</span>
        </div>
      </Show>

      <Show when={!loading() && videos().length === 0}>
        <div class="text-center py-16 border border-dashed border-[var(--color-border)] rounded-xl">
          <p class="text-[var(--color-muted)] text-sm">No approved videos yet.</p>
        </div>
      </Show>

      <Show when={!loading()}>
        <div class="flex flex-col gap-2">
          <For each={videos()}>
            {(video) => (
              <VideoRow
                video={video}
                onEdit={props.onEdit}
                onDelete={handleDelete}
                actionId={actionId}
              />
            )}
          </For>
        </div>
      </Show>
    </>
  );
}

// ── Tab: Search by Tune ───────────────────────────────────────────────────────
function SearchByTuneTab(props) {
  const [tunes, setTunes] = createSignal([]);
  const [tunesLoading, setTunesLoading] = createSignal(true);
  const [selectedTuneId, setSelectedTuneId] = createSignal('');
  const [videos, setVideos] = createSignal([]);
  const [videosLoading, setVideosLoading] = createSignal(false);
  const [actionId, setActionId] = createSignal(null);

  onMount(async () => {
    setTunesLoading(true);
    const ids = await getTunesWithVideos();
    const enriched = ids
      .map(id => ({ tune_id: id, tune: getTuneById(id) }))
      .filter(t => t.tune)
      .sort((a, b) => a.tune.name.localeCompare(b.tune.name));
    setTunes(enriched);
    setTunesLoading(false);
  });

  const handleTuneChange = async (tuneId) => {
    setSelectedTuneId(tuneId);
    setVideos([]);
    if (!tuneId) return;
    setVideosLoading(true);
    setVideos(enrichVideos(await getVideosByTune(Number(tuneId))));
    setVideosLoading(false);
  };

  props.onRegisterRefresh(async () => {
    if (!selectedTuneId()) return;
    setVideosLoading(true);
    setVideos(enrichVideos(await getVideosByTune(Number(selectedTuneId()))));
    setVideosLoading(false);
  });

  const handleDelete = async (video) => {
    if (!confirm(`¿Eliminar "${video.title || video.youtube_id}"? No se puede deshacer.`)) return;
    setActionId(video.id);
    try {
      await deleteVideo(video.id);
      setVideos(p => p.filter(v => v.id !== video.id));
    } finally { setActionId(null); }
  };

  return (
    <div class="flex flex-col gap-4">
      <div>
        <Show when={tunesLoading()}>
          <div class="flex items-center gap-2 text-sm text-[var(--color-muted)]">
            <div class="w-4 h-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            Loading tunes…
          </div>
        </Show>
        <Show when={!tunesLoading()}>
          <select
            value={selectedTuneId()}
            onChange={e => handleTuneChange(e.target.value)}
            class="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-white focus:outline-none focus:border-[var(--color-primary)]/60"
          >
            <option value="">Select a tune…</option>
            <For each={tunes()}>
              {(t) => <option value={t.tune_id}>{t.tune.name}</option>}
            </For>
          </select>
        </Show>
      </div>

      <Show when={videosLoading()}>
        <div class="flex items-center gap-3 py-10 justify-center">
          <div class="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <span class="text-sm text-[var(--color-muted)]">Loading…</span>
        </div>
      </Show>

      <Show when={!videosLoading() && selectedTuneId() && videos().length === 0}>
        <div class="text-center py-10 border border-dashed border-[var(--color-border)] rounded-xl">
          <p class="text-[var(--color-muted)] text-sm">No approved videos for this tune.</p>
        </div>
      </Show>

      <Show when={!videosLoading() && videos().length > 0}>
        <div class="flex flex-col gap-2">
          <For each={videos()}>
            {(video) => (
              <VideoRow
                video={video}
                onEdit={props.onEdit}
                onDelete={handleDelete}
                actionId={actionId}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

// ── AdminView principal ──────────────────────────────────────────────────────
function AdminView(props) {
  const [tab, setTab] = createSignal('pending');
  const [editingVideo, setEditingVideo] = createSignal(null);
  const [pendingCount, setPendingCount] = createSignal(null);

  onMount(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  });

  let refreshLatest = () => {};
  let refreshByTune = () => {};

  const handleEditClose = () => {
    const wasEditing = editingVideo();
    setEditingVideo(null);
    if (wasEditing) {
      if (tab() === 'latest') refreshLatest();
      else if (tab() === 'byTune') refreshByTune();
    }
  };

  const TABS = [
    ['pending', 'Pending'],
    ['latest', 'Latest approved'],
    ['byTune', 'Search by tune'],
  ];

  return (
    <Show
      when={!editingVideo()}
      fallback={<AddVideoForm editVideo={editingVideo()} onClose={handleEditClose} />}
    >
      <div class="flex flex-col gap-5">

        {/* Header */}
        <div class="flex items-center justify-between">
          <h2 class="text-2xl font-black text-white">Admin</h2>
          <button
            onClick={props.onClose}
            class="text-sm text-[var(--color-muted)] hover:text-white transition-colors"
          >✕ Close</button>
        </div>

        {/* Tabs */}
        <div class="flex gap-1 border-b border-[var(--color-border)] pb-0">
          <For each={TABS}>
            {([key, label]) => (
              <button
                onClick={() => setTab(key)}
                class={`flex items-center gap-1.5 text-sm px-4 py-2 -mb-px border-b-2 transition-colors
                  ${tab() === key
                    ? 'border-[var(--color-primary)] text-white font-semibold'
                    : 'border-transparent text-[var(--color-muted)] hover:text-white'}`}
              >
                {label}
                <Show when={key === 'pending' && pendingCount() !== null && pendingCount() > 0}>
                  <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 leading-none">
                    {pendingCount()}
                  </span>
                </Show>
              </button>
            )}
          </For>
        </div>

        {/* Tab content */}
        <Show when={tab() === 'pending'}>
          <PendingTab
            onEdit={setEditingVideo}
            onCountLoaded={setPendingCount}
          />
        </Show>
        <Show when={tab() === 'latest'}>
          <LatestApprovedTab
            onEdit={setEditingVideo}
            onRegisterRefresh={(fn) => { refreshLatest = fn; }}
          />
        </Show>
        <Show when={tab() === 'byTune'}>
          <SearchByTuneTab
            onEdit={setEditingVideo}
            onRegisterRefresh={(fn) => { refreshByTune = fn; }}
          />
        </Show>

      </div>
    </Show>
  );
}

export default AdminView;
