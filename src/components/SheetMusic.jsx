/**
 * SheetMusic.jsx
 * Renders ABC notation for a tune setting using abcjs.
 *
 * Settings are lazy-loaded from TheSession public API and cached in localStorage.
 *
 * Props:
 *   tune       — full tune object { tune_id, name, type, meter }
 *   settingId  — optional: pins a specific settings.id variation
 */

import { createSignal, createEffect, Show, For, onCleanup } from 'solid-js';
import abcjs from 'abcjs';

const CACHE_PREFIX = 'thesession_settings_';

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

function defaultNoteLen(meter) {
  return meter === '2/4' ? '1/16' : '1/8';
}

function buildAbc(setting, tune) {
  const key   = toAbcKey(setting.key);
  const meter = tune?.meter ?? '4/4';
  const type  = tune?.type  ?? '';
  const name  = tune?.name  ?? '';
  const L     = defaultNoteLen(meter);
  return `X:1\nT:${name}\nR:${type}\nM:${meter}\nL:${L}\nK:${key}\n${setting.abc}`;
}

async function fetchSettings(tuneId, signal) {
  if (!tuneId) return [];

  const cacheKey = CACHE_PREFIX + tuneId;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch {}
  }

  const res = await fetch(`https://thesession.org/tunes/${tuneId}?format=json`, { signal });
  if (!res.ok) throw new Error('Failed to fetch settings');
  const data = await res.json();
  const settings = data.settings || [];
  try { localStorage.setItem(cacheKey, JSON.stringify(settings)); } catch {}
  return settings;
}

function SheetMusic(props) {
  let containerRef;

  const [settings, setSettings] = createSignal(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal(null);
  const [activeIdx, setActiveIdx] = createSignal(0);

  let abortController = null;

  createEffect(() => {
    const tuneId = props.tune?.tune_id;
    if (!tuneId) {
      setSettings(null);
      setLoading(false);
      setError(null);
      setActiveIdx(0);
      return;
    }

    if (abortController) abortController.abort();
    abortController = new AbortController();

    setLoading(true);
    setError(null);

    fetchSettings(tuneId, abortController.signal)
      .then(s => {
        setSettings(s);
        setLoading(false);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setError(err);
        setLoading(false);
        setSettings(null);
      });

    onCleanup(() => {
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
    });
  });

  createEffect(() => {
    const s = settings();
    if (!s || !s.length) { setActiveIdx(0); return; }
    if (props.settingId != null) {
      const idx = s.findIndex(x => x.id === props.settingId);
      setActiveIdx(idx >= 0 ? idx : 0);
    } else {
      setActiveIdx(0);
    }
  });

  createEffect(() => {
    const s = settings();
    if (!s) return;
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
    <>
      <Show when={loading()}>
        <div class="rounded-xl overflow-hidden bg-white text-gray-800 ring-1 ring-black/5 shadow-md">
          <div class="flex items-center justify-center p-8">
            <div class="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            <span class="ml-2 text-sm text-gray-400">Loading sheet...</span>
          </div>
        </div>
      </Show>

      <Show when={!loading() && error()}>
        <div class="rounded-xl overflow-hidden bg-white/80 text-gray-800 ring-1 ring-black/5 shadow-md">
          <div class="p-4 text-center">
            <p class="text-sm text-gray-400">No se pudo cargar la partitura</p>
          </div>
        </div>
      </Show>

      <Show when={!loading() && !error() && settings() && settings().length > 0}>
        <div class="rounded-xl overflow-hidden bg-white text-gray-800 ring-1 ring-black/5 shadow-md">

          <Show when={settings().length > 1}>
            <div class="flex items-center gap-2 px-3 pt-2.5 pb-1 border-b border-gray-100">
              <span class="text-[10px] text-gray-400 uppercase tracking-wider">Setting</span>
              <select
                value={activeIdx()}
                onChange={e => setActiveIdx(Number(e.target.value))}
                class="text-xs text-gray-700 bg-transparent border border-gray-200 rounded-md px-2 py-0.5 focus:outline-none cursor-pointer"
              >
                <For each={settings()}>
                  {(s, i) => (
                    <option value={i()}>
                      {i() + 1}. {toAbcKey(s.key)}
                    </option>
                  )}
                </For>
              </select>
            </div>
          </Show>

          <div class="px-3 py-1 overflow-y-auto max-h-[420px]">
            <div ref={containerRef} class="w-full [&_svg]:w-full [&_svg]:h-auto" />
          </div>

        </div>
      </Show>
    </>
  );
}

export default SheetMusic;
