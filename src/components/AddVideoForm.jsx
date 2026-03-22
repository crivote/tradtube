/**
 * AddVideoForm.jsx
 * Formulario para añadir un vídeo de YouTube con su set de tunes.
 * Accesible solo para usuarios autenticados.
 *
 * Props: { onClose }
 */

import { createSignal, createMemo, For, Show } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import { searchTunes, getTuneById } from '../lib/db';
import { addVideoWithEntries, updateVideoWithEntries } from '../lib/supabase';
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
  const [entries, setEntries] = createStore(initialEntries);
  const [tuneSearch, setTuneSearch] = createSignal('');
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal('');
  const [success, setSuccess] = createSignal(false);

  const youtubeId = createMemo(() => extractYoutubeId(youtubeUrl()));

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
          entries: entryPayload,
        });
      } else {
        await addVideoWithEntries({
          youtube_id: youtubeId(),
          source_type: sourceType(),
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
    setTuneSearch('');
    setError('');
    setSuccess(false);
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
