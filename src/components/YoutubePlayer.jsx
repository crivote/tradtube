/**
 * YoutubePlayer.jsx
 * Reproductor YouTube con soporte de timestamps exactos via IFrame Player API.
 * Usa polling (150ms) para pausar al llegar a end_sec — necesario porque los
 * parámetros de URL no soportan end timestamp de forma fiable en sets.
 *
 * Props: { youtubeId, startSec, endSec, autoplay, onEnd }
 */

import { createEffect, createSignal, onCleanup } from 'solid-js';
import { RotateCcw, Repeat, Play, Pause } from 'lucide-solid';
import { useI18n } from '../i18n';
import { formatTime, normalizeMediaTimestamps } from '../lib/utils';

// ── IFrame API loader (singleton global) ────────────────────────────────────
let ytApiReady = false;
let ytApiFailed = false;
const ytCallbacks = [];

function ensureYTApi(cb) {
  if (ytApiReady) { cb(); return; }
  if (ytApiFailed) {
    // If the API previously failed, retry by reloading the script
    const oldScript = document.getElementById('yt-iframe-api');
    if (oldScript) oldScript.remove();
    ytApiFailed = false;
  }
  ytCallbacks.push(cb);
  if (document.getElementById('yt-iframe-api')) return;

  window.onYouTubeIframeAPIReady = () => {
    ytApiReady = true;
    ytApiFailed = false;
    ytCallbacks.splice(0).forEach(fn => fn());
  };

  const script = document.createElement('script');
  script.id = 'yt-iframe-api';
  script.src = 'https://www.youtube.com/iframe_api';
  script.onerror = () => {
    console.error('[TradTube] YouTube IFrame API script failed to load. Check network or ad-blocker.');
    ytApiFailed = true;
    // Reject pending callbacks so they don't hang forever
    ytCallbacks.splice(0).forEach(fn => fn());
  };
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
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [mediaDuration, setMediaDuration] = createSignal(null);

  const effectiveTimestamps = () => normalizeMediaTimestamps(props.startSec, props.endSec, mediaDuration());
  const effectiveStartSec = () => effectiveTimestamps().startSec;
  const effectiveEndSec = () => effectiveTimestamps().endSec;

  const clearPoll = () => {
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
  };

  const startPoll = () => {
    clearPoll();
    pollInterval = setInterval(() => {
      const currentTime = player?.getCurrentTime?.();
      if (currentTime == null) return;
      const start = effectiveStartSec();
      const end = effectiveEndSec();
      if (end == null) return;
      const duration = end - start;
      if (duration > 0) {
        const elapsed = Math.max(0, currentTime - start);
        setProgress(Math.min(1, elapsed / duration));
      }
      if (currentTime >= end) {
        if (loop()) {
          player.seekTo(start, true);
          setProgress(0);
        } else {
          player.pauseVideo();
          clearPoll();
          props.onEnd?.();
        }
      }
    }, 150);
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
      host: 'https://www.youtube-nocookie.com',
      playerVars: {
        start: Math.floor(startSec ?? 0),
        autoplay: autoplay ? 1 : 0,
        rel: 0,
        origin: window.location.origin,
      },
      events: {
        onReady() {
          player.setPlaybackRate(speed());
          setMediaDuration(player.getDuration());
        },
        onStateChange(event) {
          if (event.data === window.YT.PlayerState.PLAYING) {
            setIsPlaying(true);
          } else if (event.data === window.YT.PlayerState.ENDED) {
            setIsPlaying(false);
            props.onEnd?.();
          } else {
            setIsPlaying(false);
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
    setMediaDuration(null);

    ensureYTApi(() => {
      if (!cancelled) buildPlayer(youtubeId, startSec, endSec, autoplay);
    });

    onCleanup(() => { cancelled = true; });
  });

  // Iniciar/detener polling de segmento según estado de reproducción y timestamps efectivos
  createEffect(() => {
    if (isPlaying() && effectiveEndSec() != null) {
      startPoll();
    } else {
      clearPoll();
    }
    onCleanup(clearPoll);
  });

  // Aplicar velocidad al player
  createEffect(() => {
    const rate = speed();
    player?.setPlaybackRate?.(rate);
  });

  // Limpiar al desmontar el componente
  onCleanup(destroyPlayer);

  const seekToStart = () => {
    const st = effectiveStartSec();
    if (player && st != null) {
      player.seekTo(st, true);
      player.playVideo();
      setIsPlaying(true);
    }
  };

  const togglePlayPause = () => {
    if (!player) return;
    if (isPlaying()) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  };

  const segmentDuration = () => Math.max(0, (effectiveEndSec() ?? 0) - (effectiveStartSec() ?? 0));
  const hasSegment = () => effectiveEndSec() != null && segmentDuration() > 0;

  const handleProgressClick = (e) => {
    if (!player || !hasSegment()) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const duration = segmentDuration();
    const targetTime = (effectiveStartSec() ?? 0) + ratio * duration;
    player.seekTo(targetTime, true);
    player.playVideo();
  };

  return (
    <div>
      <div
        ref={containerRef}
        class="w-full aspect-video bg-black rounded-lg overflow-hidden"
      />

      {/* Controls */}
      <div class="mt-3 px-1 flex items-center gap-3 flex-wrap sm:flex-nowrap">
        {/* Playback buttons */}
        <div class="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={seekToStart}
            aria-label={t('tune.restart')}
            title={t('tune.restart')}
            class="text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors p-1.5 rounded"
          >
            <RotateCcw size={18} />
          </button>
          <button
            onClick={togglePlayPause}
            aria-label={isPlaying() ? t('tune.pause') : t('tune.play')}
            title={isPlaying() ? t('tune.pause') : t('tune.play')}
            class="text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors p-1.5 rounded"
          >
            {isPlaying() ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
        </div>

        {/* Progress bar */}
        {hasSegment() && (
          <div class="flex-1 min-w-[120px] order-last sm:order-none w-full sm:w-auto">
            <div class="flex justify-between text-[11px] text-[var(--color-muted)] mb-1 font-mono">
              <span>{formatTime(progress() * segmentDuration())}</span>
              <span>-{formatTime((1 - progress()) * segmentDuration())}</span>
            </div>
            <div
              class="w-full h-2.5 bg-[var(--color-border)] rounded-full overflow-hidden cursor-pointer hover:ring-2 hover:ring-[var(--color-primary)]/30 transition-shadow"
              onClick={handleProgressClick}
              title={t('tune.seek')}
            >
              <div
                class="h-full rounded-full transition-none"
                style={{ width: `${progress() * 100}%`, 'background-color': `var(--color-primary)` }}
              />
            </div>
          </div>
        )}

        {/* Loop toggle */}
        <button
          onClick={() => setLoop(!loop())}
          aria-label={loop() ? t('tune.loopEnabled') : t('tune.loopDisabled')}
          title={loop() ? t('tune.loopEnabled') : t('tune.loopDisabled')}
          class={`p-1.5 rounded flex-shrink-0 transition-colors border ${loop() ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/10 border-[var(--color-primary)]/40' : 'text-[var(--color-muted)] hover:text-[var(--color-text)] border-transparent'}`}
        >
          <Repeat size={18} />
        </button>

        {/* Speed slider */}
        <div class="relative flex-shrink-0 w-24">
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
