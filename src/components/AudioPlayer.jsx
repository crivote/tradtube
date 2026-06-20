/**
 * AudioPlayer.jsx
 * Reproductor de audio nativo con soporte de timestamps via rAF polling.
 * Reemplaza YoutubePlayer para grabaciones de usuario.
 *
 * Props: { mediaUri, startSec, endSec, autoplay, onEnd, performerName, notes }
 */

import { createEffect, createSignal, onCleanup, Show } from 'solid-js';
import { normalizeMediaTimestamps } from '../lib/utils';

export default function AudioPlayer(props) {
  let audioEl = null;
  const [currentTime, setCurrentTime] = createSignal(0);
  const [duration, setDuration] = createSignal(null);

  const effectiveTimestamps = () => normalizeMediaTimestamps(props.startSec, props.endSec, duration());
  const effectiveStartSec = () => effectiveTimestamps().startSec;
  const effectiveEndSec = () => effectiveTimestamps().endSec;

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
    if (!audioEl) return;
    const end = effectiveEndSec();
    if (end == null) return;
    if (audioEl.currentTime >= end) {
      audioEl.pause();
      audioEl.currentTime = effectiveStartSec();
      props.onEnd?.();
    }
  };

  // Seek to start_sec when audio loads
  const handleLoadedMetadata = () => {
    setDuration(audioEl?.duration ?? null);
    if (audioEl) {
      audioEl.currentTime = effectiveStartSec();
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

      <Show when={effectiveStartSec() != null}>
        <div class="flex items-center gap-2 text-[10px] text-[var(--color-muted)] font-mono">
          <span>{fmt(effectiveStartSec())}</span>
          <Show when={effectiveEndSec() != null}>
            <span>– {fmt(effectiveEndSec())}</span>
          </Show>
          <Show when={currentTime() > 0}>
            <span class="text-[var(--color-primary)]">| now: {fmt(currentTime())}</span>
          </Show>
        </div>
      </Show>
    </div>
  );
}
