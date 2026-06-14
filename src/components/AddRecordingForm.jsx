/**
 * AddRecordingForm.jsx
 * Formulario para una grabación de usuario: preescucha, metadata y entries.
 *
 * Props:
 *   blob: Blob                   — audio Opus
 *   durationSeconds: number      — duración total del audio recortado
 *   initialTune: object?         — tune para pre-poblar el primer entry
 *   onSubmit({ blob, performer_name, recording_notes, entries }): void
 *   onCancel(): void
 */

import { createSignal, createEffect, Show } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import { parseSec, blobToDataUrl } from '../lib/utils';
import { useI18n } from '../i18n';
import { useAppStore } from '../store/appStore';
import TuneEntriesEditor from './TuneEntriesEditor';

export default function AddRecordingForm(props) {
  const { authUser } = useAppStore();
  const { t } = useI18n();

  const defaultName = authUser()?.user_metadata?.full_name ?? '';

  const [performerName, setPerformerName] = createSignal(defaultName);
  const [recordingNotes, setRecordingNotes] = createSignal('');
  const [error, setError] = createSignal('');

  const initialEntries = props.initialTune
    ? [{ tune: props.initialTune, startSec: '', endSec: '', instruments: [], key: null }]
    : [];

  const [entries, setEntries] = createStore(initialEntries);

  const [objectUrl, setObjectUrl] = createSignal(null);
  createEffect(() => {
    const blob = props.blob;
    if (blob) {
      blobToDataUrl(blob).then(setObjectUrl);
    } else {
      setObjectUrl(null);
    }
  });

  const validate = () => {
    if (!performerName().trim()) return t('addVideo.enterPerformerName');
    if (entries.length === 0) return t('addVideo.addOneTune');
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const s = parseSec(e.startSec);
      const en = parseSec(e.endSec);
      if (s != null && s < 0) return `Start time for track ${i + 1} must be >= 0`;
      if (en != null && en > props.durationSeconds) return `End time for track ${i + 1} exceeds audio duration`;
      if (s != null && en != null && en <= s) return `End time must be after start for track ${i + 1}`;
    }
    return null;
  };

  const handleSubmit = () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    props.onSubmit({
      blob: props.blob,
      performer_name: performerName().trim(),
      recording_notes: recordingNotes().trim() || null,
      entries: entries.map((e, i) => ({
        tune_id: e.tune.tune_id,
        start_sec: parseSec(e.startSec) ?? 0,
        end_sec: parseSec(e.endSec) ?? null,
        position: i,
        instruments: e.instruments?.length > 0 ? e.instruments : null,
        key: e.key || null,
        structure: e.structure || null,
      })),
    });
  };

  return (
    <div class="flex flex-col gap-6 max-w-2xl mx-auto">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-black text-[var(--color-text)]">New Recording</h2>
          <p class="text-sm text-[var(--color-muted)] mt-0.5">
            {props.initialTune ? `Recording for "${props.initialTune.name}"` : 'Add tune markers and metadata'}
          </p>
        </div>
        <button
          onClick={props.onCancel}
          class="text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
        >✕</button>
      </div>

      {/* Audio preview */}
      <Show when={props.blob}>
        <div class="flex flex-col gap-2">
          <label class="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">Preview</label>
          <audio controls src={objectUrl()} class="w-full h-10 rounded-lg" />
          <p class="text-[10px] text-[var(--color-muted)]">
            {Math.floor(props.durationSeconds / 60)}:{String(Math.floor(props.durationSeconds % 60)).padStart(2, '0')}
          </p>
        </div>
      </Show>

      {/* Performer name */}
      <div class="flex flex-col gap-2">
        <label class="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">Performer</label>
        <input
          type="text"
          placeholder="Your name"
          value={performerName()}
          onInput={e => setPerformerName(e.target.value)}
          class="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)] transition-colors text-sm"
        />
      </div>

      {/* Recording notes */}
      <div class="flex flex-col gap-2">
        <label class="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">Notes (optional)</label>
        <textarea
          placeholder="Location, date, context..."
          value={recordingNotes()}
          onInput={e => setRecordingNotes(e.target.value)}
          rows={3}
          class="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)] transition-colors text-sm resize-none"
        />
      </div>

      {/* Tune entries editor */}
      <TuneEntriesEditor
        entries={entries}
        audioDuration={props.durationSeconds}
        onAdd={(tune) => setEntries(produce(e => e.push({ tune, startSec: '', endSec: '', instruments: [], key: null, structure: null })))}
        onRemove={(i) => setEntries(produce(e => e.splice(i, 1)))}
        onReorder={(from, to) => setEntries(produce(e => {
          const moved = e[from];
          e.splice(from, 1);
          e.splice(to, 0, moved);
        }))}
        onUpdate={(i, field, value) => setEntries(i, field, value)}
      />

      {/* Error */}
      <Show when={error()}>
        <p class="text-sm text-[var(--color-error)] bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 rounded-xl px-4 py-3">
          {error()}
        </p>
      </Show>

      {/* Submit */}
      <div class="flex gap-3">
        <button
          onClick={props.onCancel}
          class="flex-1 py-3 rounded-xl font-semibold text-sm transition-all
            border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-muted)]/50"
        >Cancel</button>
        <button
          onClick={handleSubmit}
          disabled={entries.length === 0 || !performerName().trim()}
          class="flex-1 py-3 rounded-xl font-semibold text-sm transition-all
            bg-[var(--color-primary)] text-black hover:opacity-90
            disabled:opacity-30 disabled:cursor-not-allowed"
        >Save Recording</button>
      </div>
      <Show when={entries.length === 0}>
        <p class="text-center text-[10px] text-[var(--color-muted)] -mt-1">Add at least one tune to submit</p>
      </Show>
    </div>
  );
}
