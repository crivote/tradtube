/**
 * PlaylistManager.jsx
 * Manage user playlists — list mode (/playlists).
 */

import { For, Show, createEffect, createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Trash2, Globe, Lock, Plus } from 'lucide-solid';
import {
  getMyPlaylists,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
} from '../lib/supabase';
import { loginWithGoogle } from '../lib/supabase';
import { relativeTime } from '../lib/utils';
import { useAppStore } from '../store/appStore';
import { useI18n } from '../i18n';

function PlaylistManager() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { authUser, authInitialized, loggingIn, setLoggingIn, showToast } = useAppStore();

  const [playlists, setPlaylists] = createSignal([]);
  const [loading, setLoading] = createSignal(true);
  const [newName, setNewName] = createSignal('');
  const [creating, setCreating] = createSignal(false);

  const loadPlaylists = async () => {
    setLoading(true);
    try {
      const pls = await getMyPlaylists();
      setPlaylists(pls);
    } catch (err) {
      console.error('Failed to load playlists:', err);
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    if (authInitialized() && authUser()) {
      loadPlaylists();
    } else if (authInitialized() && !authUser()) {
      setLoading(false);
      setPlaylists([]);
    }
  });

  const handleCreate = async () => {
    const name = newName().trim();
    if (!name) return;
    setCreating(true);
    try {
      const pl = await createPlaylist({ name });
      setPlaylists(prev => [pl, ...prev]);
      setNewName('');
      showToast('Playlist created!', 'success');
    } catch (err) {
      showToast('Failed to create playlist', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleTogglePublic = async (pl) => {
    try {
      await updatePlaylist(pl.id, { is_public: !pl.is_public });
      setPlaylists(prev =>
        prev.map(p => (p.id === pl.id ? { ...p, is_public: !p.is_public } : p))
      );
    } catch (err) {
      showToast('Failed to update playlist', 'error');
    }
  };

  const handleDelete = async (pl) => {
    if (!confirm(`Delete "${pl.name}"? This cannot be undone.`)) return;
    try {
      await deletePlaylist(pl.id);
      setPlaylists(prev => prev.filter(p => p.id !== pl.id));
      showToast('Playlist deleted', 'success');
    } catch (err) {
      showToast('Failed to delete playlist', 'error');
    }
  };

  return (
    <div class="flex flex-col gap-6">
      <button
        onClick={() => navigate('/')}
        class="flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors w-fit"
      >
        {t('tune.backToSearch')}
      </button>

      <div>
        <h2 class="text-2xl font-black text-[var(--color-text)]">My Playlists</h2>
        <p class="text-sm text-[var(--color-muted)] mt-1">Create, manage, and share your playlists</p>
      </div>

      {/* Create new */}
      <div class="flex items-center gap-2">
        <input
          type="text"
          value={newName()}
          onInput={e => setNewName(e.target.value)}
          placeholder="New playlist name..."
          class="flex-1 max-w-sm text-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)]"
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
        />
        <button
          onClick={handleCreate}
          disabled={creating() || !newName().trim()}
          class="inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-[var(--color-primary)] text-black font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          <Plus size={14} />
          Create
        </button>
      </div>

      {/* Loading */}
      <Show when={loading()}>
        <div class="flex items-center gap-3 py-8 justify-center">
          <div class="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <span class="text-sm text-[var(--color-muted)]">Loading playlists...</span>
        </div>
      </Show>

      {/* Not authenticated */}
      <Show when={!loading() && authInitialized() && !authUser()}>
        <div class="flex flex-col items-center gap-3 py-6 px-6 rounded-2xl border border-[var(--color-border)] bg-white/60 dark:bg-white/5">
          <p class="text-sm text-[var(--color-text)]/90 font-medium">
            Log in to create and manage playlists
          </p>
          <button
            onClick={async () => {
              setLoggingIn(true);
              try { await loginWithGoogle(); }
              catch (err) { setLoggingIn(false); }
            }}
            disabled={loggingIn()}
            class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[var(--color-primary)]/40 text-[var(--color-primary)] font-semibold text-sm hover:bg-[var(--color-primary)]/10 transition-colors disabled:opacity-50"
          >
            Log in with Google
          </button>
        </div>
      </Show>

      {/* Empty state */}
      <Show when={!loading() && authUser() && playlists().length === 0}>
        <div class="text-center py-12">
          <p class="text-4xl mb-4">📋</p>
          <p class="text-lg font-semibold text-[var(--color-text)] mb-2">No playlists yet</p>
          <p class="text-sm text-[var(--color-muted)] mb-4">
            Create your first playlist above, then add tunes from their pages!
          </p>
        </div>
      </Show>

      {/* Playlist list */}
      <Show when={!loading() && playlists().length > 0}>
        <div class="flex flex-col gap-2">
          <For each={playlists()}>
            {(pl) => (
              <div class="flex items-center gap-3 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/30 transition-colors">
                <div
                  class="flex-1 min-w-0 cursor-pointer"
                  onClick={() => navigate(`/playlist/${pl.id}`)}
                >
                  <div class="flex items-center gap-1.5">
                    <span class="text-sm font-semibold text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors truncate">
                      {pl.name}
                    </span>
                  </div>
                  <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span class="text-[10px] text-[var(--color-muted)]">
                      {pl.item_count} {pl.item_count === 1 ? 'tune' : 'tunes'}
                    </span>
                    <Show when={pl.is_public} fallback={
                      <span class="text-[10px] text-[var(--color-muted)] inline-flex items-center gap-0.5">
                        <Lock size={10} /> Private
                      </span>
                    }>
                      <span class="text-[10px] text-[var(--color-primary)] inline-flex items-center gap-0.5">
                        <Globe size={10} /> Public
                      </span>
                    </Show>
                    <Show when={pl.created_at}>
                      <span class="text-[10px] text-[var(--color-muted)]">
                        · created {relativeTime(pl.created_at)}
                      </span>
                    </Show>
                    <Show when={pl.updated_at && pl.updated_at !== pl.created_at}>
                      <span class="text-[10px] text-[var(--color-muted)]">
                        · updated {relativeTime(pl.updated_at)}
                      </span>
                    </Show>
                  </div>
                </div>

                {/* Actions */}
                <button
                  onClick={() => handleTogglePublic(pl)}
                  class="p-1.5 text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors flex-shrink-0"
                  title={pl.is_public ? 'Make private' : 'Make public'}
                >
                  {pl.is_public ? <Globe size={14} /> : <Lock size={14} />}
                </button>
                <button
                  onClick={() => handleDelete(pl)}
                  class="p-1.5 text-[var(--color-muted)] hover:text-red-400 transition-colors flex-shrink-0"
                  title="Delete playlist"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

export default PlaylistManager;
