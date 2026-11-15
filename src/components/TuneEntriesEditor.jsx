/**
 * TuneEntriesEditor.jsx
 * Componente reutilizable para editar una lista de entries (tune + timestamps + instruments + key).
 * No sabe nada de YouTube ni de grabaciones — es pura lógica de entries.
 *
 * Props:
 *   entries: Store Array     — lista reactiva de entries
 *   onAdd(tune): void        — añade entry
 *   onRemove(index): void    — elimina entry
 *   onUpdate(index, field, value): void  — actualiza campo
 *   audioDuration: number?   — duración total para validación de bounds
 *   readOnly: boolean        — deshabilita edición
 *   onSeekToTime(seconds: number|null): void  — opcional, seek en YouTube iframe
 *
 * Cada entry se pinta en dos filas: la identidad de la tune (nombre completo,
 * tipo, id de TheSession, tonalidad) y sus datos de segmento (tiempos,
 * structure, BPM e instrumentos). En una sola fila el nombre quedaba truncado
 * a dos letras en cuanto se marcaban varios instrumentos.
 */

import { createSignal, createMemo, createEffect, onCleanup, For, Show } from 'solid-js';
import { ChevronDown, SkipForward, GripVertical } from 'lucide-solid';
import { searchTunes, getTuneById } from '../lib/db';
import { parseSec, validateTimestamp } from '../lib/utils';
import { useI18n } from '../i18n';
import { INSTRUMENT_GROUPS } from '../constants';

