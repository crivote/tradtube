/**
 * TheSessionImportModal.jsx
 * Popup para buscar e importar un tracklist desde TheSession.org.
 *
 * Props:
 *   onImport(trackIdx, recording) — called when user clicks Import on a track
 *   onClose()                     — called when user clicks ✕
 */

import { createSignal, createEffect, onCleanup, Show, For } from 'solid-js';
import { searchRecordings, fetchRecording, formatTrackLabel } from '../lib/thesession';
import { useI18n } from '../i18n';

function TheSessionImportModal(props) {
  const { t } = useI18n();
  const [mode, setMode] = createSignal('search');
  const [query, setQuery] = createSignal('');
  const [results, setResults] = createSignal([]);
  const [recording, setRecording] = createSignal(null);
  const [searchLoading, setSearchLoading] = createSignal(false);
  const [recordingLoading, setRecordingLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  createEffect(() => {
    const q = query().trim();
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      setError('');
      try {
        const data = await searchRecordings(q);
        setResults(data.recordings || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
    onCleanup(() => clearTimeout(timer));
  });

  const selectRecording = async (id) => {
    setRecordingLoading(true);
    setError('');
    try {
      setRecording(await fetchRecording(id));
      setMode('recording');
    } catch (e) {
      setError(e.message);
    } finally {
      setRecordingLoading(false);
    }
  };

  const goBack = () => {
    setMode('search');
    setRecording(null);
    setError('');
  };

  const handleImport = (trackIdx) => {
    props.onImport(trackIdx, recording());
  };

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) props.onClose(); }}
    >
      <div class="relative w-full max-w-lg bg-[var(--color-bg)] border border-[var(--color-border)] rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">

        {/* Header */}
        <div class="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] flex-shrink-0">
          <div>
            <h3 class="text-base font-bold text-[var(--color-text)]">{t('theSession.title')}</h3>
            <p class="text-xs text-[var(--color-muted)] mt-0.5">
              {t('theSession.desc')}
            </p>
          </div>
          <button
            onClick={props.onClose}
            class="text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors text-lg leading-none ml-4"
            aria-label="Close"
          >✕</button>
        </div>

        {/* Body */}
        <div class="flex flex-col gap-4 px-5 py-4 overflow-y-auto">

          <Show when={error()}>
            <p class="text-xs text-[var(--color-error)]">{error()}</p>
          </Show>

          {/* ── Search mode ──────────────────────────────────────── */}
          <Show when={mode() === 'search'}>
            <div class="relative">
              <input
                type="text"
                placeholder={t('theSession.searchPlaceholder')}
                value={query()}
                onInput={e => setQuery(e.target.value)}
                autofocus
                class="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)] transition-colors text-sm"
              />
              <Show when={searchLoading()}>
                <div class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
              </Show>
            </div>

            <Show when={!searchLoading() && query().trim().length >= 2 && results().length === 0}>
              <p class="text-xs text-[var(--color-muted)] text-center py-2">{t('theSession.noResults')}</p>
            </Show>

            <Show when={results().length > 0}>
              <div class="flex flex-col divide-y divide-[var(--color-border)] border border-[var(--color-border)] rounded-xl overflow-hidden">
                <For each={results()}>
                  {(item) => (
                    <button
                      onClick={() => selectRecording(item.id)}
                      class="text-left px-4 py-3 hover:bg-[var(--color-surface)] transition-colors"
                    >
                      <p class="text-sm font-semibold text-[var(--color-text)] truncate">{item.name}</p>
                      <p class="text-xs text-[var(--color-muted)] truncate">
                        {item.artist?.name}
                      </p>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </Show>

          {/* ── Recording mode ───────────────────────────────────── */}
          <Show when={mode() === 'recording'}>
            {/* Back button */}
            <button
              onClick={goBack}
              class="text-xs text-[var(--color-primary)] hover:underline self-start"
            >
              ← {t('theSession.back')}
            </button>

            <Show when={recordingLoading()}>
              <div class="flex justify-center py-4">
                <div class="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
              </div>
            </Show>

            <Show when={!recordingLoading() && recording()}>
              <div class="border border-[var(--color-border)] rounded-xl overflow-hidden">
                <div class="px-4 py-3 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
                  <p class="text-xs text-[var(--color-muted)]">{recording().artist?.name}</p>
                  <p class="text-sm font-semibold text-[var(--color-text)]">{recording().name}</p>
                </div>

                <Show
                  when={recording().tracks?.length > 0}
                  fallback={
                    <p class="text-xs text-[var(--color-muted)] px-4 py-3">{t('theSession.noTracklist')}</p>
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
                            {t('theSession.import')}
                          </button>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </Show>
          </Show>

        </div>
      </div>
    </div>
  );
}

export default TheSessionImportModal;
