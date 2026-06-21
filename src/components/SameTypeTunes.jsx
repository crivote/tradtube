/**
 * SameTypeTunes.jsx
 * Fila horizontal de otras tunes del mismo tipo que tienen vídeos.
 */

import { createSignal, onMount, createMemo, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useAppStore } from '../store/appStore';
import { searchTunesByType, getTuneById } from '../lib/db';
import { getSimilarTunes } from '../lib/supabase';
import { useI18n } from '../i18n';

function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function SameTypeTunes() {
  const {
    selectedTune,
    videoCountsByTune, videoThumbnailsByTune, videoDataReady,
  } = useAppStore();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [similarIds, setSimilarIds] = createSignal([]);
  const [loading, setLoading] = createSignal(true);

  onMount(async () => {
    const tune = selectedTune();
    if (!tune) {
      setLoading(false);
      return;
    }
    try {
      const ids = await getSimilarTunes(tune.tune_id);
      setSimilarIds(ids);
    } catch (err) {
      console.error('Failed to load similar tunes:', err);
    } finally {
      setLoading(false);
    }
  });

  const related = createMemo(() => {
    const tune = selectedTune();
    if (!tune || !videoDataReady()) return [];

    const counts = videoCountsByTune();

    const similarTunes = similarIds()
      .map(id => getTuneById(id))
      .filter(t => t && t.tune_id !== tune.tune_id && counts.has(t.tune_id));

    const usedIds = new Set(similarTunes.map(t => t.tune_id));
    usedIds.add(tune.tune_id);

    const fallbackPool = searchTunesByType(tune.type, 500)
      .filter(t => !usedIds.has(t.tune_id) && counts.has(t.tune_id));

    const shuffledFallback = seededShuffle(fallbackPool, tune.tune_id);

    return [...similarTunes, ...shuffledFallback].slice(0, 5);
  });

  return (
    <>
      <Show when={loading() || !videoDataReady()}>
        <div class="flex items-center gap-3 py-8 justify-center">
          <div class="w-5 h-5 border-2 border-[var(--color-warning)] border-t-transparent rounded-full animate-spin" />
          <span class="text-sm text-[var(--color-muted)]">{t('admin.loading')}</span>
        </div>
      </Show>
      <Show when={!loading() && videoDataReady() && related().length > 0}>
        <div class="flex flex-col gap-3 mt-2">
          <h3 class="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider capitalize">
            {t('sameType.more', { type: selectedTune()?.type })}
          </h3>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <For each={related()}>
              {(tune) => {
                const youtubeId = () => videoThumbnailsByTune().get(tune.tune_id);
                return (
                  <button
                    onClick={() => navigate('/tune/' + tune.tune_id)}
                    class="flex flex-col gap-1.5 text-left group w-full"
                  >
                    <div class="w-full aspect-video rounded-lg overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] group-hover:border-[var(--color-primary)]/60 transition-colors">
                      <Show when={youtubeId()} fallback={
                        <div class="w-full h-full flex items-center justify-center text-[var(--color-muted)] text-xl">♪</div>
                      }>
                        <img
                          src={`https://img.youtube.com/vi/${youtubeId()}/mqdefault.jpg`}
                          alt={tune.name}
                          class="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </Show>
                    </div>
                    <span class="text-xs text-[var(--color-text)]/80 group-hover:text-[var(--color-text)] transition-colors leading-tight line-clamp-2">
                      {tune.name}
                    </span>
                  </button>
                );
              }}
            </For>
          </div>
        </div>
      </Show>
    </>
  );
}

export default SameTypeTunes;
