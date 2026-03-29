/**
 * YoutubePlayer.jsx
 * Reproductor YouTube con soporte de timestamps exactos via IFrame Player API.
 * Usa polling (500ms) para pausar al llegar a end_sec — necesario porque los
 * parámetros de URL no soportan end timestamp de forma fiable en sets.
 *
 * Props: { youtubeId, startSec, endSec, autoplay, onEnd }
 */

import { createEffect, onCleanup } from 'solid-js';

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
        modestbranding: 1,
      },
      events: {
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
              }, 500);
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

  // Limpiar al desmontar el componente
  onCleanup(destroyPlayer);

  return (
    <div
      ref={containerRef}
      class="w-full aspect-video bg-black rounded-lg overflow-hidden"
    />
  );
}

export default YoutubePlayer;
