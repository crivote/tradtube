/**
 * AddVideoForm.jsx
 * Formulario para añadir un vídeo de YouTube con su set de tunes.
 * Accesible solo para usuarios autenticados.
 *
 * Props: { onClose }
 */

import { createSignal, createMemo, createEffect, onCleanup, Show } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import { ExternalLink } from 'lucide-solid';
import { searchTunes, getTuneById, getSettings, findMatchingTunes } from '../lib/db';
import { addVideoWithEntries, updateVideoWithEntries, checkYoutubeIdExists } from '../lib/supabase';
import { resolveTrackTunes } from '../lib/thesession';
import { extractYoutubeId, parseSec, formatSec, cleanTitleForDisplay } from '../lib/utils';
import { useI18n } from '../i18n';
import { useAppStore } from '../store/appStore';
import TheSessionImportModal from './TheSessionImportModal';
import TuneEntriesEditor from './TuneEntriesEditor';

async function fetchYoutubeData(videoId) {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      title: data.title ?? null,
      channel: data.author_name ?? null,
    };
  } catch {
    return null;
  }
}

function AddVideoForm(props) {
  const { showToast } = useAppStore();
  const { t } = useI18n();
  const sourceTypeLabel = (key) => t(`sourceTypes.${key}`) ?? key;
  const instrumentLabel = (key) => t(`instruments.${key}`) ?? key;
  // Modo edición: props.editVideo contiene el vídeo existente
  const isEdit = () => !!props.editVideo;

  const initialEntries = props.editVideo
    ? [...(props.editVideo.tune_media_entries ?? [])]
        .sort((a, b) => a.position - b.position)
        .map(e => ({
          tune: getTuneById(e.tune_id) ?? { tune_id: e.tune_id, name: `Tune #${e.tune_id}`, type: '', meter: '' },
          startSec: formatSec(e.start_sec ?? 0),
          endSec: e.end_sec != null ? formatSec(e.end_sec) : '',
          instruments: e.instruments ?? [],
          key: e.key ?? null,
          structure: e.structure ?? null,
        }))
    : props.initialTune
      ? [{ tune: props.initialTune, startSec: '', endSec: '', instruments: [], key: null, structure: null }]
      : [];

  const [youtubeUrl, setYoutubeUrl] = createSignal(extractYoutubeId(props.editVideo?.media_uri) ?? '');
  const [sourceType, setSourceType] = createSignal(props.editVideo?.source_type ?? 'session');
  const [title, setTitle] = createSignal(props.editVideo?.title ?? '');
  const [channel, setChannel] = createSignal(props.editVideo?.channel ?? '');
  const [entries, setEntries] = createStore(initialEntries);
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal('');
  const [success, setSuccess] = createSignal(false);
  const [duplicate, setDuplicate] = createSignal(null); // null | { id, title, status }
  const [showImportModal, setShowImportModal] = createSignal(false);
  const [skippedTuneNames, setSkippedTuneNames] = createSignal([]);
  const [recordingId, setRecordingId] = createSignal(props.editVideo?.thesession_recording_id ?? null);
  const [unavailable, setUnavailable] = createSignal(props.editVideo?.unavailable ?? false);
  const [autoMatchedCount, setAutoMatchedCount] = createSignal(0);
  const [openInstrumentDropdown, setOpenInstrumentDropdown] = createSignal(null);
  const [videoDuration, setVideoDuration] = createSignal(0);

  let youtubeIframeRef;

  // Click outside to close instrument dropdown
  createEffect(() => {
    const idx = openInstrumentDropdown();
    if (idx === null) return;
    const handler = (e) => {
      if (!e.target.closest('[data-instrument-dropdown]')) {
        setOpenInstrumentDropdown(null);
      }
    };
    document.addEventListener('click', handler);
    onCleanup(() => document.removeEventListener('click', handler));
  });

  const youtubeId = createMemo(() => extractYoutubeId(youtubeUrl()));

  createEffect(() => {
    const id = youtubeId();
    if (!id || isEdit()) { setDuplicate(null); return; }
    const timer = setTimeout(async () => {
      const [data, existing] = await Promise.all([fetchYoutubeData(id), checkYoutubeIdExists(id)]);
      if (!data) { setDuplicate(existing ?? null); return; }
      
      setChannel(data.channel ?? '');

      // Only auto-match if user hasn't manually added entries yet
      const initialCount = props.initialTune ? 1 : 0;
      if (entries.length <= initialCount) {
        const existingIds = new Set(entries.map(e => e.tune.tune_id));
        const matchedTunes = findMatchingTunes(data.title, existingIds);
        
        if (matchedTunes.length > 0) {
          for (const tune of matchedTunes) {
            setEntries(produce(e => e.push({ tune, startSec: '', endSec: '', instruments: [], key: null, structure: null })));
          }
          setAutoMatchedCount(matchedTunes.length);
        }
        const cleanedTitle = cleanTitleForDisplay(data.title, matchedTunes);
        setTitle(cleanedTitle);
      }
      
      setDuplicate(existing ?? null);
    }, 400);
    onCleanup(() => clearTimeout(timer));
  });

  createEffect(() => {
    const ytId = youtubeId();
    if (!ytId) return;

    const handler = (event) => {
      if (!event.origin.startsWith('https://www.youtube.com')) return;
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'onReady') {
          if (youtubeIframeRef?.contentWindow) {
            youtubeIframeRef.contentWindow.postMessage(
              JSON.stringify({ event: 'command', func: 'getDuration', args: '' }),
              '*'
            );
          }
        } else if (data.event === 'infoDelivery' && data.info?.duration) {
          setVideoDuration(data.info.duration);
        }
      } catch {}
    };

    window.addEventListener('message', handler);
    onCleanup(() => window.removeEventListener('message', handler));
  });

  const handleSeekToTime = (seconds) => {
    const iframe = youtubeIframeRef;
    if (!iframe?.contentWindow) return;
    const dur = videoDuration();
    const target = seconds != null
      ? Math.max(0, seconds)
      : dur > 0 ? Math.max(0, dur - 2.5) : null;
    if (target == null) return;
    iframe.contentWindow.postMessage(
      JSON.stringify({ event: 'command', func: 'seekTo', args: [target, true] }),
      '*'
    );
  };

  const handleImportFromModal = (trackIdx, recordingData) => {
    const track = recordingData?.tracks?.[trackIdx];
    if (!track) return;

    // Add entries from track
    const resolved = resolveTrackTunes(track, getTuneById);
    const existing = new Set(entries.map(e => e.tune.tune_id));
    const skipped = [];
    for (const r of resolved) {
      if (r.unresolvable) { skipped.push(r.name); continue; }
      if (existing.has(r.tune.tune_id)) continue;
      setEntries(produce(e => e.push({ tune: r.tune, startSec: '', endSec: '', instruments: [], key: null, structure: null })));
      existing.add(r.tune.tune_id);
    }
    setSkippedTuneNames(skipped);

    // Set title and source type
    const artist = recordingData?.artist?.name ?? '';
    const album  = recordingData?.name ?? '';
    const parts  = [artist, album, `Track ${trackIdx + 1}`].filter(Boolean);
    setTitle(parts.join(' - '));
    setSourceType('album');
    setRecordingId(recordingData?.id ?? null);

    setShowImportModal(false);
  };

  const handleSubmit = async () => {
    if (!youtubeId()) { setError(t('addVideo.enterValidUrl')); return; }
    if (entries.length === 0) { setError(t('addVideo.addOneTune')); return; }

    setSubmitting(true);
    setError('');
    try {
      const entryPayload = entries.map((e, i) => ({
        tune_id: e.tune.tune_id,
        start_sec: parseSec(e.startSec) ?? 0,
        end_sec: parseSec(e.endSec) ?? null,
        position: i,
        instruments: e.instruments?.length > 0 ? e.instruments : null,
        key: e.key || null,
        structure: e.structure || null,
      }));

      if (isEdit()) {
        await updateVideoWithEntries(props.editVideo.id, {
          source_type: sourceType(),
          title: title().trim() || null,
          channel: channel().trim() || null,
          thesession_recording_id: recordingId(),
          unavailable: unavailable(),
          entries: entryPayload,
        });
      } else {
        await addVideoWithEntries({
          youtube_id: youtubeId(),
          source_type: sourceType(),
          title: title().trim() || null,
          channel: channel().trim() || null,
          thesession_recording_id: recordingId(),
          entries: entryPayload,
        });
      }
      setSuccess(true);
    } catch (err) {
      setError(err.message ?? '');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setYoutubeUrl('');
    setSourceType('session');
    setEntries(produce(e => { e.splice(0, e.length); }));
    setTitle('');
    setError('');
    setSuccess(false);
    setSkippedTuneNames([]);
    setRecordingId(null);
    setDuplicate(null);
  };

  return (
    <div class="flex flex-col gap-6 max-w-2xl mx-auto">

      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-black text-[var(--color-text)]">
            {isEdit() ? t('addVideo.editTitle') : t('addVideo.addTitle')}
          </h2>
          <p class="text-sm text-[var(--color-muted)] mt-0.5">
            {isEdit()
              ? t('addVideo.editing', { id: extractYoutubeId(props.editVideo.media_uri) })
              : t('addVideo.addDesc')}
          </p>
        </div>
        <button
          onClick={props.onClose}
          class="text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          {t('addVideo.close')}
        </button>
      </div>

      {/* Success */}
      <Show when={success()}>
        <div class="rounded-xl border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/10 px-4 py-4 flex items-center justify-between gap-4">
          <p class="text-sm text-[var(--color-primary)] font-semibold">
            {isEdit() ? t('addVideo.updated') : t('addVideo.saved')}
          </p>
          <button
            onClick={handleReset}
            class="text-xs text-[var(--color-primary)] underline hover:no-underline"
          >
            {t('addVideo.addAnother')}
          </button>
        </div>
      </Show>

      <Show when={!success()}>

        {/* ── YouTube URL ──────────────────────────────────────────────── */}
        <div class="flex flex-col gap-2">
          <label class="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
            {t('addVideo.youtubeLabel')}
          </label>
          <input
            type="text"
            placeholder={t('addVideo.youtubePlaceholder')}
            value={youtubeUrl()}
            onInput={e => setYoutubeUrl(e.target.value)}
            disabled={isEdit()}
            class="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)] transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <Show when={youtubeUrl() && !youtubeId()}>
            <p class="text-xs text-[var(--color-error)]">{t('addVideo.invalidId')}</p>
          </Show>
        </div>

        {/* Duplicate warning */}
        <Show when={duplicate()}>
          <div class="rounded-xl border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 px-4 py-3 flex items-start gap-3">
            <span class="text-[var(--color-warning)] text-base flex-shrink-0">⚠</span>
            <div class="text-sm">
              <p class="text-[var(--color-warning)] font-semibold">{t('addVideo.duplicateTitle')}</p>
              <p class="text-[var(--color-warning)]/80 text-xs mt-0.5">
                "{duplicate().title || duplicate().id}" —{' '}
                <span class={`font-medium ${duplicate().status === 'reviewed' ? 'text-green-400' : 'text-[var(--color-warning)]'}`}>
                  {duplicate().status}
                </span>
              </p>
              <p class="text-[var(--color-muted)] text-xs mt-1">
                {t('addVideo.duplicateBlocked')}
                <Show when={duplicate().tune_id && duplicate().status === 'reviewed'}>
                  {' '}<a href={`/tune/${duplicate().tune_id}`} class="underline hover:text-[var(--color-primary)]">{t('addVideo.viewTune')}</a>
                </Show>
              </p>
            </div>
          </div>
        </Show>

        {/* Preview */}
        <Show when={youtubeId()}>
          <div class="rounded-xl overflow-hidden border border-[var(--color-border)] aspect-video bg-black">
            <iframe
              ref={el => { youtubeIframeRef = el; }}
              src={`https://www.youtube.com/embed/${youtubeId()}?enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
              class="w-full h-full"
              allowfullscreen
              title="YouTube video preview"
            />
          </div>
        </Show>

        {/* ── Channel + Title ───────────────────────────────────────────── */}
        <div class="flex flex-col gap-2">
          <label class="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
            {t('addVideo.channel')}
            <Show when={youtubeId() && !channel()}>
              <span class="ml-2 text-[var(--color-muted)]/50 normal-case font-normal">{t('addVideo.fetching')}</span>
            </Show>
          </label>
          <input
            type="text"
            placeholder={t('addVideo.channelPlaceholder')}
            value={channel()}
            onInput={e => setChannel(e.target.value)}
            class="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)] transition-colors text-sm"
          />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
            {t('addVideo.title')}
            <Show when={youtubeId() && !title()}>
              <span class="ml-2 text-[var(--color-muted)]/50 normal-case font-normal">{t('addVideo.fetching')}</span>
            </Show>
          </label>
          <input
            type="text"
            placeholder={t('addVideo.titlePlaceholder')}
            value={title()}
            onInput={e => setTitle(e.target.value)}
            class="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)] transition-colors text-sm"
          />
        </div>

        {/* ── Source type ──────────────────────────────────────────────── */}
        <div class="flex flex-col gap-2">
          <label class="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
            {t('addVideo.sourceType')}
          </label>
          <select
            value={sourceType()}
            onChange={e => setSourceType(e.target.value)}
            class="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] transition-colors text-sm appearance-none cursor-pointer"
          >
            {['studio', 'album', 'live_concert', 'tv_broadcast', 'session', 'tutorial', 'casual'].map(key => (
              <option value={key}>{sourceTypeLabel(key)}</option>
            ))}
          </select>
        </div>

        {/* ── TheSession recording ID ─────────────────────────────────── */}
        <div class="flex flex-col gap-2">
          <label class="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
            {t('addVideo.thesessionRecordingId')}
          </label>
          <input
            type="text"
            placeholder={t('addVideo.thesessionRecordingIdPlaceholder')}
            value={recordingId() ?? ''}
            onInput={e => setRecordingId(e.target.value ? parseInt(e.target.value, 10) : null)}
            class="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)] transition-colors text-sm"
          />
          <Show when={recordingId()}>
            <a
              href={`https://thesession.org/recordings/${recordingId()}`}
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs text-[var(--color-primary)] hover:underline flex items-center gap-1 w-fit"
            >
              <ExternalLink size={12} />
              View on TheSession
            </a>
          </Show>
        </div>

        {/* ── Unavailable toggle (edit only) ─────────────────────────── */}
        <Show when={isEdit()}>
          <label class="flex items-center gap-3 cursor-pointer select-none">
            <button
              type="button"
              role="switch"
              aria-checked={unavailable()}
              onClick={() => setUnavailable(v => !v)}
              class={`relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none
                ${unavailable() ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-border)]'}`}
            >
              <span class={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200
                ${unavailable() ? 'translate-x-4' : 'translate-x-0'}`}
              />
            </button>
            <div class="flex flex-col">
              <span class="text-sm text-[var(--color-text)]">{t('addVideo.unavailable')}</span>
              <span class="text-xs text-[var(--color-muted)]">{t('addVideo.unavailableDesc')}</span>
            </div>
          </label>
        </Show>

        {/* ── TheSession recording import ──────────────────────────────── */}
        <div class="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            class="w-full py-2.5 rounded-xl text-sm border border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-primary)]/50 hover:text-[var(--color-primary)] transition-colors"
          >
            {t('addVideo.importTracklist')}
          </button>
          <Show when={skippedTuneNames().length > 0}>
            <p class="text-xs text-[var(--color-warning)]/80 bg-[var(--color-warning)]/5 border border-[var(--color-warning)]/20 rounded-lg px-3 py-2">
              {t('addVideo.skipped', { tunes: skippedTuneNames().join(', ') })}
            </p>
          </Show>
        </div>

        {/* ── Tunes in this video ──────────────────────────────────────── */}
        <TuneEntriesEditor
          entries={entries}
          onAdd={(tune) => setEntries(produce(e => e.push({ tune, startSec: '', endSec: '', instruments: [], key: null, structure: null })))}
          onRemove={(i) => {
            const removed = entries[i];
            setEntries(produce(e => e.splice(i, 1)));
            if (removed) {
              showToast(t('addVideo.removed', { name: removed.tune?.name || 'Tune' }), 'info', 4000, {
                label: t('admin.undo'),
                onClick: () => {
                  setEntries(produce(e => { e.splice(i, 0, removed); }));
                },
              });
            }
          }}
          onUpdate={(i, field, value) => setEntries(i, field, value)}
          onSeekToTime={handleSeekToTime}
        />

        <Show when={autoMatchedCount() > 0}>
            <p class="text-xs text-[var(--color-primary)] bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 rounded-lg px-3 py-2">
              {autoMatchedCount() > 1
                ? t('addVideo.autoMatchedPlural', { count: autoMatchedCount() })
                : t('addVideo.autoMatched', { count: autoMatchedCount() })}
            </p>
          </Show>

        {/* ── Error ────────────────────────────────────────────────────── */}
        <Show when={error()}>
          <p class="text-sm text-[var(--color-error)] bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 rounded-xl px-4 py-3">
            {error()}
          </p>
        </Show>

        {/* ── Submit ───────────────────────────────────────────────────── */}
        <div class="flex gap-3">
          <button
            onClick={props.onClose}
            disabled={submitting()}
            class="flex-1 py-3 rounded-xl font-semibold text-sm transition-all
              border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-muted)]/50
              disabled:opacity-30"
          >
            {t('addVideo.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting() || !youtubeId() || entries.length === 0 || !!duplicate()}
            class="flex-1 py-3 rounded-xl font-semibold text-sm transition-all
              bg-[var(--color-primary)] text-black hover:opacity-90
              disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {submitting() ? t('addVideo.saving') : isEdit() ? t('addVideo.update') : t('addVideo.save')}
          </button>
        </div>
        <Show when={!submitting()}>
          <p class="text-center text-[10px] text-[var(--color-muted)] -mt-1">
            {duplicate() ? t('addVideo.alreadyRegistered') :
             entries.length === 0 ? t('addVideo.addOneTune') :
              !youtubeId() ? t('addVideo.enterValidUrl') : ''}
          </p>
        </Show>

      </Show>
      <Show when={showImportModal()}>
        <TheSessionImportModal
          onImport={handleImportFromModal}
          onClose={() => setShowImportModal(false)}
        />
      </Show>
    </div>
  );
}

export default AddVideoForm;
