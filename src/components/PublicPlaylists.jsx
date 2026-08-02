/**
 * PublicPlaylists.jsx
 * Horizontal carousel of recent public playlists on the home page.
 * Styled consistently with RecentlyAdded / RecentlyViewed carousels.
 */

import { For, Show, createSignal, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { ChevronLeft, ChevronRight, List } from 'lucide-solid';
import { getPublicPlaylists } from '../lib/supabase';

const ACCENT_COLORS = [
  'bg-emerald-500',
  'bg-blue-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-violet-500',
  'bg-cyan-500',
  'bg-orange-500',
  'bg-pink-500',
];

function PublicPlaylists() {
  const navigate = useNavigate();
  const [playlists, setPlaylists] = createSignal([]);
  const [loading, setLoading] = createSignal(true);

  let carouselRef;

  onMount(async () => {
    try {
      const pls = await getPublicPlaylists(12);
      setPlaylists(pls);
    } catch (err) {
      console.error('Failed to load public playlists:', err);
    } finally {
      setLoading(false);
    }
  });

  const scrollCarousel = (direction) => {
    const container = carouselRef;
    if (!container) return;
    const firstCard = container.firstElementChild;
    if (!firstCard) return;
    const gap = 12;
    const cardWidth = firstCard.offsetWidth + gap;
    const maxScroll = container.scrollWidth - container.clientWidth;

    if (direction === 'left') {
      if (container.scrollLeft <= 1) {
        container.scrollTo({ left: maxScroll, behavior: 'smooth' });
      } else {
        container.scrollBy({ left: -cardWidth, behavior: 'smooth' });
      }
    } else {
      if (container.scrollLeft >= maxScroll - 1) {
        container.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        container.scrollBy({ left: cardWidth, behavior: 'smooth' });
      }
    }
  };

  return (
    <Show when={!loading() && playlists().length > 0}>
      <section class="w-full bg-[var(--color-surface)] border-y border-[var(--color-border)] py-6">
        <div class="max-w-6xl mx-auto px-4 mb-3">
          <h3 class="text-sm font-semibold text-[var(--color-text)] uppercase tracking-wider">
            Public Playlists
          </h3>
        </div>

        <div class="relative group/carousel carousel-fade">
          <div
            ref={el => { carouselRef = el; }}
            class="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory px-4 scrollbar-none"
          >
            <For each={playlists()}>
              {(pl, idx) => {
                const accentBg = ACCENT_COLORS[idx() % ACCENT_COLORS.length];

                return (
                  <div
                    onClick={() => navigate(`/playlist/${pl.id}`)}
                    class="flex-shrink-0 w-48 sm:w-56 cursor-pointer snap-start group/card"
                  >
                    <div class="relative aspect-[4/3] rounded-xl overflow-hidden bg-[var(--color-bg)] shadow-sm transition-all group-hover/card:shadow-md group-hover/card:scale-[1.02]">
                      {/* Colored accent background with icon */}
                      <div class={`w-full h-full flex flex-col items-center justify-center gap-2 ${accentBg}`}>
                        <List size={32} class="text-white/80" />
                        <span class="text-xs font-medium text-white/70 px-3 text-center leading-tight truncate w-full">
                          {pl.name}
                        </span>
                      </div>
                    </div>
                    <p class="mt-2 text-sm font-medium text-[var(--color-text)] truncate transition-colors group-hover/card:text-[var(--color-primary)]">
                      {pl.name}
                    </p>
                    <p class="text-[11px] text-[var(--color-muted)]">
                      {pl.item_count} {pl.item_count === 1 ? 'tune' : 'tunes'}
                    </p>
                  </div>
                );
              }}
            </For>
          </div>

          <Show when={playlists().length > 1}>
            <button
              onClick={() => scrollCarousel('left')}
              class="absolute left-2 top-[calc(50%-1rem)] -translate-y-1/2 w-8 h-8 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] shadow flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]/50 opacity-0 group-hover/carousel:opacity-100 transition-opacity"
              aria-label="Scroll left"
            >
              <ChevronLeft size={18} />
            </button>

            <button
              onClick={() => scrollCarousel('right')}
              class="absolute right-2 top-[calc(50%-1rem)] -translate-y-1/2 w-8 h-8 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] shadow flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]/50 opacity-0 group-hover/carousel:opacity-100 transition-opacity"
              aria-label="Scroll right"
            >
              <ChevronRight size={18} />
            </button>
          </Show>
        </div>
      </section>
    </Show>
  );
}

export default PublicPlaylists;
