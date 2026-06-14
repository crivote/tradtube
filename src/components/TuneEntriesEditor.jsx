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
 */

import { createSignal, createMemo, createEffect, onCleanup, For, Show } from 'solid-js';
import { ChevronDown, SkipForward, GripVertical } from 'lucide-solid';
import { searchTunes, getTuneById, getSettings } from '../lib/db';
import { parseSec, validateTimestamp } from '../lib/utils';
import { useI18n } from '../i18n';
import { INSTRUMENTS } from '../constants';

export default function TuneEntriesEditor(props) {
  const { t } = useI18n();
  const instrumentLabel = (key) => t(`instruments.${key}`) ?? key;
  const [tuneSearch, setTuneSearch] = createSignal('');
  const [openInstrumentDropdown, setOpenInstrumentDropdown] = createSignal(null);
  const [dragIndex, setDragIndex] = createSignal(null);

  const moveEntry = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= props.entries.length) return;
    if (props.onReorder) props.onReorder(i, j);
  };

  createEffect(() => {
    const idx = openInstrumentDropdown();
    if (idx == null) return;
    const handler = (e) => {
      if (!e.target.closest('[data-instrument-dropdown]')) {
        setOpenInstrumentDropdown(null);
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

  const handleAdd = (tune) => {
    props.onAdd(tune);
    setTuneSearch('');
    setOpenInstrumentDropdown(null);
  };

  const settingsCache = new Map();

  const getCachedSettings = (tuneId) => {
    if (settingsCache.has(tuneId)) return settingsCache.get(tuneId);
    const val = getSettings(tuneId);
    settingsCache.set(tuneId, val);
    return val;
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
                  <button
                    onClick={() => handleAdd(tune)}
                    class="w-full px-4 py-2.5 text-left text-sm hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)] transition-colors flex items-center justify-between gap-3 border-b border-[var(--color-border)] last:border-0"
                  >
                    <span class="font-medium text-[var(--color-text)] truncate">{tune.name}</span>
                    <span class="text-[10px] text-[var(--color-muted)] flex-shrink-0">{tune.type} · {tune.meter}</span>
                  </button>
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
                class={`flex items-center gap-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 transition-opacity
                  ${dragIndex() === i() ? 'opacity-50' : ''}`}
              >
                {/* Reorder controls */}
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
                <span class="text-xs text-[var(--color-muted)] w-4 flex-shrink-0 text-center">{i() + 1}</span>

                {/* Tune name */}
                <div class="flex-grow min-w-0">
                  <span class="text-sm font-semibold text-[var(--color-text)] block truncate">{entry.tune.name}</span>
                  <span class="text-[10px] text-[var(--color-muted)]">{entry.tune.type} · {entry.tune.meter}</span>
                </div>

                {/* Timestamps */}
                <Show when={!props.readOnly}>
                  <div class="flex items-start gap-2 flex-shrink-0">
                    <div class="flex flex-col items-center gap-0.5">
                      <span class="text-[9px] text-[var(--color-muted)] uppercase tracking-wide">{t('addVideo.start')}</span>
                      <input
                        type="text"
                        placeholder="0:00"
                        value={entry.startSec}
                        onInput={e => props.onUpdate(i(), 'startSec', e.target.value)}
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
                        onInput={e => props.onUpdate(i(), 'endSec', e.target.value)}
                        onBlur={() => {
                          const endSec = props.entries[i()].endSec;
                          if (endSec && i() + 1 < props.entries.length && !props.entries[i() + 1].startSec) {
                            props.onUpdate(i() + 1, 'startSec', endSec);
                          }
                        }}
                        class={`w-14 text-center bg-[var(--color-bg)] border rounded-lg px-2 py-1 text-xs text-[var(--color-text)] font-mono focus:outline-none transition-colors
                          ${entry.endSec && validateTimestamp(entry.endSec).error
                            ? 'border-[var(--color-error)] focus:border-[var(--color-error)]'
                            : 'border-[var(--color-border)] focus:border-[var(--color-primary)]'}`}
                      />
                    </div>
                    <Show when={getEndError(entry, i())}>
                      <span class="text-[9px] text-[var(--color-error)] mt-5 whitespace-nowrap">
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
                  </div>
                </Show>

                {/* Instruments */}
                <Show when={!props.readOnly}>
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
                      <ChevronDown size={12} class={`text-[var(--color-muted)] transition-transform ${openInstrumentDropdown() === i() ? 'rotate-180' : ''}`} />
                    </button>
                    <Show when={openInstrumentDropdown() === i()}>
                      <div class="absolute top-full left-0 mt-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-xl z-30 py-1 min-w-[140px]">
                        <For each={Object.keys(INSTRUMENTS)}>
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
                    </Show>
                  </div>
                </Show>

                {/* Key */}
                <Show when={!props.readOnly && getCachedSettings(entry.tune.tune_id).length > 0}>
                  <select
                    value={entry.key ?? ''}
                    onChange={e => props.onUpdate(i(), 'key', e.target.value || null)}
                    class="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-1.5 py-0.5 text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
                  >
                    <option value="">—</option>
                    <For each={[...new Set(getCachedSettings(entry.tune.tune_id).map(s => s.key))]}>
                      {(k) => <option value={k}>{k}</option>}
                    </For>
                  </select>
                </Show>

                {/* Structure */}
                <Show when={!props.readOnly}>
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
                </Show>

                {/* Remove */}
                <Show when={!props.readOnly}>
                  <button
                    onClick={() => props.onRemove(i())}
                    class="text-[var(--color-muted)] hover:text-[var(--color-error)] transition-colors text-sm flex-shrink-0 ml-1"
                  >✕</button>
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
