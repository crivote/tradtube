/**
 * AudioPlayer.jsx
 * Reproductor de audio nativo con soporte de timestamps via rAF polling.
 * Reemplaza YoutubePlayer para grabaciones de usuario.
 *
 * Props: { mediaUri, startSec, endSec, autoplay, onEnd, performerName, notes }
 */

import { createEffect, createSignal, onCleanup, Show } from 'solid-js';

export default function AudioPlayer(props) {
  let audioEl = null;
  const [currentTime, setCurrentTime] = createSignal(0);

  // rAF polling — ~16ms precision vs timeupdate's ~250ms
  // Pauses polling when audio is paused to save CPU
  createEffect(() => {
    const el = audioEl;
    if (!el) return;

    let raf;
    let running = false;

    const poll = () => {
      raf = requestAnimationFrame(poll);
      setCurrentTime(el.currentTime);
    };

    const startPoll = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(poll);
    };

    const stopPoll = () => {
      running = false;
      if (raf) { cancelAnimationFrame(raf); raf = null; }
    };

    el.addEventListener('play', startPoll);
    el.addEventListener('pause', stopPoll);
    el.addEventListener('ended', stopPoll);

    if (!el.paused) startPoll();

    onCleanup(() => {
      stopPoll();
      el.removeEventListener('play', startPoll);
      el.removeEventListener('pause', stopPoll);
      el.removeEventListener('ended', stopPoll);
    });
  });

  const handleTimeUpdate = () => {
    if (!audioEl || props.endSec == null) return;
    if (audioEl.currentTime >= props.endSec) {
      audioEl.pause();
      audioEl.currentTime = props.startSec ?? 0;
      props.onEnd?.();
    }
  };

  // Seek to start_sec when audio loads
  const handleLoadedMetadata = () => {
    if (audioEl && props.startSec != null) {
      audioEl.currentTime = props.startSec;
    }
  };

  // Autoplay
  createEffect(() => {
    if (props.autoplay && audioEl) {
      audioEl.play().catch(() => {});
    }
  });

  const fmt = (s) => {
    if (s == null) return '';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  return (
    <div class="flex flex-col gap-2">
      <audio
        ref={audioEl}
        src={props.mediaUri}
        controls
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        class="w-full h-10 rounded-lg"
      />

      <Show when={props.performerName}>
        <p class="text-xs text-[var(--color-muted)]">
          Played by <span class="text-[var(--color-text)] font-medium">{props.performerName}</span>
          <Show when={props.notes}>
            <span class="mx-1">·</span>{props.notes}
          </Show>
        </p>
      </Show>

      <Show when={props.startSec != null}>
        <div class="flex items-center gap-2 text-[10px] text-[var(--color-muted)] font-mono">
          <span>{fmt(props.startSec)}</span>
          <Show when={props.endSec != null}>
            <span>– {fmt(props.endSec)}</span>
          </Show>
          <Show when={currentTime() > 0}>
            <span class="text-[var(--color-primary)]">| now: {fmt(currentTime())}</span>
          </Show>
        </div>
      </Show>
    </div>
  );
}
