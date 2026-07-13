/**
 * MySubmissionsView.jsx
 * Historial y estado de las contribuciones del usuario.
 */

import { createSignal, onMount, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Video, Mic } from 'lucide-solid';
import { getMySubmissions } from '../lib/supabase';
import { extractYoutubeId } from '../lib/utils';
import { useAppStore } from '../store/appStore';

const STATUS_CONFIG = {
  new:        { label: 'Pending',  class: 'text-[var(--color-warning)] border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10' },
  llm_guess:  { label: 'Pending',  class: 'text-[var(--color-warning)] border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10' },
  reviewed:   { label: 'Approved', class: 'text-green-400 border-green-400/30 bg-green-400/10' },
  rejected:   { label: 'Rejected', class: 'text-[var(--color-error)] border-[var(--color-error)]/30 bg-[var(--color-error)]/10' },
};

function statusBadge(status) {
  const cfg = STATUS_CONFIG[status];
  if (!cfg) return <span class="text-[10px] px-2 py-0.5 rounded-full border border-[var(--color-border)] text-[var(--color-muted)]">{status}</span>;
  return <span class={`text-[10px] px-2 py-0.5 rounded-full border ${cfg.class}`}>{cfg.label}</span>;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MySubmissionsView() {
  const navigate = useNavigate();
  const { authUser, showAddForm, setShowAddForm } = useAppStore();
  const [submissions, setSubmissions] = createSignal([]);
  const [loading, setLoading] = createSignal(true);

  onMount(async () => {
    try {
      const data = await getMySubmissions();
      setSubmissions(data);
    } finally {
      setLoading(false);
    }
  });

  const isApproved = (s) => s.status === 'reviewed';
  const firstTuneId = (s) => s.tune_media_entries?.[0]?.tune_id ?? null;
  const youtubeId = (s) => extractYoutubeId(s.media_uri);

  return (
    <div class="max-w-3xl mx-auto">
      <h2 class="text-2xl font-black text-[var(--color-text)] mb-6">My Submissions</h2>

      <Show when={loading()}>
        <div class="flex items-center gap-3 py-16 justify-center">
          <div class="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <span class="text-sm text-[var(--color-muted)]">Loading…</span>
        </div>
      </Show>

      <Show when={!loading() && submissions().length === 0}>
        <div class="text-center py-16 border border-dashed border-[var(--color-border)] rounded-xl">
          <p class="text-[var(--color-muted)] text-sm">You haven't submitted any videos yet.</p>
          <p class="text-[var(--color-muted)] text-xs mt-1 mb-4">Share a YouTube video or record a tune — your contributions help build the collection!</p>
          <button
            onClick={() => { setShowAddForm(true); }}
            class="text-sm px-4 py-2 rounded-lg bg-[var(--color-primary)] text-black font-semibold hover:opacity-90 transition-opacity"
          >
            + Add a Video
          </button>
        </div>
      </Show>

      <Show when={!loading() && submissions().length > 0}>
        <div class="flex flex-col gap-3">
          <For each={submissions()}>
            {(sub) => {
              const ytId = youtubeId(sub);
              const tuneId = firstTuneId(sub);
              const approved = isApproved(sub);
              const isRecording = sub.source_type === 'user_recording';

              return (
                <div class="border border-[var(--color-border)] rounded-xl overflow-hidden bg-[var(--color-surface)]">
                  <div class="flex items-start gap-4 p-4">
                    {/* Thumbnail or icon */}
                    <div class="flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden bg-[var(--color-bg)]">
                      <Show
                        when={!isRecording && ytId}
                        fallback={
                          <div class="w-full h-full flex items-center justify-center bg-[var(--color-primary)]/10">
                            <Mic size={18} class="text-[var(--color-primary)]" />
                          </div>
                        }
                      >
                        <img
                          src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                          alt=""
                          class="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </Show>
                    </div>

                    <div class="flex-grow min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <Show when={!isRecording} fallback={<Mic size={12} class="text-[var(--color-primary)]" />}>
                          <Video size={12} class="text-[var(--color-muted)]" />
                        </Show>
                        <p class="text-sm font-semibold text-[var(--color-text)] truncate">
                          {sub.title || sub.performer_name || 'Untitled'}
                        </p>
                        {statusBadge(sub.status)}
                      </div>

                      <Show when={sub.channel}>
                        <p class="text-xs text-[var(--color-muted)] mt-0.5 truncate">{sub.channel}</p>
                      </Show>

                      <div class="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span class="text-[10px] text-[var(--color-muted)]/60">{formatDate(sub.created_at)}</span>

                        <Show when={approved && tuneId}>
                          <button
                            onClick={() => navigate(`/tune/${tuneId}`)}
                            class="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
                          >
                            View tune
                          </button>
                        </Show>

                        <Show when={sub.tune_media_entries?.length > 0}>
                          <For each={sub.tune_media_entries.sort((a, b) => a.position - b.position)}>
                            {(entry) => (
                              <a
                                href={`/tune/${entry.tune_id}`}
                                class="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
                              >
                                Tune #{entry.tune_id}
                              </a>
                            )}
                          </For>
                        </Show>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
}
