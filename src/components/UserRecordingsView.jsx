/**
 * UserRecordingsView.jsx
 * Vista de grabaciones propias: reproductor, hide/show, download, delete.
 */

import { createSignal, onMount, For, Show } from 'solid-js';
import { getUserRecordings, toggleHidden, deleteRecording } from '../lib/supabase';
import { useAppStore } from '../store/appStore';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function UserRecordingsView(props) {
  const { authUser, showToast } = useAppStore();
  const [recordings, setRecordings] = createSignal([]);
  const [loading, setLoading] = createSignal(true);
  const [actionId, setActionId] = createSignal(null);
  const [confirmDelete, setConfirmDelete] = createSignal(null);

  const load = async () => {
    setLoading(true);
    const data = await getUserRecordings(authUser()?.id);
    setRecordings(data || []);
    setLoading(false);
  };

  onMount(load);

  const handleToggleHidden = async (recording) => {
    setActionId(recording.id);
    try {
      await toggleHidden(recording.id, !recording.hidden);
      setRecordings(prev => prev.map(r =>
        r.id === recording.id ? { ...r, hidden: !r.hidden } : r
      ));
    } catch {
      showToast('Failed to update visibility', 'error');
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (recording) => {
    setActionId(recording.id);
    try {
      await deleteRecording(recording.id);
      setRecordings(prev => prev.filter(r => r.id !== recording.id));
      setConfirmDelete(null);
      showToast('Recording deleted', 'info');
    } catch {
      showToast('Failed to delete recording', 'error');
    } finally {
      setActionId(null);
    }
  };

  const handleDownload = async (recording) => {
    try {
      const res = await fetch(recording.media_uri);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recording-${recording.id.slice(0, 8)}.ogg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast('Failed to download', 'error');
    }
  };

  return (
    <div class="flex flex-col gap-5">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-black text-[var(--color-text)]">My Recordings</h2>
        <button onClick={props.onClose} class="text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors">✕ Close</button>
      </div>

      <Show when={loading()}>
        <div class="flex items-center gap-3 py-16 justify-center">
          <div class="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <span class="text-sm text-[var(--color-muted)]">Loading…</span>
        </div>
      </Show>

      <Show when={!loading() && recordings().length === 0}>
        <div class="text-center py-16 border border-dashed border-[var(--color-border)] rounded-xl">
          <p class="text-[var(--color-muted)] text-sm">No recordings yet.</p>
          <p class="text-[var(--color-muted)] text-xs mt-1">Record a tune from its page to see it here.</p>
        </div>
      </Show>

      <Show when={!loading() && recordings().length > 0}>
        <div class="flex flex-col gap-3">
          <For each={recordings()}>
            {(rec) => {
              const isBusy = () => actionId() === rec.id;
              const tunes = rec.tune_media_entries || [];
              return (
                <div class={`border rounded-xl overflow-hidden ${rec.hidden ? 'border-[var(--color-warning)]/30 opacity-60' : 'border-[var(--color-border)]'} bg-[var(--color-surface)]`}>
                  <div class="flex items-start gap-4 p-4">
                    <div class="flex-shrink-0 w-12 h-12 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center">
                      <svg class="w-5 h-5 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" fill="currentColor" opacity="0.2"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                    </div>

                    <div class="flex-grow min-w-0">
                      <p class="text-sm font-semibold text-[var(--color-text)] truncate">
                        {rec.performer_name || 'Unknown'}
                      </p>
                      <div class="flex items-center gap-2 flex-wrap mt-0.5">
                        <span class="text-[10px] text-[var(--color-muted)]">{formatDate(rec.created_at)}</span>
                        <Show when={rec.hidden}>
                          <span class="text-[10px] px-2 py-0.5 rounded-full border border-[var(--color-warning)]/30 text-[var(--color-warning)] bg-[var(--color-warning)]/10">Hidden</span>
                        </Show>
                      </div>
                      <Show when={rec.recording_notes}>
                        <p class="text-xs text-[var(--color-muted)] mt-1 truncate">{rec.recording_notes}</p>
                      </Show>
                      <Show when={tunes.length > 0}>
                        <div class="flex flex-wrap gap-1 mt-2">
                          <For each={tunes.sort((a, b) => a.position - b.position)}>
                            {(entry) => (
                              <a
                                href={`/tune/${entry.tune_id}`}
                                class="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
                              >
                                Tune #{entry.tune_id}
                              </a>
                            )}
                          </For>
                        </div>
                      </Show>
                    </div>

                    <audio controls src={rec.media_uri} class="h-8 w-48 flex-shrink-0" />
                  </div>

                  <div class="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-bg)] border-t border-[var(--color-border)] flex-wrap">
                    <button
                      onClick={() => handleDownload(rec)}
                      disabled={isBusy()}
                      class="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-muted)]/50 transition-colors disabled:opacity-30"
                    >Download</button>
                    <button
                      onClick={() => handleToggleHidden(rec)}
                      disabled={isBusy()}
                      class="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-muted)]/50 transition-colors disabled:opacity-30"
                    >{rec.hidden ? 'Show' : 'Hide'}</button>
                    <div class="flex-grow" />
                    <button
                      onClick={() => setConfirmDelete(rec.id)}
                      disabled={isBusy()}
                      class="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-error)]/30 text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-colors disabled:opacity-30"
                    >{isBusy() ? '…' : 'Delete'}</button>
                  </div>

                  <Show when={confirmDelete() === rec.id}>
                    <div class="border-t border-[var(--color-error)]/30 bg-[var(--color-error)]/5 p-4 flex items-center gap-3">
                      <p class="text-sm text-[var(--color-error)] flex-grow">Delete this recording permanently? This cannot be undone.</p>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        class="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
                      >Cancel</button>
                      <button
                        onClick={() => handleDelete(rec)}
                        class="text-xs px-3 py-1.5 rounded-lg bg-[var(--color-error)] text-white font-semibold hover:opacity-90 transition-colors"
                      >Delete</button>
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
}
