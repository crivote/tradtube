/**
 * AddVideoForm.jsx
 * Formulario para añadir un vídeo de YouTube con su set de tunes.
 * Accesible solo para usuarios autenticados.
 *
 * Props: { onClose }
 */

import { createSignal, createMemo, createEffect, onCleanup, For, Show } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import { searchTunes, getTuneById, getSettings } from '../lib/db';
import { addVideoWithEntries, updateVideoWithEntries, checkYoutubeIdExists } from '../lib/supabase';
import { resolveTrackTunes } from '../lib/thesession';
import { extractYoutubeId, parseSec, formatSec, validateTimestamp, cleanTitleForDisplay, findMatchingTunes } from '../lib/utils';
import { useI18n } from '../i18n';
import { useAppStore } from '../store/appStore';
import TheSessionImportModal from './TheSessionImportModal';

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
    ? [...(props.editVideo.tune_video_entries ?? [])]
        .sort((a, b) => a.position - b.position)
        .map(e => ({
          tune: getTuneById(e.tune_id) ?? { tune_id: e.tune_id, name: `Tune #${e.tune_id}`, type: '', meter: '' },
          startSec: formatSec(e.start_sec ?? 0),
          endSec: e.end_sec != null ? formatSec(e.end_sec) : '',
          instruments: e.instruments ?? [],
          key: e.key ?? null,
        }))
    : props.initialTune
      ? [{ tune: props.initialTune, startSec: '', endSec: '', instruments: [], key: null }]
      : [];

  const [youtubeUrl, setYoutubeUrl] = createSignal(props.editVideo?.youtube_id ?? '');
  const [sourceType, setSourceType] = createSignal(props.editVideo?.source_type ?? 'session');
  const [title, setTitle] = createSignal(props.editVideo?.title ?? '');
  const [channel, setChannel] = createSignal(props.editVideo?.channel ?? '');
  const [entries, setEntries] = createStore(initialEntries);
  const [tuneSearch, setTuneSearch] = createSignal('');
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal('');
  const [success, setSuccess] = createSignal(false);
  const [duplicate, setDuplicate] = createSignal(null); // null | { id, title, status }
  const [showImportModal, setShowImportModal] = createSignal(false);
  const [skippedTuneNames, setSkippedTuneNames] = createSignal([]);
  const [recordingId, setRecordingId] = createSignal(props.editVideo?.thesession_recording_id ?? null);
  const [autoMatchedCount, setAutoMatchedCount] = createSignal(0);
  const [openInstrumentDropdown, setOpenInstrumentDropdown] = createSignal(null);

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
            setEntries(produce(e => e.push({ tune, startSec: '', endSec: '', instruments: [], key: null })));
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

  const tuneResults = createMemo(() => {
    const q = tuneSearch().trim();
    if (q.length < 2) return [];
    // Excluir tunes ya añadidas
    const added = new Set(entries.map(e => e.tune.tune_id));
    return searchTunes(q, 8).filter(t => !added.has(t.tune_id));
  });

  const addEntry = (tune) => {
    setEntries(produce(e => e.push({ tune, startSec: '', endSec: '', instruments: [], key: null })));
    setTuneSearch('');
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
      setEntries(produce(e => e.push({ tune: r.tune, startSec: '', endSec: '', instruments: [], key: null })));
      existing.add(r.tune.tune_id);
    }
    setSkippedTuneNames(skipped);
    setTuneSearch('');

    // Set title and source type
    const artist = recordingData?.artist?.name ?? '';
    const album  = recordingData?.name ?? '';
    const parts  = [artist, album, `Track ${trackIdx + 1}`].filter(Boolean);
    setTitle(parts.join(' - '));
    setSourceType('album');
    setRecordingId(recordingData?.id ?? null);

    setShowImportModal(false);
  };

  const removeEntry = (i) => {
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
  };

  // Actualiza un campo concreto de una entry sin recrear el objeto → el input no pierde el foco
  const updateEntry = (i, field, value) => {
    setEntries(i, field, value);
    // Propagate end time to next entry's start if it's empty
    if (field === 'endSec' && i + 1 < entries.length && !entries[i + 1].startSec) {
      setEntries(i + 1, 'startSec', value);
    }
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
      }));

      if (isEdit()) {
        await updateVideoWithEntries(props.editVideo.id, {
          source_type: sourceType(),
          title: title().trim() || null,
          channel: channel().trim() || null,
          thesession_recording_id: recordingId(),
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
    setTuneSearch('');
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
              ? t('addVideo.editing', { id: props.editVideo.youtube_id })
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
                <span class={`font-medium ${duplicate().status === 'approved' ? 'text-green-400' : 'text-[var(--color-warning)]'}`}>
                  {duplicate().status}
                </span>
              </p>
              <p class="text-[var(--color-muted)] text-xs mt-1">
                {t('addVideo.duplicateBlocked')}
                <Show when={duplicate().tune_id && duplicate().status === 'approved'}>
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
              src={`https://www.youtube.com/embed/${youtubeId()}`}
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

        {/* ── TheSession recording import ──────────────────────────────── */}
        <Show when={!isEdit()}>
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
        </Show>

        {/* ── Tunes in this video ──────────────────────────────────────── */}
        <div class="flex flex-col gap-3">
          <label class="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
            {t('addVideo.tunesLabel')}
          </label>

          {/* Search tune */}
          <div class="relative">
            <input
              type="text"
              placeholder={t('addVideo.searchTunePlaceholder')}
              value={tuneSearch()}
              onInput={e => setTuneSearch(e.target.value)}
              class="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)] transition-colors text-sm"
            />

            {/* Dropdown results */}
            <Show when={tuneResults().length > 0}>
              <div class="absolute top-full mt-1 left-0 right-0 z-20 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden shadow-xl">
                <For each={tuneResults()}>
                  {(tune) => (
                    <button
                      onClick={() => addEntry(tune)}
                      class="w-full px-4 py-2.5 text-left text-sm hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)] transition-colors flex items-center justify-between gap-3 border-b border-[var(--color-border)] last:border-0"
                    >
                      <span class="font-medium text-[var(--color-text)] group-hover:text-[var(--color-primary)] truncate">
                        {tune.name}
                      </span>
                      <span class="text-[10px] text-[var(--color-muted)] flex-shrink-0">
                        {tune.type} · {tune.meter}
                      </span>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>

          {/* Entries list */}
          <Show when={entries.length > 0}>
            <div class="flex flex-col gap-2">
              <For each={entries}>
                {(entry, i) => (
                  <div class="flex items-center gap-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3">

                    {/* Position */}
                    <span class="text-xs text-[var(--color-muted)] w-4 flex-shrink-0 text-center">
                      {i() + 1}
                    </span>

                    {/* Tune name */}
                    <div class="flex-grow min-w-0">
                      <span class="text-sm font-semibold text-[var(--color-text)] block truncate">
                        {entry.tune.name}
                      </span>
                      <span class="text-[10px] text-[var(--color-muted)]">
                        {entry.tune.type} · {entry.tune.meter}
                      </span>
                    </div>

                    {/* Timestamps */}
                    <div class="flex items-start gap-2 flex-shrink-0">
                      <div class="flex flex-col items-center gap-0.5">
                        <span class="text-[9px] text-[var(--color-muted)] uppercase tracking-wide">{t('addVideo.start')}</span>
                        <input
                          type="text"
                          placeholder="0:00"
                          value={entry.startSec}
                          onInput={e => updateEntry(i(), 'startSec', e.target.value)}
                          class={`w-14 text-center bg-[var(--color-bg)] border rounded-lg px-2 py-1 text-xs text-[var(--color-text)] font-mono focus:outline-none transition-colors
                            ${entry.startSec && validateTimestamp(entry.startSec).error
                              ? 'border-[var(--color-error)] focus:border-[var(--color-error)]'
                              : 'border-[var(--color-border)] focus:border-[var(--color-primary)]'}`}
                        />
                      </div>
                      <span class="text-[var(--color-border)] text-xs mt-3">–</span>
                      <div class="flex flex-col items-center gap-0.5">
                        <span class="text-[9px] text-[var(--color-muted)] uppercase tracking-wide">{t('addVideo.end')}</span>
                        <input
                          type="text"
                          placeholder="—"
                          value={entry.endSec}
                          onInput={e => updateEntry(i(), 'endSec', e.target.value)}
                          class={`w-14 text-center bg-[var(--color-bg)] border rounded-lg px-2 py-1 text-xs text-[var(--color-text)] font-mono focus:outline-none transition-colors
                            ${entry.endSec && validateTimestamp(entry.endSec).error
                              ? 'border-[var(--color-error)] focus:border-[var(--color-error)]'
                              : 'border-[var(--color-border)] focus:border-[var(--color-primary)]'}`}
                        />
                      </div>
                      <Show when={(() => {
                        const se = validateTimestamp(entry.startSec);
                        const ee = validateTimestamp(entry.endSec);
                        if (se.error) return 'start';
                        if (ee.error) return 'start';
                        if (se.value != null && ee.value != null && ee.value <= se.value) return 'start';
                        return null;
                      })()}>
                        <span class="text-[9px] text-[var(--color-error)] mt-5 whitespace-nowrap">
                          {validateTimestamp(entry.startSec).error
                           || validateTimestamp(entry.endSec).error
                           || (() => {
                               const s = validateTimestamp(entry.startSec).value;
                               const e = validateTimestamp(entry.endSec).value;
                               return s != null && e != null && e <= s ? t('addVideo.endAfterStart') : '';
                             })()}
                        </span>
                      </Show>
                    </div>

                    {/* Instruments */}
                    <div class="relative flex-shrink-0" data-instrument-dropdown>
                      <button
                        type="button"
                        onClick={() => setOpenInstrumentDropdown(openInstrumentDropdown() === i() ? null : i())}
                        aria-expanded={openInstrumentDropdown() === i()}
                        aria-haspopup="listbox"
                        class="flex items-center gap-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-2 py-1 text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] transition-colors cursor-pointer min-w-[80px]"
                        title={t('addVideo.instruments')}
                      >
                        <span class={entry.instruments.length === 0 ? 'text-[var(--color-muted)]' : ''}>
                          {entry.instruments.length === 0 ? '—' : entry.instruments.map(ins => instrumentLabel(ins)).join(', ')}
                        </span>
                        <svg class={`w-3 h-3 text-[var(--color-muted)] transition-transform ${openInstrumentDropdown() === i() ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <Show when={openInstrumentDropdown() === i()}>
                        <div class="absolute top-full left-0 mt-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-xl z-30 py-1 min-w-[140px]" onClick={e => e.stopPropagation()}>
                          <For each={['fiddle', 'flute', 'uileann_pipes', 'whistle', 'banjo', 'concertina', 'melodeon', 'mandolin', 'mandola', 'various']}>
                            {(key) => {
                              const isSelected = () => entry.instruments.includes(key);
                              return (
                                <label class="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--color-primary)]/10 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isSelected()}
                                    onChange={() => {
                                      const current = entry.instruments;
                                      const newInstruments = isSelected()
                                        ? current.filter(ins => ins !== key)
                                        : [...current, key];
                                      updateEntry(i(), 'instruments', newInstruments);
                                    }}
                                    class="rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                                  />
                                  <span class="text-xs text-[var(--color-text)]">{instrumentLabel(key)}</span>
                                </label>
                              );
                            }}
                          </For>
                        </div>
                      </Show>
                    </div>

                    {/* Key */}
                    <Show when={(() => {
                      const s = getSettings(entry.tune.tune_id);
                      return s.length > 0;
                    })()}>
                      <select
                        value={entry.key ?? ''}
                        onChange={e => updateEntry(i(), 'key', e.target.value || null)}
                        class="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-1.5 py-0.5 text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
                      >
                        <option value="">—</option>
                        <For each={[...new Set(getSettings(entry.tune.tune_id).map(s => s.key))]}>
                          {(k) => <option value={k}>{k}</option>}
                        </For>
                      </select>
                    </Show>

                    {/* Remove */}
                    <button
                      onClick={() => removeEntry(i())}
                      class="text-[var(--color-muted)] hover:text-[var(--color-error)] transition-colors text-sm flex-shrink-0 ml-1"
                      title={t('addVideo.instruments')}
                    >✕</button>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <Show when={entries.length === 0}>
            <p class="text-xs text-[var(--color-muted)] py-2">
              {t('addVideo.noEntries')}
            </p>
          </Show>
          <Show when={autoMatchedCount() > 0}>
            <p class="text-xs text-[var(--color-primary)] bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 rounded-lg px-3 py-2">
              {autoMatchedCount() > 1
                ? t('addVideo.autoMatchedPlural', { count: autoMatchedCount() })
                : t('addVideo.autoMatched', { count: autoMatchedCount() })}
            </p>
          </Show>
        </div>

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
