/**
 * TheSessionImportModal.jsx
 * Popup para importar un tracklist desde TheSession.org.
 *
 * Props:
 *   onImport(trackIdx, recording) — called when user clicks Import on a track
 *   onClose()                     — called when user clicks ✕
 */

import { createSignal, createEffect, Show, For } from 'solid-js';
import { parseRecordingUrl, fetchRecording, formatTrackLabel } from '../lib/thesession';

function TheSessionImportModal(props) {
  const [recordingUrl, setRecordingUrl] = createSignal('');
  const [recording, setRecording] = createSignal(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  createEffect(async () => {
    const id = parseRecordingUrl(recordingUrl());
    if (!id) { setRecording(null); setError(''); return; }
    setLoading(true);
    setError('');
    setRecording(null);
    try {
      setRecording(await fetchRecording(id));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  });

  const handleImport = (trackIdx) => {
    props.onImport(trackIdx, recording());
  };

  return (
    /* Backdrop */
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) props.onClose(); }}
    >
      {/* Panel */}
      <div class="relative w-full max-w-lg bg-[var(--color-bg)] border border-[var(--color-border)] rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">

        {/* Header */}
        <div class="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] flex-shrink-0">
          <div>
            <h3 class="text-base font-bold text-white">Import from TheSession</h3>
            <p class="text-xs text-[var(--color-muted)] mt-0.5">
              Paste a recording URL or ID to load its tracklist
            </p>
          </div>
          <button
            onClick={props.onClose}
            class="text-[var(--color-muted)] hover:text-white transition-colors text-lg leading-none ml-4"
            aria-label="Close"
          >✕</button>
        </div>

        {/* Body */}
        <div class="flex flex-col gap-4 px-5 py-4 overflow-y-auto">

          {/* Input */}
          <div class="relative">
            <input
              type="text"
              placeholder="https://thesession.org/recordings/158 or recording ID"
              value={recordingUrl()}
              onInput={e => setRecordingUrl(e.target.value)}
              autofocus
              class="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-white placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)] transition-colors text-sm"
            />
            <Show when={loading()}>
              <div class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            </Show>
          </div>

          <Show when={error()}>
            <p class="text-xs text-red-400">{error()}</p>
          </Show>

          {/* Recording */}
          <Show when={recording()}>
            <div class="border border-[var(--color-border)] rounded-xl overflow-hidden">
              {/* Album header */}
              <div class="px-4 py-3 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
                <p class="text-xs text-[var(--color-muted)]">{recording().artist?.name}</p>
                <p class="text-sm font-semibold text-white">{recording().name}</p>
              </div>

              {/* Tracklist */}
              <Show
                when={recording().tracks?.length > 0}
                fallback={
                  <p class="text-xs text-[var(--color-muted)] px-4 py-3">No tracklist data available.</p>
                }
              >
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
                          onClick={() => handleImport(i())}
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
          </Show>

        </div>
      </div>
    </div>
  );
}

export default TheSessionImportModal;
