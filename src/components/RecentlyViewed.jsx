import { For, Show } from 'solid-js';
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

  let carouselRef;

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
            class="flex gap-3 overflow-x-auto [&::-webkit-scrollbar]:hidden scroll-smooth snap-x snap-mandatory px-4"
          >
            <For each={recentlyViewed()}>
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
        </div>
      </section>
    </Show>
  );
}

export default RecentlyViewed;
