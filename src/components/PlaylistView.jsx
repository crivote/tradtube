/**
 * PlaylistView.jsx
 * Display a playlist (public or own). Stub — full implementation in Phase 4.
 */

import { Show, createEffect, createSignal } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { getPlaylist } from '../lib/supabase';
import { useAppStore } from '../store/appStore';

function PlaylistView() {
  const params = useParams();
  const navigate = useNavigate();
  const { authUser } = useAppStore();

  const [playlist, setPlaylist] = createSignal(null);
  const [loading, setLoading] = createSignal(true);

  createEffect(() => {
    setLoading(true);
    getPlaylist(params.id)
      .then(pl => { setPlaylist(pl); setLoading(false); })
      .catch(() => { setLoading(false); });
  });

  return (
    <div class="flex flex-col gap-6">
      <button
        onClick={() => navigate('/')}
        class="flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors w-fit"
      >
        ← Back
      </button>

      <Show when={loading()}>
        <div class="flex items-center gap-3 py-8 justify-center">
          <div class="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <span class="text-sm text-[var(--color-muted)]">Loading playlist...</span>
        </div>
      </Show>

      <Show when={!loading() && playlist()}>
        <h2 class="text-2xl font-black text-[var(--color-text)]">{playlist()?.name}</h2>
        <p class="text-sm text-[var(--color-muted)]">
          {playlist()?.items?.length || 0} tunes
        </p>
        <p class="text-xs text-[var(--color-muted)]">Full view coming soon...</p>
      </Show>

      <Show when={!loading() && !playlist()}>
        <div class="text-center py-16">
          <p class="text-4xl mb-4">📋</p>
          <p class="text-xl font-semibold text-[var(--color-text)] mb-2">Playlist not found</p>
        </div>
      </Show>
    </div>
  );
}

export default PlaylistView;
