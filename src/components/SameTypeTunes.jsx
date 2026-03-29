/**
 * SameTypeTunes.jsx
 * Fila horizontal de otras tunes del mismo tipo que tienen vídeos.
 */

import { createMemo, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useAppStore } from '../store/appStore';
import { searchTunesByType } from '../lib/db';

function SameTypeTunes() {
  const {
    selectedTune,
    videoCountsByTune, videoThumbnailsByTune, videoDataReady,
  } = useAppStore();
  const navigate = useNavigate();

  const related = createMemo(() => {
    const tune = selectedTune();
    if (!tune || !videoDataReady()) return [];
    const counts = videoCountsByTune();
    const pool = searchTunesByType(tune.type, 500)
      .filter(t => t.tune_id !== tune.tune_id && counts.has(t.tune_id));
    // Fisher-Yates shuffle then take 5
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 5);
  });

  return (
    <Show when={related().length > 0}>
      <div class="flex flex-col gap-3 mt-2">
        <h3 class="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider capitalize">
          More {selectedTune()?.type}s with videos
        </h3>
        <div class="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin scrollbar-thumb-[var(--color-border)] scrollbar-track-transparent">
          <For each={related()}>
            {(tune) => {
              const youtubeId = () => videoThumbnailsByTune().get(tune.tune_id);
              return (
                <button
                  onClick={() => navigate('/tune/' + tune.tune_id)}
                  class="flex-shrink-0 w-36 flex flex-col gap-1.5 text-left group"
                >
                  <div class="w-36 h-20 rounded-lg overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] group-hover:border-[var(--color-primary)]/60 transition-colors relative">
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
                  <span class="text-xs text-white/80 group-hover:text-white transition-colors leading-tight line-clamp-2">
                    {tune.name}
                  </span>
                </button>
              );
            }}
          </For>
        </div>
      </div>
    </Show>
  );
}

export default SameTypeTunes;
