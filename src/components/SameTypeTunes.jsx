/**
 * SameTypeTunes.jsx
 * Fila horizontal de otras tunes del mismo tipo que tienen vídeos.
 */

import { createMemo, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useAppStore } from '../store/appStore';
import { searchTunesByType } from '../lib/db';
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

  const related = createMemo(() => {
    const tune = selectedTune();
    if (!tune || !videoDataReady()) return [];

    const counts = videoCountsByTune();

    return seededShuffle(
      searchTunesByType(tune.type, 500)
        .filter(t => t.tune_id !== tune.tune_id && counts.has(t.tune_id)),
      tune.tune_id,
    ).slice(0, 5);
  });

  return (
    <>
      <Show when={!videoDataReady()}>
        <div class="flex items-center gap-3 py-8 justify-center">
          <div class="w-5 h-5 border-2 border-[var(--color-warning)] border-t-transparent rounded-full animate-spin" />
          <span class="text-sm text-[var(--color-muted)]">{t('admin.loading')}</span>
        </div>
      </Show>
      <Show when={videoDataReady() && related().length > 0}>
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