export default function TuneEntriesEditor(props) {
  const { t } = useI18n();
  const instrumentLabel = (key) => t(`instruments.${key}`) ?? key;
  const [tuneSearch, setTuneSearch] = createSignal('');
  const [openInstrumentDropdown, setOpenInstrumentDropdown] = createSignal(null);
  const [openKeyPopup, setOpenKeyPopup] = createSignal(null);
  const [dragIndex, setDragIndex] = createSignal(null);

  const moveEntry = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= props.entries.length) return;
    if (props.onReorder) props.onReorder(i, j);
  };

  createEffect(() => {
    const idx = openInstrumentDropdown();
    const keyIdx = openKeyPopup();
    if (idx == null && keyIdx == null) return;
    const handler = (e) => {
      if (!e.target.closest('[data-instrument-dropdown]')) {
        setOpenInstrumentDropdown(null);
      }
      if (!e.target.closest('[data-key-dropdown]')) {
        setOpenKeyPopup(null);
      }
    };
    document.addEventListener('click', handler);
    onCleanup(() => document.removeEventListener('click', handler));
  });

  const tuneResults = createMemo(() => {
    const q = tuneSearch().trim();
    if (q.length < 2) return [];
    const added = new Set(props.entries.map(e => e.tune.tune_id));
    return searchTunes(q, 8).filter(t => !added.has(t.tune_id));
  });

  // Desambiguador: hay tunes homónimos, así que el id de TheSession es la única
  // forma de confirmar cuál se está vinculando.
  const tuneUrl = (id) => `https://thesession.org/tunes/${id}`;
  const tuneMeta = (tune) => [tune?.type, tune?.meter].filter(Boolean).join(' · ');

  const handleAdd = (tune) => {
    props.onAdd(tune);
    setTuneSearch('');
    setOpenInstrumentDropdown(null);
  };

  // --- Tonalidad: selector abierto nota (12 cromaticas con bemoles) × modo ---
  // Formato almacenado (compatible con entradas existentes de #31):
  //   {nota}{modo}  ej: Cmajor, Dbdorian, Ebminor, Gbmixolydian
  // Notas: C Db D Eb E F Gb G Ab A Bb B  (sin sostenidos, solo bemoles)
  // Modos: major minor dorian mixolydian  (solo los 4 presentes en TheSession)
  // UX: badge con abreviatura inglesa. Click → popup con dos selects traducidos.
  const NOTES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
  const NOTE_STORAGE = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const MODES = ['major', 'minor', 'dorian', 'mixolydian'];
  const MODE_ABBR = { major: 'MAJ', minor: 'MIN', dorian: 'DOR', mixolydian: 'MIX' };

  const parseKey = (key) => {
    if (!key || typeof key !== 'string') return null;
    const note = key.length > 1 && key[1] === 'b' ? key.slice(0, 2) : key[0];
    const mode = key.slice(note.length);
    if (MODES.includes(mode) && NOTE_STORAGE.includes(note)) return { note, mode };
    return null;
  };

  const formatKeyBadge = (entry) => {
    const note = entry?.key;
    const mode = entry?.scale;
    if (!note || !mode) return '—';
    const ni = NOTE_STORAGE.indexOf(note);
    const noteLabel = ni >= 0 ? NOTES[ni] : note;
    return `${noteLabel} ${MODE_ABBR[mode] ?? mode.toUpperCase()}`;
  };

  const getEndError = (entry, i) => {
    const se = validateTimestamp(entry.startSec);
    const ee = validateTimestamp(entry.endSec);
    if (se.error) return 'start';
    if (ee.error) return 'end';
    if (se.value != null && ee.value != null && ee.value <= se.value) return 'start';
    if (props.audioDuration != null && ee.value != null && ee.value > props.audioDuration) return 'end';
    if (props.audioDuration != null && se.value != null && se.value > props.audioDuration) return 'start';
    return null;
  };

  return (
    <div class="flex flex-col gap-3">
      <label class="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
        {t('addVideo.tunesLabel')}
      </label>

      {/* Search tune */}
      <Show when={!props.readOnly}>
        <div class="relative">
          <input
            type="text"
            placeholder={t('addVideo.searchTunePlaceholder')}
            value={tuneSearch()}
            onInput={e => setTuneSearch(e.target.value)}
            class="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)] transition-colors text-sm"
          />

          <Show when={tuneResults().length > 0}>
            <div class="absolute top-full mt-1 left-0 right-0 z-20 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden shadow-xl">
              <For each={tuneResults()}>
                {(tune) => (
                  <div class="flex items-center border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-primary)]/10 transition-colors">
                    <button
                      onClick={() => handleAdd(tune)}
                      class="flex-grow min-w-0 px-4 py-2.5 text-left text-sm flex items-center justify-between gap-3 transition-colors hover:text-[var(--color-primary)]"
                    >
                      <span class="min-w-0 flex items-baseline gap-1.5">
                        <span class="font-medium text-[var(--color-text)] truncate">{tune.name}</span>
                        <Show when={tune.composer}>
                          <span class="text-[10px] text-[var(--color-muted)] truncate">— {tune.composer}</span>
                        </Show>
                      </span>
                      <span class="text-[10px] text-[var(--color-muted)] flex-shrink-0">{tuneMeta(tune)}</span>
                    </button>
                    <a
                      href={tuneUrl(tune.tune_id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`TheSession #${tune.tune_id}`}
                      class="flex-shrink-0 pr-3 pl-1 py-2.5 font-mono text-[10px] text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors"
                    >#{tune.tune_id}</a>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>

      {/* Entries list */}
      <Show when={props.entries.length > 0}>
        <div class="flex flex-col gap-2">
          <For each={props.entries}>
            {(entry, i) => (
              <div
                draggable={!props.readOnly}
                onDragStart={() => setDragIndex(i())}
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={() => {
                  const from = dragIndex();
                  if (from === null || from === i() || !props.onReorder) return;
                  props.onReorder(from, i());
                }}
                onDragEnd={() => setDragIndex(null)}
                class={`flex flex-col gap-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 transition-opacity
                  ${dragIndex() === i() ? 'opacity-50' : ''}`}
              >
                {/* ── Fila 1: identidad de la tune ─────────────────────── */}
                <div class="flex items-start gap-3">
                  <Show when={!props.readOnly}>
                    <div class="flex flex-col items-center gap-0.5 flex-shrink-0">
                      <button
                        onClick={() => moveEntry(i(), -1)}
                        disabled={i() === 0}
                        class="text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-20 disabled:cursor-default leading-none text-xs"
                      >▲</button>
                      <div class="hidden sm:flex cursor-grab text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors">
                        <GripVertical size={14} />
                      </div>
                      <button
                        onClick={() => moveEntry(i(), 1)}
                        disabled={i() === props.entries.length - 1}
                        class="text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-20 disabled:cursor-default leading-none text-xs"
                      >▼</button>
                    </div>
                  </Show>

                  {/* Position */}
                  <span class="text-xs text-[var(--color-muted)] w-4 flex-shrink-0 text-center mt-0.5">{i() + 1}</span>

                  {/* Tune name (sin truncar) + TheSession id (desambiguador) */}
                  <div class="flex-grow min-w-0">
                    <span class="text-sm font-semibold text-[var(--color-text)] block break-words">{entry.tune.name}</span>
                    <span class="text-[10px] text-[var(--color-muted)] flex items-center gap-1.5 flex-wrap">
                      <Show when={tuneMeta(entry.tune)}>
                        <span>{tuneMeta(entry.tune)}</span>
                        <span class="text-[var(--color-border)]">·</span>
                      </Show>
                      <Show when={entry.tune.tune_id != null} fallback={<span>—</span>}>
                        <a
                          href={tuneUrl(entry.tune.tune_id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`TheSession #${entry.tune.tune_id}`}
                          class="font-mono hover:text-[var(--color-primary)] hover:underline transition-colors"
                        >#{entry.tune.tune_id}</a>
                      </Show>
                    </span>
                  </div>

                  {/* Tonalidad — badge con abreviatura + popup de doble selector */}
                  <Show when={!props.readOnly}>
                    <div class="relative flex-shrink-0" data-key-dropdown>
                      <button
                        type="button"
                        onClick={() => setOpenKeyPopup(openKeyPopup() === i() ? null : i())}
                        aria-expanded={openKeyPopup() === i()}
                        aria-haspopup="listbox"
                        class="text-[10px] font-mono font-semibold bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-2 py-1 cursor-pointer hover:border-[var(--color-primary)] transition-colors whitespace-nowrap"
                        title={t('addVideo.key')}
                      >
                        {formatKeyBadge(entry)}
                      </button>
                      <Show when={openKeyPopup() === i()}>
                        <div class="absolute top-full right-0 mt-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-xl z-30 p-2.5 flex gap-2">
                          <select
                            value={entry.key ?? ''}
                            onChange={e => {
                              const note = e.target.value;
                              if (!note) { props.onUpdate(i(), 'key', null); props.onUpdate(i(), 'scale', null); return; }
                              props.onUpdate(i(), 'key', note);
                            }}
                            class="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-2 py-1 text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
                          >
                            <option value="">—</option>
                            <For each={NOTE_STORAGE}>
                              {(note, ni) => (
                                <option value={note}>{t(`key.notes.${note}`) ?? NOTES[ni()]}</option>
                              )}
                            </For>
                          </select>
                          <select
                            value={entry.scale ?? ''}
                            onChange={e => {
                              const mode = e.target.value;
                              if (!mode) { props.onUpdate(i(), 'scale', null); return; }
                              props.onUpdate(i(), 'scale', mode);
                            }}
                            class="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-2 py-1 text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
                          >
                            <option value="">—</option>
                            <For each={MODES}>
                              {(mode) => (
                                <option value={mode}>{t(`key.modes.${mode}`) ?? mode}</option>
                              )}
                            </For>
                          </select>
                        </div>
                      </Show>
                    </div>

                    {/* Remove */}
                    <button
                      onClick={() => props.onRemove(i())}
                      class="text-[var(--color-muted)] hover:text-[var(--color-error)] transition-colors text-sm flex-shrink-0 mt-0.5"
                    >✕</button>
                  </Show>
                </div>

                {/* ── Fila 2: datos del segmento ───────────────────────── */}
                <Show when={!props.readOnly}>
                  <div class="flex flex-wrap items-start gap-x-4 gap-y-2 pl-7 sm:pl-10">

                    {/* Timestamps */}
                    <div class="flex items-start gap-2 flex-shrink-0">
                      <div class="flex flex-col items-center gap-0.5">
                        <span class="text-[9px] text-[var(--color-muted)] uppercase tracking-wide">{t('addVideo.start')}</span>
                        <input
                          type="text"
                          placeholder="0:00"
                          value={entry.startSec}
                          onInput={e => props.onUpdate(i(), 'startSec', e.target.value)}
                          class={`w-16 text-center bg-[var(--color-bg)] border rounded-lg px-2 py-1 text-xs text-[var(--color-text)] font-mono focus:outline-none transition-colors
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
                          onInput={e => props.onUpdate(i(), 'endSec', e.target.value)}
                          onBlur={() => {
                            const endSec = props.entries[i()].endSec;
                            if (endSec && i() + 1 < props.entries.length && !props.entries[i() + 1].startSec) {
                              props.onUpdate(i() + 1, 'startSec', endSec);
                            }
                          }}
                          class={`w-16 text-center bg-[var(--color-bg)] border rounded-lg px-2 py-1 text-xs text-[var(--color-text)] font-mono focus:outline-none transition-colors
                            ${entry.endSec && validateTimestamp(entry.endSec).error
                              ? 'border-[var(--color-error)] focus:border-[var(--color-error)]'
                              : 'border-[var(--color-border)] focus:border-[var(--color-primary)]'}`}
                        />
                      </div>
                      <Show when={props.onSeekToTime}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            const endVal = parseSec(entry.endSec);
                            props.onSeekToTime(endVal != null ? Math.max(0, endVal - 2.5) : null);
                          }}
                          title="Seek to -2.5s before end"
                          class="flex-shrink-0 mt-3 text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors"
                        >
                          <SkipForward size={15} />
                        </button>
                      </Show>
                      <Show when={getEndError(entry, i())}>
                        <span class="text-[9px] text-[var(--color-error)] mt-4 whitespace-nowrap">
                          {(() => {
                            const se = validateTimestamp(entry.startSec);
                            const ee = validateTimestamp(entry.endSec);
                            return validateTimestamp(entry.startSec).error
                             || validateTimestamp(entry.endSec).error
                             || (se.value != null && ee.value != null && ee.value <= se.value ? t('addVideo.endAfterStart') : '')
                             || (props.audioDuration != null && ee.value != null && ee.value > props.audioDuration
                               ? `End > ${Math.floor(props.audioDuration / 60)}:${String(props.audioDuration % 60).padStart(2, '0')}`
                               : '');
                          })()}
                        </span>
                      </Show>
                    </div>

                    {/* Structure */}
                    <div class="flex flex-col items-center gap-0.5 flex-shrink-0">
                      <span class="text-[9px] text-[var(--color-muted)] uppercase tracking-wide">Structure</span>
                      <input
                        type="text"
                        placeholder="AABB"
                        value={entry.structure ?? ''}
                        onInput={e => props.onUpdate(i(), 'structure', e.target.value || null)}
                        maxlength="10"
                        class="w-16 text-center bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-2 py-1 text-xs text-[var(--color-text)] font-mono focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                      />
                    </div>

                    {/* BPM */}
                    <div class="flex flex-col items-center gap-0.5 flex-shrink-0">
                      <span class="text-[9px] text-[var(--color-muted)] uppercase tracking-wide">BPM</span>
                      <input
                        type="number"
                        placeholder="120"
                        value={entry.bpm ?? ''}
                        onInput={e => props.onUpdate(i(), 'bpm', e.target.value ? parseInt(e.target.value, 10) : null)}
                        min="20"
                        max="300"
                        class="w-16 text-center bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-2 py-1 text-xs text-[var(--color-text)] font-mono focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                      />
                    </div>

                    {/* Instruments — ancho propio; las etiquetas envuelven en vez
                        de truncarse, que es lo que ocultaba la pista. */}
                    <div class="relative flex-1 min-w-[15rem] basis-full sm:basis-auto" data-instrument-dropdown>
                      <span class="block mb-0.5 text-[9px] text-[var(--color-muted)] uppercase tracking-wide">
                        {t('addVideo.instruments')}
                      </span>
                      <button
                        type="button"
                        onClick={() => setOpenInstrumentDropdown(openInstrumentDropdown() === i() ? null : i())}
                        aria-expanded={openInstrumentDropdown() === i()}
                        aria-haspopup="listbox"
                        title={t('addVideo.instruments')}
                        class="w-full flex items-start justify-between gap-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] transition-colors cursor-pointer"
                      >
                        <span class="flex flex-wrap items-center gap-1">
                          <Show
                            when={entry.instruments.length > 0}
                            fallback={<span class="text-[var(--color-muted)]">—</span>}
                          >
                            <For each={entry.instruments}>
                              {(ins) => (
                                <span class="text-[10px] leading-5 px-1.5 rounded-md bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 text-[var(--color-text)] whitespace-nowrap">
                                  {instrumentLabel(ins)}
                                </span>
                              )}
                            </For>
                          </Show>
                        </span>
                        <ChevronDown
                          size={12}
                          class={`text-[var(--color-muted)] flex-shrink-0 mt-1 transition-transform ${openInstrumentDropdown() === i() ? 'rotate-180' : ''}`}
                        />
                      </button>
                      <Show when={openInstrumentDropdown() === i()}>
                        <div class="absolute top-full left-0 mt-1 w-64 max-h-72 overflow-y-auto bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-xl z-30 py-1">
                          <For each={INSTRUMENT_GROUPS}>
                            {(group) => (
                              <div>
                                <p class="px-3 pt-2 pb-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                                  {t(`instrumentGroups.${group.key}`)}
                                </p>
                                <For each={group.keys}>
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
                                            props.onUpdate(i(), 'instruments', newInstruments);
                                          }}
                                          class="rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                                        />
                                        <span class="text-xs text-[var(--color-text)]">{instrumentLabel(key)}</span>
                                      </label>
                                    );
                                  }}
                                </For>
                              </div>
                            )}
                          </For>
                        </div>
                      </Show>
                    </div>

                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={props.entries.length === 0 && !props.readOnly}>
        <p class="text-xs text-[var(--color-muted)] py-2">
          {t('addVideo.noEntries')}
        </p>
      </Show>
    </div>
  );
}
