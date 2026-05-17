/**
 * AdminView.jsx
 * Panel de administración con tres tabs:
 *   - Pending: vídeos pendientes (badge con count)
 *   - Latest approved: últimos 20 vídeos aprobados
 *   - Search by tune: vídeos filtrados por tune
 */

import { createSignal, createEffect, onMount, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import {
  getPendingVideos,
  getLatestApprovedVideos, getVideosByTune,
  approveVideo, deleteVideo,
  getReports, updateReport, getPendingReportsCount,
} from '../lib/supabase';
import { getTuneById, searchTunes } from '../lib/db';
import { formatTime } from '../lib/utils';
import { useI18n } from '../i18n';
import YoutubePlayer from './YoutubePlayer';
import AddVideoForm from './AddVideoForm';
import { useAppStore } from '../store/appStore';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

const STATUS_STYLE = {
  approved: 'text-green-400 border-green-400/30 bg-green-400/10',
  pending:  'text-[var(--color-warning)] border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10',
  rejected: 'text-[var(--color-error)] border-[var(--color-error)]/30 bg-[var(--color-error)]/10',
};

const REPORT_STATUS_STYLE = {
  pending:   'text-[var(--color-warning)] border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10',
  tracking:  'text-blue-400 border-blue-400/30 bg-blue-400/10',
  solved:    'text-green-400 border-green-400/30 bg-green-400/10',
  discarded: 'text-[var(--color-error)] border-[var(--color-error)]/30 bg-[var(--color-error)]/10',
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
  const { t } = useI18n();
  const isBusy = () => actionId() === video.id;
  const statusLabels = { approved: t('admin.statusApproved'), pending: t('admin.statusPending'), rejected: t('admin.statusRejected') };
  return (
    <div class="flex items-start gap-4 p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl">
      <img
        src={`https://img.youtube.com/vi/${video.youtube_id}/mqdefault.jpg`}
        alt="" class="w-24 h-14 object-cover rounded-lg flex-shrink-0 bg-[var(--color-border)]"
      />
      <div class="flex-grow min-w-0">
        <Show when={video.title}>
          <p class="text-sm text-[var(--color-text)] font-semibold truncate">{video.title}</p>
        </Show>
        <div class="flex items-center gap-2 flex-wrap mt-0.5">
          <span class="text-xs font-mono text-[var(--color-muted)]">{video.youtube_id}</span>
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-muted)]">
            {t(`sourceTypes.${video.source_type}`) ?? video.source_type}
          </span>
          <span class={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_STYLE[video.status] ?? ''}`}>
            {statusLabels[video.status] ?? video.status}
          </span>
          <span class="text-[10px] text-[var(--color-muted)]">{formatDate(video.created_at)}</span>
        </div>
        <TuneChips entries={video.tune_video_entries} />
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => onEdit(video)}
          disabled={isBusy()}
          class="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]/50 transition-colors disabled:opacity-30"
        >{t('admin.edit')}</button>
        <button
          onClick={() => onDelete(video)}
          disabled={isBusy()}
          class="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-error)]/30 text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-colors disabled:opacity-30"
        >{isBusy() ? '…' : '✕'}</button>
      </div>
    </div>
  );
}

// ── Tab: Pending ─────────────────────────────────────────────────────────────
function PendingTab(props) {
  const { loadVideoData, showToast } = useAppStore();
  const { t } = useI18n();
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
      showToast(t('admin.approved', { id: video.youtube_id }), 'success', 4000, {
        label: t('admin.undo'),
        onClick: async () => {
          await deleteVideo(video.id);
          setVideos(prev => [video, ...prev]);
          props.onCountLoaded(videos().length + 1);
          loadVideoData();
          showToast(t('admin.approvalUndone'), 'info');
        },
      });
    } catch {
      showToast(t('admin.failApprove'), 'error');
    } finally { setActionId(null); }
  };

  const handleReject = async (video) => {
    setActionId(video.id);
    try {
      await deleteVideo(video.id);
      const next = videos().filter(v => v.id !== video.id);
      setVideos(next);
      props.onCountLoaded(next.length);
      if (expandedId() === video.id) { setExpandedId(null); setPreviewEntry(null); }
      showToast(t('admin.deleted', { id: video.youtube_id }), 'warning', 4000, {
        label: t('admin.undo'),
        onClick: async () => {
          await approveVideo(video.id);
          setVideos(prev => [video, ...prev]);
          props.onCountLoaded(videos().length + 1);
          showToast(t('admin.deletionUndone'), 'info');
        },
      });
    } catch {
      showToast(t('admin.failDelete'), 'error');
    } finally { setActionId(null); }
  };

  return (
    <>
      <Show when={loading()}>
        <div class="flex items-center gap-3 py-16 justify-center">
          <div class="w-5 h-5 border-2 border-[var(--color-warning)] border-t-transparent rounded-full animate-spin" />
          <span class="text-sm text-[var(--color-muted)]">{t('admin.loading')}</span>
        </div>
      </Show>

      <Show when={!loading() && videos().length === 0}>
        <div class="text-center py-16 border border-dashed border-[var(--color-border)] rounded-xl">
          <p class="text-2xl mb-2">✓</p>
          <p class="text-[var(--color-muted)] text-sm">{t('admin.noPending')}</p>
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
                  ${isExpanded() ? 'border-[var(--color-warning)]/40' : 'border-[var(--color-border)]'}`}>

                  <div class="flex items-start gap-4 p-4 bg-[var(--color-surface)]">
                    <img
                      src={`https://img.youtube.com/vi/${video.youtube_id}/mqdefault.jpg`}
                      alt="" class="w-28 h-16 object-cover rounded-lg flex-shrink-0 bg-[var(--color-border)]"
                    />
                    <div class="flex-grow min-w-0">
                      <Show when={video.title}>
                        <p class="text-sm text-[var(--color-text)] font-semibold truncate">{video.title}</p>
                      </Show>
                      <div class="flex items-center gap-2 flex-wrap mt-0.5">
                        <span class="text-xs font-mono text-[var(--color-muted)]">{video.youtube_id}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-muted)]">
                          {t(`sourceTypes.${video.source_type}`) ?? video.source_type}
                        </span>
          <span class="text-[10px] text-[var(--color-muted)]">{formatDate(video.created_at)}</span>
          <Show when={video.unavailable}>
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-warning)]/15 text-[var(--color-warning)] border border-[var(--color-warning)]/30">
              {t('addVideo.unavailable')}
            </span>
          </Show>
                      </div>
                      <TuneChips entries={video.tune_video_entries} />
                    </div>
                  </div>

                  <div class="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-bg)] border-t border-[var(--color-border)] flex-wrap">
                    <button
                      onClick={() => togglePreview(video)}
                      class={`text-xs px-3 py-1.5 rounded-lg border transition-colors
                        ${isExpanded()
                          ? 'border-[var(--color-warning)]/50 bg-[var(--color-warning)]/10 text-[var(--color-warning)]'
                          : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'}`}
                    >
                      {isExpanded() ? t('admin.hide') : t('admin.preview')}
                    </button>
                    <button
                      onClick={() => props.onEdit(video)}
                      disabled={isBusy()}
                      class="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-muted)]/50 transition-colors disabled:opacity-30"
                    >{t('admin.edit')}</button>
                    <div class="flex-grow" />
                    <button
                      onClick={() => handleReject(video)}
                      disabled={isBusy()}
                      class="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-error)]/30 text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-colors disabled:opacity-30"
                    >{isBusy() ? '…' : t('admin.reject')}</button>
                    <button
                      onClick={() => handleApprove(video)}
                      disabled={isBusy()}
                      class="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-primary)]/50 bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 transition-colors disabled:opacity-30"
                    >{isBusy() ? '…' : t('admin.approve')}</button>
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
                                      ? 'border-[var(--color-warning)]/60 bg-[var(--color-warning)]/10 text-[var(--color-warning)]'
                                      : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'}`}
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
  const { t } = useI18n();
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
    if (!confirm(`Delete "${video.title || video.youtube_id}"? This cannot be undone.`)) return;
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
          <span class="text-sm text-[var(--color-muted)]">{t('admin.loading')}</span>
        </div>
      </Show>

      <Show when={!loading() && videos().length === 0}>
        <div class="text-center py-16 border border-dashed border-[var(--color-border)] rounded-xl">
          <p class="text-[var(--color-muted)] text-sm">{t('admin.noApproved')}</p>
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
  const { videoCountsByTune } = useAppStore();
  const { t } = useI18n();
  const [query, setQuery] = createSignal('');
  const [results, setResults] = createSignal([]);
  const [selectedTune, setSelectedTune] = createSignal(null);
  const [videos, setVideos] = createSignal([]);
  const [videosLoading, setVideosLoading] = createSignal(false);
  const [actionId, setActionId] = createSignal(null);

  createEffect(() => {
    const q = query().trim();
    if (q.length < 2) { setResults([]); return; }
    const raw = searchTunes(q, 20);
    setResults(raw.filter(t => videoCountsByTune().has(t.tune_id)));
  });

  const handleSelect = async (tune) => {
    setSelectedTune(tune);
    setQuery('');
    setResults([]);
    setVideos([]);
    setVideosLoading(true);
    setVideos(enrichVideos(await getVideosByTune(tune.tune_id)));
    setVideosLoading(false);
  };

  props.onRegisterRefresh(async () => {
    if (!selectedTune()) return;
    setVideosLoading(true);
    setVideos(enrichVideos(await getVideosByTune(selectedTune().tune_id)));
    setVideosLoading(false);
  });

  const handleDelete = async (video) => {
    if (!confirm(`Delete "${video.title || video.youtube_id}"? This cannot be undone.`)) return;
    setActionId(video.id);
    try {
      await deleteVideo(video.id);
      setVideos(p => p.filter(v => v.id !== video.id));
    } finally { setActionId(null); }
  };

  return (
    <div class="flex flex-col gap-4">

      {/* ── Search input with dropdown ───────────────────────────── */}
      <div class="relative">
        <input
          type="text"
          placeholder={t('admin.searchPlaceholder')}
          value={query()}
          onInput={e => setQuery(e.target.value)}
          class="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)] transition-colors text-sm"
        />
        <Show when={results().length > 0}>
          <div class="absolute top-full left-0 right-0 mt-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden z-10 flex flex-col shadow-lg">
            <For each={results()}>
              {(tune) => (
                <button
                  onClick={() => handleSelect(tune)}
                  class="text-left px-4 py-2.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-primary)]/10 transition-colors border-b border-[var(--color-border)] last:border-0"
                >
                  {tune.name}
                  <span class="text-[10px] text-[var(--color-muted)] ml-2 uppercase tracking-wider">{tune.type}</span>
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* ── Selected tune label ──────────────────────────────────── */}
      <Show when={selectedTune()}>
        <p class="text-xs text-[var(--color-muted)] -mt-2">
          {t('admin.videosFor', { name: selectedTune().name })}
        </p>
      </Show>

      <Show when={videosLoading()}>
        <div class="flex items-center gap-3 py-10 justify-center">
          <div class="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <span class="text-sm text-[var(--color-muted)]">{t('admin.loading')}</span>
        </div>
      </Show>

      <Show when={!videosLoading() && selectedTune() && videos().length === 0}>
        <div class="text-center py-10 border border-dashed border-[var(--color-border)] rounded-xl">
          <p class="text-[var(--color-muted)] text-sm">{t('admin.noApprovedTune')}</p>
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

// ── Tab: Reports ─────────────────────────────────────────────────────────────
function ReportsTab(props) {
  const { t } = useI18n();
  const [reports, setReports] = createSignal([]);
  const [loading, setLoading] = createSignal(true);
  const [statusFilter, setStatusFilter] = createSignal('');
  const [actionId, setActionId] = createSignal(null);
  const [expandedId, setExpandedId] = createSignal(null);

  const load = async (status) => {
    setLoading(true);
    const data = await getReports(status || undefined);
    setReports(data);
    if (!status) props.onCountLoaded?.(data.filter(r => r.status === 'pending').length);
    setLoading(false);
  };
  onMount(() => {
    load();
    props.onRegisterRefresh?.(() => load(statusFilter() || undefined));
  });

  createEffect(() => {
    const s = statusFilter();
    load(s || undefined);
  });

  const handleStatusUpdate = async (reportId, newStatus) => {
    setActionId(reportId);
    try {
      await updateReport(reportId, { status: newStatus });
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: newStatus, closed_at: newStatus === 'solved' || newStatus === 'discarded' ? new Date().toISOString() : r.closed_at } : r));
    } catch { /* ignore */ }
    finally { setActionId(null); }
  };

  const reportTypeLabel = (type) => t(`report.types.${type}`) ?? type;
  const reportStatusLabel = (status) => t(`report.status.${status}`) ?? status;

  return (
    <div class="flex flex-col gap-4">
      {/* Status filter */}
      <div class="flex gap-1.5 flex-wrap">
        <button
          onClick={() => setStatusFilter('')}
          class={`text-xs px-3 py-1 rounded-lg border transition-colors
            ${!statusFilter()
              ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
              : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'}`}
        >{t('report.all')}</button>
        {['pending', 'tracking', 'solved', 'discarded'].map(s => (
          <button
            onClick={() => setStatusFilter(s)}
            class={`text-xs px-3 py-1 rounded-lg border transition-colors
              ${statusFilter() === s
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'}`}
          >{reportStatusLabel(s)}</button>
        ))}
      </div>

      <Show when={loading()}>
        <div class="flex items-center gap-3 py-16 justify-center">
          <div class="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <span class="text-sm text-[var(--color-muted)]">{t('admin.loading')}</span>
        </div>
      </Show>

      <Show when={!loading() && reports().length === 0}>
        <div class="text-center py-16 border border-dashed border-[var(--color-border)] rounded-xl">
          <p class="text-[var(--color-muted)] text-sm">{t('report.noReports')}</p>
        </div>
      </Show>

      <Show when={!loading() && reports().length > 0}>
        <div class="flex flex-col gap-3">
          <For each={reports()}>
            {(report) => {
              const isExpanded = () => expandedId() === report.id;
              const isBusy = () => actionId() === report.id;
              return (
                <div class={`border rounded-xl overflow-hidden transition-colors
                  ${isExpanded() ? 'border-[var(--color-primary)]/40' : 'border-[var(--color-border)]'}
                  bg-[var(--color-surface)]`}>
                  <div class="flex items-start gap-3 p-4">
                    <div class="flex-grow min-w-0">
                      <div class="flex items-center gap-2 flex-wrap mb-1">
                        <span class="text-sm font-semibold text-[var(--color-text)]">
                          {reportTypeLabel(report.issue_type)}
                        </span>
                        <span class={`text-[10px] px-2 py-0.5 rounded-full border ${REPORT_STATUS_STYLE[report.status] ?? ''}`}>
                          {reportStatusLabel(report.status)}
                        </span>
                      </div>
                      <Show when={report.tune_videos}>
                        <div class="text-xs text-[var(--color-muted)] flex items-center gap-2 flex-wrap">
                          <Show when={report.tune_videos.title}>
                            <span class="truncate max-w-[200px]">{report.tune_videos.title}</span>
                          </Show>
                          <span class="font-mono">{report.tune_videos.youtube_id}</span>
                          <a
                            href={`https://www.youtube.com/watch?v=${report.tune_videos.youtube_id}`}
                            target="_blank" rel="noopener noreferrer"
                            class="text-[var(--color-primary)] hover:underline"
                          >{t('report.viewVideo')}</a>
                          <Show when={props.onEdit}>
                            <button
                              onClick={() => props.onEdit(report.tune_videos)}
                              class="text-xs px-2 py-0.5 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]/50 transition-colors"
                            >{t('admin.edit')}</button>
                          </Show>
                        </div>
                      </Show>
                      <Show when={report.email}>
                        <p class="text-[10px] text-[var(--color-muted)] mt-1">{report.email}</p>
                      </Show>
                      <div class="text-[10px] text-[var(--color-muted)]/60 mt-1">
                        {formatDate(report.created_at)}
                        <Show when={report.closed_at}>
                          <span class="ml-2">{t('report.closed')} {formatDate(report.closed_at)}</span>
                        </Show>
                      </div>
                    </div>
                    <div class="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => setExpandedId(isExpanded() ? null : report.id)}
                        class="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
                      >{isExpanded() ? t('admin.hide') : t('report.details')}</button>
                    </div>
                  </div>

                  <Show when={isExpanded()}>
                    <div class="border-t border-[var(--color-border)] bg-[var(--color-bg)] p-4 flex flex-col gap-3">
                      <Show when={report.description}>
                        <div>
                          <p class="text-xs font-semibold text-[var(--color-muted)] mb-1">{t('report.description')}</p>
                          <p class="text-sm text-[var(--color-text)] whitespace-pre-wrap">{report.description}</p>
                        </div>
                      </Show>

                      <div>
                        <p class="text-xs font-semibold text-[var(--color-muted)] mb-2">{t('report.updateStatus')}</p>
                        <div class="flex gap-1.5 flex-wrap">
                          {['pending', 'tracking', 'solved', 'discarded'].map(s => (
                            <button
                              onClick={() => handleStatusUpdate(report.id, s)}
                              disabled={isBusy() || report.status === s}
                              class={`text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-30
                                ${report.status === s
                                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                                  : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'}`}
                            >{reportStatusLabel(s)}</button>
                          ))}
                        </div>
                      </div>

                      <Show when={report.admin_comments}>
                        <div>
                          <p class="text-xs font-semibold text-[var(--color-muted)] mb-1">{t('report.adminComments')}</p>
                          <p class="text-sm text-[var(--color-muted)] whitespace-pre-wrap">{report.admin_comments}</p>
                        </div>
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
  );
}

// ── AdminView principal ──────────────────────────────────────────────────────
function AdminView() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { authUser, authInitialized } = useAppStore();
  const [tab, setTab] = createSignal('pending');
  const [editingVideo, setEditingVideo] = createSignal(null);
  const [pendingCount, setPendingCount] = createSignal(null);
  const [pendingReportsCount, setPendingReportsCount] = createSignal(null);

  createEffect(() => {
    if (authInitialized() && !authUser()?.isAdmin) navigate('/', { replace: true });
  });

  onMount(() => {
    getPendingReportsCount().then(setPendingReportsCount);
  });

  let refreshLatest = () => {};
  let refreshByTune = () => {};
  let refreshReports = () => {};

  const handleEditClose = () => {
    const wasEditing = editingVideo();
    setEditingVideo(null);
    if (wasEditing) {
      if (tab() === 'latest') refreshLatest();
      else if (tab() === 'byTune') refreshByTune();
      else if (tab() === 'reports') refreshReports();
    }
  };

  const TABS = [
    ['pending', t('admin.pending')],
    ['latest', t('admin.latestApproved')],
    ['byTune', t('admin.searchByTune')],
    ['reports', t('admin.reports')],
  ];

  return (
    <Show
      when={!editingVideo()}
      fallback={<AddVideoForm editVideo={editingVideo()} onClose={handleEditClose} />}
    >
      <div class="flex flex-col gap-5">

        {/* Header */}
        <div class="flex items-center justify-between">
          <h2 class="text-2xl font-black text-[var(--color-text)]">{t('admin.title')}</h2>
          <button
            onClick={() => navigate('/')}
            class="text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
          >{t('admin.close')}</button>
        </div>

        {/* Tabs */}
        <div class="flex gap-1 border-b border-[var(--color-border)] pb-0">
          <For each={TABS}>
            {([key, label]) => (
              <button
                onClick={() => setTab(key)}
                class={`flex items-center gap-1.5 text-sm px-4 py-2 -mb-px border-b-2 transition-colors
                  ${tab() === key
                    ? 'border-[var(--color-primary)] text-[var(--color-text)] font-semibold'
                    : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'}`}
              >
                {label}
                <Show when={key === 'pending' && pendingCount() !== null && pendingCount() > 0}>
                  <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--color-warning)]/20 text-[var(--color-warning)] border border-[var(--color-warning)]/30 leading-none">
                    {pendingCount()}
                  </span>
                </Show>
                <Show when={key === 'reports' && pendingReportsCount() !== null && pendingReportsCount() > 0}>
                  <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--color-warning)]/20 text-[var(--color-warning)] border border-[var(--color-warning)]/30 leading-none">
                    {pendingReportsCount()}
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
        <Show when={tab() === 'reports'}>
          <ReportsTab onEdit={setEditingVideo} onCountLoaded={setPendingReportsCount} onRegisterRefresh={(fn) => { refreshReports = fn; }} />
        </Show>

      </div>
    </Show>
  );
}

export default AdminView;
