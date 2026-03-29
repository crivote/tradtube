/**
 * SheetMusic.jsx
 * Renders ABC notation for a tune setting using abcjs.
 *
 * Props:
 *   tune       — full tune object { tune_id, name, type, meter }
 *   settingId  — optional: pins a specific settings.id variation
 */

import { createSignal, createEffect, Show, For } from 'solid-js';
import abcjs from 'abcjs';
import { getSettings } from '../lib/db';

/**
 * Converts TheSession key strings to standard ABC notation.
 * Examples: "Dmajor" → "D", "Eminor" → "Em", "Adorian" → "Ador", "Gmixolydian" → "Gmix"
 */
function toAbcKey(key) {
  return key
    .replace('major', '')
    .replace('minor', 'm')
    .replace('dorian', 'dor')
    .replace('mixolydian', 'mix')
    .replace('lydian', 'lyd')
    .replace('phrygian', 'phr')
    .replace('locrian', 'loc');
}

/** Default note length: 1/16 for 2/4, 1/8 for everything else */
function defaultNoteLen(meter) {
  return meter === '2/4' ? '1/16' : '1/8';
}

function buildAbc(setting, tune) {
  const key    = toAbcKey(setting.key);
  const meter  = tune?.meter  ?? '4/4';
  const type   = tune?.type   ?? '';
  const name   = tune?.name   ?? '';
  const L      = defaultNoteLen(meter);
  return `X:1\nT:${name}\nR:${type}\nM:${meter}\nL:${L}\nK:${key}\n${setting.abc}`;
}

function SheetMusic(props) {
  let containerRef;

  const settings = () => getSettings(props.tune?.tune_id);

  const [activeIdx, setActiveIdx] = createSignal(0);

  // When tune or settingId changes, reset and pin the right variant
  createEffect(() => {
    const s = getSettings(props.tune?.tune_id);
    if (!s.length) { setActiveIdx(0); return; }

    if (props.settingId != null) {
      const idx = s.findIndex(x => x.id === props.settingId);
      setActiveIdx(idx >= 0 ? idx : 0);
    } else {
      setActiveIdx(0);
    }
  });

  // Re-render whenever active setting or tune changes
  createEffect(() => {
    const s = settings();
    const idx = activeIdx();
    const setting = s[idx];
    if (!setting || !containerRef) return;

    abcjs.renderAbc(containerRef, buildAbc(setting, props.tune), {
      responsive: 'resize',
      add_classes: true,
      paddingright: 0,
      paddingleft: 0,
      paddingbottom: 8,
      paddingtop: 8,
    });
  });

  return (
    <Show when={settings().length > 0}>
      <div class="flex flex-col gap-2">

        {/* Setting picker — only when multiple variants exist */}
        <Show when={settings().length > 1}>
          <div class="flex items-center gap-1 flex-wrap">
            <span class="text-[10px] text-[var(--color-muted)] uppercase tracking-wider mr-1">
              Setting
            </span>
            <For each={settings()}>
              {(s, i) => (
                <button
                  onClick={() => setActiveIdx(i())}
                  class={`text-[10px] px-2 py-0.5 rounded-md border transition-colors
                    ${activeIdx() === i()
                      ? 'border-[var(--color-primary)]/60 bg-[var(--color-primary)]/15 text-[var(--color-primary)]'
                      : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-muted)]'
                    }`}
                >
                  {i() + 1}. {toAbcKey(s.key)}
                </button>
              )}
            </For>
          </div>
        </Show>

        {/* Sheet music canvas */}
        <div class="rounded-xl overflow-hidden bg-white px-3 py-1">
          <div ref={containerRef} class="w-full [&_svg]:w-full [&_svg]:h-auto" />
        </div>

      </div>
    </Show>
  );
}

export default SheetMusic;
