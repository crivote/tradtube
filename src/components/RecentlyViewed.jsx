import { For, Show, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { ChevronLeft, ChevronRight, Music } from 'lucide-solid';
import { getRecentlyViewed } from '../lib/recentlyViewed';
import { useI18n } from '../i18n';

const TYPE_COLOR = {
  jig: 'bg-[var(--color-primary)]',
  reel: 'bg-blue-500',
  hornpipe: 'bg-[var(--color-warning)]',
  polka: 'bg-rose-500',
  slide: 'bg-violet-500',
  waltz: 'bg-cyan-500',
  march: 'bg-orange-500',
  'slip jig': 'bg-pink-500',
};

function RecentlyViewed() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const recentlyViewed = () => getRecentlyViewed();

  // Triple copy for seamless infinite scroll
  const allItems = () => {
    const list = recentlyViewed();
    return list.length > 1 ? [...list, ...list, ...list] : list;
  };

  let carouselRef;
  let isButtonScrolling = false;

  // Center on the middle copy once the DOM is laid out
  onMount(() => {
    centerCarousel();
  });

  const centerCarousel = () => {
    const container = carouselRef;
    if (!container) return;
    const list = recentlyViewed();
    if (list.length <= 1) return;
    const firstCard = container.firstElementChild;
    if (!firstCard) return;
    const cardWidth = firstCard.offsetWidth + 12;
    container.scrollLeft = cardWidth * list.length;
  };

  const singleSetWidth = () => {
    const container = carouselRef;
    if (!container) return 0;
    const list = recentlyViewed();
    if (list.length === 0) return 0;
    const firstCard = container.firstElementChild;
    if (!firstCard) return 0;
    return (firstCard.offsetWidth + 12) * list.length;
  };

  const resetScrollIfNeeded = () => {
    const container = carouselRef;
    if (!container) return;
    const sw = singleSetWidth();
    if (sw === 0) return;

    if (container.scrollLeft >= 2 * sw) {
      container.scrollLeft -= sw;
    } else if (container.scrollLeft < sw) {
      container.scrollLeft += sw;
    }
  };

  const scrollCarousel = (direction) => {
    const container = carouselRef;
    if (!container) return;
    const list = recentlyViewed();
    if (list.length <= 1) return;

    const firstCard = container.firstElementChild;
    if (!firstCard) return;
    const gap = 12;
    const cardWidth = firstCard.offsetWidth + gap;

    isButtonScrolling = true;

    if (direction === 'left') {
      container.scrollBy({ left: -cardWidth, behavior: 'smooth' });
    } else {
      container.scrollBy({ left: cardWidth, behavior: 'smooth' });
    }

    // After smooth scroll animation ends (~350ms), silently reset to middle copy
    setTimeout(() => {
      isButtonScrolling = false;
      resetScrollIfNeeded();
    }, 350);
  };

  // Handle manual scroll (touch) — silently reset when reaching duplicated boundaries
  const handleScroll = () => {
    if (isButtonScrolling) return;
    resetScrollIfNeeded();
  };

  const thumbnailUrl = (youtubeId) =>
    youtubeId ? `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg` : null;

  return (
    <Show when={recentlyViewed().length > 0}>
      <section class="w-full bg-[var(--color-surface)] border-y border-[var(--color-border)] py-6">
        <div class="max-w-6xl mx-auto px-4 mb-3">
          <h3 class="text-sm font-semibold text-[var(--color-text)] uppercase tracking-wider">
            {t('search.recentlyViewed')}
          </h3>
        </div>

        <div class="relative group/carousel">
          <div
            ref={el => { carouselRef = el; }}
            class="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory px-4 scrollbar-none"
            onScroll={handleScroll}
          >
            <For each={allItems()}>
              {(tune) => {
                const thumb = thumbnailUrl(tune.youtubeId);
                const typeBg = TYPE_COLOR[tune.type] ?? 'bg-[var(--color-muted)]';

                return (
                  <div
                    onClick={() => navigate('/tune/' + tune.tune_id)}
                    class="flex-shrink-0 w-56 sm:w-64 cursor-pointer snap-start group/card"
                  >
                    <div class="relative aspect-video rounded-xl overflow-hidden bg-[var(--color-bg)] border border-[var(--color-border)] transition-all group-hover/card:border-[var(--color-primary)]/50">
                      <Show
                        when={thumb}
                        fallback={(
                          <div class="w-full h-full flex flex-col items-center justify-center text-[var(--color-muted)] gap-2">
                            <Music size={28} />
                            <span class="text-xs">{t('search.noVideos')}</span>
                          </div>
                        )}
                      >
                        <img
                          src={thumb}
                          alt=""
                          class="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-105"
                          loading="lazy"
                        />
                      </Show>
                      <span class={`absolute top-2 left-2 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full text-white ${typeBg}`}>
                        {tune.type}
                      </span>
                    </div>
                    <p class="mt-2 text-sm font-medium text-[var(--color-text)] truncate transition-colors group-hover/card:text-[var(--color-primary)]">
                      {tune.name}
                    </p>
                  </div>
                );
              }}
            </For>
          </div>

          {/* Only show buttons when more than 1 item */}
          <Show when={recentlyViewed().length > 1}>
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

export default RecentlyViewed;
