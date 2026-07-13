/**
 * AddToPlaylistButton.jsx
 * Icon-only button (ListPlus) that opens a popover to add a tune entry to user playlists.
 */

import { createSignal, createEffect, Show, For } from 'solid-js';
import { ListPlus, Check, Plus, List } from 'lucide-solid';
import {
  getMyPlaylists,
  addToPlaylist,
  createPlaylist,
  isEntryInPlaylist,
} from '../lib/supabase';
import { loginWithGoogle } from '../lib/supabase';
import { useAppStore } from '../store/appStore';

function AddToPlaylistButton(props) {
  // props.entryId — the tune_media_entries.id to add
  const { authUser, showToast } = useAppStore();

  const [open, setOpen] = createSignal(false);
  const [playlists, setPlaylists] = createSignal([]);
  const [loading, setLoading] = createSignal(false);
  const [newName, setNewName] = createSignal('');
  const [creating, setCreating] = createSignal(false);
  const [addingId, setAddingId] = createSignal(null);
  const [entryStatus, setEntryStatus] = createSignal({}); // playlistId → bool

  let containerRef;

  // Close on outside click
  const handleClickOutside = (e) => {
    if (containerRef && !containerRef.contains(e.target)) {
      setOpen(false);
    }
  };

  createEffect(() => {
    if (open()) {
      document.addEventListener('click', handleClickOutside);
    } else {
      document.removeEventListener('click', handleClickOutside);
    }
  });

  // Load playlists when opening
  createEffect(() => {
    if (open() && authUser()) {
      setLoading(true);
      getMyPlaylists().then(async (pls) => {
        setPlaylists(pls);
        // Check which playlists already have this entry
        const status = {};
        await Promise.all(
          pls.map(async (p) => {
            status[p.id] = await isEntryInPlaylist(p.id, props.entryId);
          })
        );
        setEntryStatus(status);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  });

  const handleToggle = (e) => {
    e.stopPropagation();
    if (!authUser()) { loginWithGoogle(); return; }
    setOpen(v => !v);
  };

  const handleAdd = async (e, playlistId) => {
    e.stopPropagation();
    setAddingId(playlistId);
    try {
      await addToPlaylist(playlistId, props.entryId);
      setEntryStatus(s => ({ ...s, [playlistId]: true }));
      showToast('Added to playlist!', 'success');
    } catch (err) {
      showToast('Failed to add to playlist', 'error');
    } finally {
      setAddingId(null);
    }
  };

  const handleCreate = async (e) => {
    e.stopPropagation();
    const name = newName().trim();
    if (!name) return;
    setCreating(true);
    try {
      const pl = await createPlaylist({ name });
      await addToPlaylist(pl.id, props.entryId);
      setPlaylists(prev => [pl, ...prev]);
      setEntryStatus(s => ({ ...s, [pl.id]: true }));
      setNewName('');
      showToast('Created and added!', 'success');
    } catch (err) {
      showToast('Failed to create playlist', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div ref={containerRef} class="relative flex-shrink-0">
      <button
        onClick={handleToggle}
        aria-label="Add to playlist"
        class={`p-1.5 transition-colors ${open()
          ? 'text-[var(--color-primary)]'
          : 'text-[var(--color-muted)] hover:text-[var(--color-primary)]'
        }`}
        title="Add to playlist"
      >
        <ListPlus size={16} stroke-width="1.5" />
      </button>

      <Show when={open()}>
        <div
          class="absolute right-0 top-full mt-1 w-56 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-xl z-50 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <div class="px-3 py-2 border-b border-[var(--color-border)]">
            <p class="text-xs font-semibold text-[var(--color-muted)]">Add to playlist</p>
          </div>

          {/* Existing playlists */}
          <div class="max-h-48 overflow-y-auto">
            <Show when={loading()}>
              <div class="flex items-center justify-center py-4">
                <div class="w-4 h-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
              </div>
            </Show>

            <Show when={!loading() && playlists().length === 0}>
              <p class="text-xs text-[var(--color-muted)] px-3 py-4 text-center">
                No playlists yet. Create one below!
              </p>
            </Show>

            <For each={playlists()}>
              {(pl) => {
                const isIn = () => entryStatus()[pl.id];
                const isAdding = () => addingId() === pl.id;
                return (
                  <button
                    onClick={(e) => !isIn() && handleAdd(e, pl.id)}
                    disabled={isIn() || isAdding()}
                    class="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-[var(--color-primary)]/10 transition-colors disabled:opacity-50 disabled:cursor-default text-left"
                  >
                    <Show when={isIn()} fallback={<List size={14} class="text-[var(--color-muted)]" />}>
                      <Check size={14} class="text-green-400" />
                    </Show>
                    <span class="text-[var(--color-text)] truncate flex-1">{pl.name}</span>
                    <Show when={isAdding()}>
                      <div class="w-3 h-3 border border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                    </Show>
                  </button>
                );
              }}
            </For>
          </div>

          {/* New playlist input */}
          <div class="border-t border-[var(--color-border)] p-2 flex items-center gap-2">
            <input
              type="text"
              value={newName()}
              onInput={e => setNewName(e.target.value)}
              placeholder="New playlist..."
              class="flex-1 text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)]"
              onKeyDown={e => e.key === 'Enter' && handleCreate(e)}
            />
            <button
              onClick={handleCreate}
              disabled={creating() || !newName().trim()}
              class={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
                newName().trim()
                  ? 'bg-[var(--color-primary)] text-black hover:opacity-80'
                  : 'bg-[var(--color-border)] text-[var(--color-muted)]'
              }`}
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}

export default AddToPlaylistButton;
