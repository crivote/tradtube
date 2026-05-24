/**
 * YoutubePlayer.jsx
 * Reproductor YouTube con soporte de timestamps exactos via IFrame Player API.
 * Usa polling (150ms) para pausar al llegar a end_sec — necesario porque los
 * parámetros de URL no soportan end timestamp de forma fiable en sets.
 *
 * Props: { youtubeId, startSec, endSec, autoplay, onEnd }
 */

import { createEffect, createSignal, onCleanup } from 'solid-js';
import { RotateCcw } from 'lucide-solid';
import { useI18n } from '../i18n';

const SPEED_STOPS = [0.5, 0.75, 1];

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
                if (player?.getCurrentTime() >= endSec) {
                  player.pauseVideo();
                  clearPoll();
                  props.onEnd?.();
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
        <div class="relative flex-1">
          <input
            type="range"
            min="0.5"
            max="1"
            step="0.25"
            value={speed()}
            onInput={e => setSpeed(parseFloat(e.target.value))}
            class="speed-slider w-full"
            aria-label={`Playback speed: ${speed()}x`}
            aria-valuetext={`${speed()}x`}
          />
          <div class="flex justify-between text-[11px] text-[var(--color-muted)] mt-0.5 gap-1">
            {SPEED_STOPS.map(v => (
              <button
                onClick={() => setSpeed(v)}
                aria-label={`Set speed to ${v}x`}
                aria-pressed={speed() === v}
                class={`px-1.5 py-0.5 rounded min-w-[32px] hover:text-[var(--color-text)] transition-colors cursor-pointer
                  ${speed() === v ? 'text-[var(--color-primary)] font-semibold' : ''}`}
              >
                {v}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default YoutubePlayer;
