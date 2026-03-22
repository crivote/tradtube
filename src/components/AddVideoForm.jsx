/**
 * AddVideoForm.jsx
 * Formulario para añadir un vídeo de YouTube con su set de tunes.
 * Accesible solo para usuarios autenticados.
 *
 * Props: { onClose }
 */

import { createSignal, createMemo, createEffect, For, Show } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import { searchTunes, getTuneById } from '../lib/db';
import { addVideoWithEntries, updateVideoWithEntries } from '../lib/supabase';
import { parseRecordingUrl, fetchRecording, resolveTrackTunes, formatTrackLabel } from '../lib/thesession';
import { SOURCE_TYPES } from '../constants';

// Extrae el ID de YouTube de una URL o devuelve el input si ya es un ID
function extractYoutubeId(input) {
  if (!input) return null;
  const s = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) return m[1];
  }
  return null;
}

// Convierte "3:47" o "227" a segundos enteros
function parseSec(val) {
  const s = String(val ?? '').trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  const m = s.match(/^(\d+):(\d{2})$/);
  if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
  return null;
}

// Obtiene el título del vídeo via YouTube oEmbed (sin API key)
async function fetchYoutubeTitle(videoId) {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.title ?? null;
  } catch {
    return null;
  }
}

// Formatea segundos a "m:ss"
function formatSec(sec) {
  if (sec == null) return '';
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

function AddVideoForm(props) {
  // Modo edición: props.editVideo contiene el vídeo existente
  const isEdit = () => !!props.editVideo;

  const initialEntries = props.editVideo
    ? [...(props.editVideo.tune_video_entries ?? [])]
        .sort((a, b) => a.position - b.position)
        .map(e => ({
          tune: getTuneById(e.tune_id) ?? { tune_id: e.tune_id, name: `Tune #${e.tune_id}`, type: '', meter: '' },
          startSec: formatSec(e.start_sec ?? 0),
          endSec: e.end_sec != null ? formatSec(e.end_sec) : '',
        }))
    : [];

  const [youtubeUrl, setYoutubeUrl] = createSignal(props.editVideo?.youtube_id ?? '');
  const [sourceType, setSourceType] = createSignal(props.editVideo?.source_type ?? 'session');
  const [title, setTitle] = createSignal(props.editVideo?.title ?? '');
  const [entries, setEntries] = createStore(initialEntries);
  const [tuneSearch, setTuneSearch] = createSignal('');
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal('');
  const [success, setSuccess] = createSignal(false);

  // ── TheSession recording import ──────────────────────────────────────────
  const [recordingUrl, setRecordingUrl] = createSignal('');
  const [recording, setRecording] = createSignal(null);
  const [recordingLoading, setRecordingLoading] = createSignal(false);
  const [recordingError, setRecordingError] = createSignal('');
  const [skippedTuneNames, setSkippedTuneNames] = createSignal([]);

  const youtubeId = createMemo(() => extractYoutubeId(youtubeUrl()));

  // Auto-fetch título desde YouTube oEmbed al detectar un ID válido
  createEffect(async () => {
    const id = youtubeId();
    if (!id || isEdit()) return;
    const t = await fetchYoutubeTitle(id);
    if (t) setTitle(t);
  });

  // Auto-fetch recording desde TheSession al detectar una URL/ID válida
  createEffect(async () => {
    const id = parseRecordingUrl(recordingUrl());
    if (!id) { setRecording(null); setRecordingError(''); return; }
    setRecordingLoading(true);
    setRecordingError('');
    setRecording(null);
    setSkippedTuneNames([]);
    try {
      setRecording(await fetchRecording(id));
    } catch (e) {
      setRecordingError(e.message);
    } finally {
      setRecordingLoading(false);
    }
  });

  // Auto-set source type a 'album' cuando se carga un recording
  createEffect(() => {
    if (recording()) setSourceType('album');
  });

  const tuneResults = createMemo(() => {
    const q = tuneSearch().trim();
    if (q.length < 2) return [];
    // Excluir tunes ya añadidas
    const added = new Set(entries.map(e => e.tune.tune_id));
    return searchTunes(q, 8).filter(t => !added.has(t.tune_id));
  });

  const addEntry = (tune) => {
    setEntries(produce(e => e.push({ tune, startSec: '', endSec: '' })));
    setTuneSearch('');
  };

  const handleImportTrack = (trackIdx) => {
    const track = recording()?.tracks?.[trackIdx];
    if (!track) return;
    const resolved = resolveTrackTunes(track, getTuneById);
    const existing = new Set(entries.map(e => e.tune.tune_id));
    const skipped = [];
    let added = 0;
    for (const r of resolved) {
      if (r.unresolvable) { skipped.push(r.name); continue; }
      if (existing.has(r.tune.tune_id)) continue;
      setEntries(produce(e => e.push({ tune: r.tune, startSec: '', endSec: '' })));
      existing.add(r.tune.tune_id);
      added++;
    }
    setSkippedTuneNames(skipped);
    setTuneSearch('');
  };

  const removeEntry = (i) => {
    setEntries(produce(e => e.splice(i, 1)));
  };

  // Actualiza un campo concreto de una entry sin recrear el objeto → el input no pierde el foco
  const updateEntry = (i, field, value) => {
    setEntries(i, field, value);
  };

  const handleSubmit = async () => {
    if (!youtubeId()) { setError('URL de YouTube no válida.'); return; }
    if (entries.length === 0) { setError('Añade al menos una tune.'); return; }

    setSubmitting(true);
    setError('');
    try {
      const entryPayload = entries.map((e, i) => ({
        tune_id: e.tune.tune_id,
        start_sec: parseSec(e.startSec) ?? 0,
        end_sec: parseSec(e.endSec) ?? null,
        position: i,
      }));

      if (isEdit()) {
        await updateVideoWithEntries(props.editVideo.id, {
          source_type: sourceType(),
          title: title().trim() || null,
          entries: entryPayload,
        });
      } else {
        await addVideoWithEntries({
          youtube_id: youtubeId(),
          source_type: sourceType(),
          title: title().trim() || null,
          entries: entryPayload,
        });
      }
      setSuccess(true);
    } catch (err) {
      setError(err.message ?? 'Error al guardar. ¿Está el vídeo ya registrado?');
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
    setRecordingUrl('');
    setRecording(null);
    setRecordingError('');
    setSkippedTuneNames([]);
  };

  return (
    <div class="flex flex-col gap-6 max-w-2xl mx-auto">

      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-black text-white">
            {isEdit() ? 'Edit video' : 'Add a video'}
          </h2>
          <p class="text-sm text-[var(--color-muted)] mt-0.5">
            {isEdit()
              ? `Editing ${props.editVideo.youtube_id}`
              : 'Link a YouTube video to the tunes it contains'}
          </p>
        </div>
        <button
          onClick={props.onClose}
          class="text-sm text-[var(--color-muted)] hover:text-white transition-colors"
        >
          ✕ Close
        </button>
      </div>

      {/* Success */}
      <Show when={success()}>
        <div class="rounded-xl border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/10 px-4 py-4 flex items-center justify-between gap-4">
          <p class="text-sm text-[var(--color-primary)] font-semibold">
            ✓ {isEdit() ? 'Video updated' : 'Video saved — pending approval'}
          </p>
          <button
            onClick={handleReset}
            class="text-xs text-[var(--color-primary)] underline hover:no-underline"
          >
            Add another
          </button>
        </div>
      </Show>

      <Show when={!success()}>

        {/* ── YouTube URL ──────────────────────────────────────────────── */}
        <div class="flex flex-col gap-2">
          <label class="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
            YouTube URL or video ID
          </label>
          <input
            type="text"
            placeholder="https://www.youtube.com/watch?v=… or video ID"
            value={youtubeUrl()}
            onInput={e => setYoutubeUrl(e.target.value)}
            disabled={isEdit()}
            class="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-white placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)] transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <Show when={youtubeUrl() && !youtubeId()}>
            <p class="text-xs text-red-400">Can't extract a valid video ID from this URL.</p>
          </Show>
        </div>

        {/* Preview */}
        <Show when={youtubeId()}>
          <div class="rounded-xl overflow-hidden border border-[var(--color-border)] aspect-video bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${youtubeId()}`}
              class="w-full h-full"
              allowfullscreen
            />
          </div>
        </Show>

        {/* ── Título ───────────────────────────────────────────────────── */}
        <div class="flex flex-col gap-2">
          <label class="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
            Title
            <Show when={youtubeId() && !title()}>
              <span class="ml-2 text-[var(--color-muted)]/50 normal-case font-normal">fetching…</span>
            </Show>
          </label>
          <input
            type="text"
            placeholder="Video title (auto-filled from YouTube)"
            value={title()}
            onInput={e => setTitle(e.target.value)}
            class="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-white placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)] transition-colors text-sm"
          />
        </div>

        {/* ── Source type ──────────────────────────────────────────────── */}
        <div class="flex flex-col gap-2">
          <label class="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
            Source type
          </label>
          <select
            value={sourceType()}
            onChange={e => setSourceType(e.target.value)}
            class="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[var(--color-primary)] transition-colors text-sm appearance-none cursor-pointer"
          >
            <For each={Object.entries(SOURCE_TYPES)}>
              {([key, label]) => <option value={key}>{label}</option>}
            </For>
          </select>
        </div>

        {/* ── TheSession recording import ──────────────────────────────── */}
        <Show when={!isEdit()}>
          <div class="flex flex-col gap-2">
            <label class="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
              Import tracklist from TheSession
              <span class="ml-2 normal-case font-normal text-[var(--color-muted)]/50">optional</span>
            </label>
            <div class="relative">
              <input
                type="text"
                placeholder="https://thesession.org/recordings/158 or recording ID"
                value={recordingUrl()}
                onInput={e => setRecordingUrl(e.target.value)}
                class="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-white placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)] transition-colors text-sm"
              />
              <Show when={recordingLoading()}>
                <div class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
              </Show>
            </div>

            <Show when={recordingError()}>
              <p class="text-xs text-red-400">{recordingError()}</p>
            </Show>

            <Show when={recording()}>
              <div class="border border-[var(--color-border)] rounded-xl overflow-hidden">
                {/* Album header */}
                <div class="px-4 py-3 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
                  <p class="text-xs text-[var(--color-muted)]">{recording().artist?.name}</p>
                  <p class="text-sm font-semibold text-white">{recording().name}</p>
                </div>
                {/* Tracklist */}
                <Show when={recording().tracks?.length > 0} fallback={
                  <p class="text-xs text-[var(--color-muted)] px-4 py-3">No tracklist data available.</p>
                }>
                  <div class="flex flex-col divide-y divide-[var(--color-border)]">
                    <For each={recording().tracks}>
                      {(track, i) => (
                        <div class="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--color-surface)] transition-colors">
                          <span class="text-[10px] text-[var(--color-muted)] w-4 flex-shrink-0 text-right">
                            {i() + 1}
                          </span>
                          <span class="text-sm text-[var(--color-text)] flex-grow min-w-0 truncate">
                            {formatTrackLabel(track)}
                          </span>
                          <button
                            onClick={() => handleImportTrack(i())}
                            class="text-[10px] px-2.5 py-1 rounded-lg border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 transition-colors flex-shrink-0"
                          >
                            Import
                          </button>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>

              <Show when={skippedTuneNames().length > 0}>
                <p class="text-xs text-amber-400/80 bg-amber-400/5 border border-amber-400/20 rounded-lg px-3 py-2">
                  Skipped (not in database): {skippedTuneNames().join(', ')}
                </p>
              </Show>
            </Show>
          </div>
        </Show>

        {/* ── Tunes in this video ──────────────────────────────────────── */}
        <div class="flex flex-col gap-3">
          <label class="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
            Tunes in this video
          </label>

          {/* Search tune */}
          <div class="relative">
            <input
              type="text"
              placeholder="Search tune name…"
              value={tuneSearch()}
              onInput={e => setTuneSearch(e.target.value)}
              class="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-white placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)] transition-colors text-sm"
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
                      <span class="font-medium text-white group-hover:text-[var(--color-primary)] truncate">
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
                      <span class="text-sm font-semibold text-white block truncate">
                        {entry.tune.name}
                      </span>
                      <span class="text-[10px] text-[var(--color-muted)]">
                        {entry.tune.type} · {entry.tune.meter}
                      </span>
                    </div>

                    {/* Timestamps */}
                    <div class="flex items-center gap-2 flex-shrink-0">
                      <div class="flex flex-col items-center gap-0.5">
                        <span class="text-[9px] text-[var(--color-muted)] uppercase tracking-wide">start</span>
                        <input
                          type="text"
                          placeholder="0:00"
                          value={entry.startSec}
                          onInput={e => updateEntry(i(), 'startSec', e.target.value)}
                          class="w-14 text-center bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                        />
                      </div>
                      <span class="text-[var(--color-border)] text-xs mt-3">–</span>
                      <div class="flex flex-col items-center gap-0.5">
                        <span class="text-[9px] text-[var(--color-muted)] uppercase tracking-wide">end</span>
                        <input
                          type="text"
                          placeholder="—"
                          value={entry.endSec}
                          onInput={e => updateEntry(i(), 'endSec', e.target.value)}
                          class="w-14 text-center bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                        />
                      </div>
                    </div>

                    {/* Remove */}
                    <button
                      onClick={() => removeEntry(i())}
                      class="text-[var(--color-muted)] hover:text-red-400 transition-colors text-sm flex-shrink-0 ml-1"
                      title="Remove"
                    >✕</button>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <Show when={entries.length === 0}>
            <p class="text-xs text-[var(--color-muted)] py-2">
              Search and add the tunes that appear in this video, in order.
            </p>
          </Show>
        </div>

        {/* ── Error ────────────────────────────────────────────────────── */}
        <Show when={error()}>
          <p class="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
            {error()}
          </p>
        </Show>

        {/* ── Submit ───────────────────────────────────────────────────── */}
        <button
          onClick={handleSubmit}
          disabled={submitting() || !youtubeId() || entries.length === 0}
          class="w-full py-3 rounded-xl font-semibold text-sm transition-all
            bg-[var(--color-primary)] text-black hover:opacity-90
            disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {submitting() ? 'Saving…' : isEdit() ? 'Update video' : 'Save video'}
        </button>

      </Show>
    </div>
  );
}

export default AddVideoForm;
