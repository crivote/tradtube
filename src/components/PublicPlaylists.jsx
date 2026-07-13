/**
 * PublicPlaylists.jsx
 * Section showing recent public playlists on the home page.
 */

import { For, Show, createEffect, createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Globe, List } from 'lucide-solid';
import { getPublicPlaylists } from '../lib/supabase';

function PublicPlaylists() {
  const navigate = useNavigate();
  const [playlists, setPlaylists] = createSignal([]);
  const [loading, setLoading] = createSignal(true);

  createEffect(() => {
    setLoading(true);
    getPublicPlaylists(6)
      .then(pls => { setPlaylists(pls); setLoading(false); })
      .catch(() => { setLoading(false); });
  });

  return (
    <Show when={!loading() && playlists().length > 0}>
      <section class="max-w-6xl mx-auto px-4 pb-8">
        <h2 class="text-sm font-semibold text-[var(--color-muted)] uppercase tracking-wider mb-3">
          Public Playlists
        </h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <For each={playlists()}>
            {(pl) => (
              <div
                onClick={() => navigate(`/playlist/${pl.id}`)}
                class="border border-[var(--color-border)] bg-[var(--color-surface)] rounded-xl p-4 cursor-pointer hover:border-[var(--color-primary)]/30 transition-colors"
              >
                <div class="flex items-center gap-1.5 mb-1">
                  <Globe size={12} class="text-[var(--color-primary)] flex-shrink-0" />
                  <span class="text-sm font-semibold text-[var(--color-text)] truncate">
                    {pl.name}
                  </span>
                </div>
                <div class="flex items-center gap-2 text-[10px] text-[var(--color-muted)]">
                  <span>
                    {pl.item_count} {pl.item_count === 1 ? 'tune' : 'tunes'}
                  </span>
                </div>
              </div>
            )}
          </For>
        </div>
      </section>
    </Show>
  );
}

export default PublicPlaylists;
