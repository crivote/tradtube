/**
 * YoutubePlayer.jsx
 * Reproductor YouTube con soporte de timestamps exactos via IFrame Player API.
 * Usa polling (150ms) para pausar al llegar a end_sec — necesario porque los
 * parámetros de URL no soportan end timestamp de forma fiable en sets.
 *
 * Props: { youtubeId, startSec, endSec, autoplay, onEnd }
 */

import { createEffect, createSignal, onCleanup } from 'solid-js';
import { RotateCcw, Repeat } from 'lucide-solid';
import { useI18n } from '../i18n';

// ── IFrame API loader (singleton global) ────────────────────────────────────
let ytApiReady = false;
const ytCallbacks = [];

function ensureYTApi(cb) {
  if (ytApiReady) { cb(); return; }
  ytCallbacks.push(cb);
  if (document.getElementById('yt-iframe-api')) return;

  window.onYouTubeIframeAPIReady = () => {
    ytApiReady = true;
    ytCallbacks.splice(0).forEach(fn => fn());
  };

  const script = document.createElement('script');
  script.id = 'yt-iframe-api';
  script.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(script);
}

// ── Componente ───────────────────────────────────────────────────────────────
function YoutubePlayer(props) {
  let containerRef;
  let player = null;
  let pollInterval = null;

  const { t } = useI18n();
  const [speed, setSpeed] = createSignal(1);
  const [loop, setLoop] = createSignal(false);
  const [progress, setProgress] = createSignal(0);

  const clearPoll = () => {
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
  };

  const destroyPlayer = () => {
    clearPoll();
    if (player) { try { player.destroy(); } catch (_) {} player = null; }
  };

  const buildPlayer = (youtubeId, startSec, endSec, autoplay) => {
    destroyPlayer();
    if (!youtubeId || !containerRef) return;

    const el = document.createElement('div');
    containerRef.innerHTML = '';
    containerRef.appendChild(el);

    player = new window.YT.Player(el, {
      videoId: youtubeId,
      width: '100%',
      height: '100%',
      playerVars: {
        start: Math.floor(startSec ?? 0),
        autoplay: autoplay ? 1 : 0,
        rel: 0,
      },
      events: {
        onReady() {
          player.setPlaybackRate(speed());
        },
        onStateChange(event) {
          if (event.data === window.YT.PlayerState.PLAYING) {
            clearPoll();
            if (endSec != null) {
              pollInterval = setInterval(() => {
                const currentTime = player?.getCurrentTime();
                if (currentTime == null) return;
                const duration = endSec - startSec;
                if (duration > 0) {
                  const elapsed = Math.max(0, currentTime - startSec);
                  setProgress(Math.min(1, elapsed / duration));
                }
                if (currentTime >= endSec) {
                  if (loop()) {
                    player.seekTo(startSec, true);
                    setProgress(0);
                  } else {
                    player.pauseVideo();
                    clearPoll();
                    props.onEnd?.();
                  }
                }
              }, 150);
            }
          } else if (event.data === window.YT.PlayerState.ENDED) {
            clearPoll();
            props.onEnd?.();
          } else {
            clearPoll();
          }
        },
      },
    });
  };

  // Reaccionar a cambios de props (nuevo vídeo o nuevos timestamps)
  createEffect(() => {
    const youtubeId = props.youtubeId;
    const startSec  = props.startSec;
    const endSec    = props.endSec;
    const autoplay  = props.autoplay;
    let cancelled = false;

    setProgress(0);

    ensureYTApi(() => {
      if (!cancelled) buildPlayer(youtubeId, startSec, endSec, autoplay);
    });

    onCleanup(() => { cancelled = true; });
  });

  // Aplicar velocidad al player
  createEffect(() => {
    const rate = speed();
    player?.setPlaybackRate?.(rate);
  });

  // Limpiar al desmontar el componente
  onCleanup(destroyPlayer);

  const seekToStart = () => {
    const st = props.startSec;
    if (player && st != null) {
      player.seekTo(st, true);
      player.playVideo();
    }
  };

  return (
    <div>
      <div
        ref={containerRef}
        class="w-full aspect-video bg-black rounded-lg overflow-hidden"
      />

      {/* Progress bar */}
      {props.endSec != null && (
        <div class="w-full h-1 bg-[var(--color-border)] rounded-full mt-1">
          <div
            class="h-1 rounded-full transition-none"
            style={{ width: `${progress() * 100}%`, 'background-color': `var(--color-primary)` }}
          />
        </div>
      )}

      {/* Controls */}
      <div class="mt-2 px-1 flex items-center gap-3">
        <button
          onClick={seekToStart}
          aria-label={t('tune.restart')}
          title={t('tune.restart')}
          class="text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors p-1 rounded flex-shrink-0"
        >
          <RotateCcw size={16} />
        </button>
        <button
          onClick={() => setLoop(!loop())}
          aria-label={t('tune.loop')}
          title={t('tune.loop')}
          class={`p-1 rounded flex-shrink-0 transition-colors ${loop() ? 'text-[var(--color-primary)]' : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'}`}
        >
          <Repeat size={16} />
        </button>
        <div class="relative flex-1">
          <input
            type="range"
            min="0.5"
            max="1"
            step="0.05"
            value={speed()}
            onInput={e => setSpeed(parseFloat(e.target.value))}
            class="speed-slider w-full"
            aria-label={`Playback speed: ${speed()}x`}
            aria-valuetext={`${speed()}x`}
          />
           <div class="flex justify-center text-[11px] text-[var(--color-muted)] mt-0.5">
             <span class="text-[var(--color-primary)] font-semibold">{speed()}x</span>
           </div>
        </div>
      </div>
    </div>
  );
}

export default YoutubePlayer;
