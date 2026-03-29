/**
 * SheetMusic.jsx
 * Renders ABC notation for a tune setting using abcjs.
 *
 * Props:
 *   tuneId     — SQLite tune_id
 *   settingId  — optional: pins a specific settings.id variation
 */

import { createSignal, createEffect, Show, For } from 'solid-js';
import abcjs from 'abcjs';
import { getSettings } from '../lib/db';

function SheetMusic(props) {
  let containerRef;

  const settings = () => getSettings(props.tuneId);

  // Active setting index (not id) so we can always fall back to 0
  const [activeIdx, setActiveIdx] = createSignal(0);

  // When tuneId or settingId changes, reset and pin the right setting
  createEffect(() => {
    const s = getSettings(props.tuneId);
    if (!s.length) { setActiveIdx(0); return; }

    if (props.settingId != null) {
      const idx = s.findIndex(x => x.id === props.settingId);
      setActiveIdx(idx >= 0 ? idx : 0);
    } else {
      setActiveIdx(0);
    }
  });

  // Re-render whenever the active setting or the container changes
  createEffect(() => {
    const s = settings();
    const idx = activeIdx();
    const setting = s[idx];
    if (!setting || !containerRef) return;

    abcjs.renderAbc(containerRef, setting.abc, {
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

        {/* Setting picker — only shown when there are multiple variants */}
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
                  {i() + 1}. {s.key}
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
