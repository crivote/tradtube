/**
 * AudioRecorder.jsx
 * Captura, waveform, trim y conversión a Opus en el navegador.
 *
 * Máquina de estados:
 *   idle → requesting_mic → recording → recorded → trimming → converting_loading_wasm → converting → ready
 *   mic_error (desde requesting_mic)
 *
 * Props:
 *   onAudioReady(blob, durationSeconds): void  — llamado al completar
 *   onCancel(): void                            — cancelar el flujo
 */

import { createSignal, createEffect, onCleanup, Show } from 'solid-js';
import { Mic } from 'lucide-solid';
import { audioBufferToWav, trimAudioBuffer, getBufferDuration } from '../lib/audioUtils';
import { blobToDataUrl } from '../lib/utils';

const RECORD_LIMIT_SEC = 600; // 10 minutos

const STATES = {
  IDLE: 'idle',
  REQUESTING_MIC: 'requesting_mic',
  COUNTDOWN: 'countdown',
  RECORDING: 'recording',
  RECORDED: 'recorded',
  TRIMMING: 'trimming',
  CONVERTING_LOADING_WASM: 'converting_loading_wasm',
  CONVERTING: 'converting',
  READY: 'ready',
  MIC_ERROR: 'mic_error',
};

export default function AudioRecorder(props) {
  const [state, setState] = createSignal(STATES.IDLE);
  const [elapsed, setElapsed] = createSignal(0);
  const [errorMsg, setErrorMsg] = createSignal('');
  const [trimStart, setTrimStart] = createSignal(0);
  const [trimEnd, setTrimEnd] = createSignal(0);
  const [duration, setDuration] = createSignal(0);
  const [conversionProgress, setConversionProgress] = createSignal(0);
  const [fileSize, setFileSize] = createSignal(0);
  const [micLevel, setMicLevel] = createSignal(0);
  const [objectUrl, setObjectUrl] = createSignal(null);
  const [waveformPeaks, setWaveformPeaks] = createSignal([]);

  let mediaStream = null;
  let mediaRecorder = null;
  let audioContext = null;
  let analyser = null;
  let chunks = [];
  let blob = null;
  let mimeType = 'audio/webm';
  let elapsedTimer = null;
  let canvasRef = null;
  const [staticCanvasEl, setStaticCanvasEl] = createSignal(null);
  const [overlayCanvasEl, setOverlayCanvasEl] = createSignal(null);
  const [audioEl, setAudioEl] = createSignal(null);
  let animFrame = null;

  // Reactive redraw when canvas mounts or trim/waveform changes
  createEffect(() => {
    const canvas = staticCanvasEl();
    if (!canvas) return;
    state();
    trimStart();
    trimEnd();
    waveformPeaks();
    duration();
    redrawStaticWaveform(canvas);
  });

  // Direct rAF loop for playback position (bypasses Solid reactivity for low latency)
  createEffect(() => {
    const overlay = overlayCanvasEl();
    const audio = audioEl();
    const s = state();
    if (!overlay || !audio || (s !== STATES.RECORDED && s !== STATES.READY)) {
      if (overlay) {
        const oc = overlay.getContext('2d');
        oc.clearRect(0, 0, overlay.width, overlay.height);
      }
      return;
    }
    const w = overlay.width;
    const h = overlay.height;
    const ctx = overlay.getContext('2d');
    let raf;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const dur = duration();
      if (dur <= 0) return;
      const t = audio.currentTime;
      if (t <= 0) { ctx.clearRect(0, 0, w, h); return; }
      const px = (t / dur) * w;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
      ctx.stroke();
    };
    raf = requestAnimationFrame(draw);
    onCleanup(() => cancelAnimationFrame(raf));
  });

  // ── helpers ──

  const cleanup = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      mediaStream = null;
    }
    if (audioContext) {
      audioContext.close().catch(() => {});
      audioContext = null;
    }
    if (elapsedTimer) clearInterval(elapsedTimer);
    if (animFrame) cancelAnimationFrame(animFrame);
    setObjectUrl(null);
    analyser = null;
    mediaRecorder = null;
    chunks = [];
    blob = null;
  };

  onCleanup(cleanup);

  const handleBeforeUnload = (e) => { e.preventDefault(); };

  // beforeunload when there's unsaved work
  const registerUnload = () => {
    window.addEventListener('beforeunload', handleBeforeUnload);
  };
  const unregisterUnload = () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };

  // ── actions ──

  const requestMic = async () => {
    setState(STATES.REQUESTING_MIC);
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(mediaStream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      mimeType = mime;
      mediaRecorder = new MediaRecorder(mediaStream, { mimeType });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      // Countdown before starting
      setState(STATES.COUNTDOWN);
      setElapsed(3);
      await new Promise(resolve => setTimeout(resolve, 1000));
      setElapsed(2);
      await new Promise(resolve => setTimeout(resolve, 1000));
      setElapsed(1);
      await new Promise(resolve => setTimeout(resolve, 1000));

      chunks = [];
      mediaRecorder.start();
      setState(STATES.RECORDING);
      setElapsed(0);
      setErrorMsg('');
      startElapsedTimer();
      startWaveform();
      registerUnload();
    } catch (err) {
      setState(STATES.MIC_ERROR);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg('Microphone access denied. Please enable it in your browser settings.');
      } else {
        setErrorMsg(err.message || 'Could not access microphone');
      }
    }
  };

  const stopRecording = () => {
    if (!mediaRecorder || mediaRecorder.state !== 'recording') return;

    // Capture mimeType before stopping
    const capturedMimeType = mimeType;

    mediaRecorder.onstop = async () => {
      blob = new Blob(chunks, { type: capturedMimeType });

      const dataUrl = await blobToDataUrl(blob);
      setObjectUrl(dataUrl);

      // Decode to get duration and waveform peaks
      try {
        const ctx = new AudioContext();
        const ab = await blob.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(ab);

        const dur = Math.ceil(audioBuffer.duration);
        setDuration(dur);
        setTrimEnd(dur);

        // Extract peaks for waveform rendering (mono downmix)
        const peaks = extractPeaks(audioBuffer, 200);
        setWaveformPeaks(peaks);

        ctx.close();
      } catch {
        // Non-critical: silent fail, audio still plays via <audio>
        setDuration(0);
      }

      setState(STATES.RECORDED);
    };

    mediaRecorder.stop();
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      mediaStream = null;
    }
    stopElapsedTimer();
    stopWaveform();
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close().catch(() => {});
      audioContext = null;
    }
    analyser = null;
    mediaRecorder = null;
  };

  const applyTrimAndConvert = async () => {
    if (!blob) return;
    setState(STATES.TRIMMING);
    try {
      const ctx = new AudioContext();
      if (ctx.state === 'suspended') await ctx.resume();
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      await ctx.close();

      const trimmed = trimAudioBuffer(audioBuffer, trimStart(), trimEnd());
      const wavBlob = audioBufferToWav(trimmed);
      const trimmedDuration = getBufferDuration(trimmed);

      await convertToOpus(wavBlob, trimmedDuration);
    } catch (err) {
      setErrorMsg('Error processing audio: ' + (err.message || 'Unknown error'));
      if (state() !== STATES.READY) setState(STATES.RECORDED);
    }
  };

  let ffmpegIframe = null;
  let ffmpegReady = false;
  let ffmpegReadyPromise = null;
  const ffmpegPending = new Map();

  const getFfmpegIframe = () => {
    if (ffmpegIframe) return ffmpegIframe;

    ffmpegIframe = document.createElement('iframe');
    ffmpegIframe.src = '/ffmpeg-worker.html';
    ffmpegIframe.style.display = 'none';
    document.body.appendChild(ffmpegIframe);

    const handler = (event) => {
      if (event.source !== ffmpegIframe?.contentWindow) return;
      const msg = event.data;
      if (msg.type === 'ready') {
        ffmpegReady = true;
        if (ffmpegReadyPromise) { ffmpegReadyPromise.resolve(); ffmpegReadyPromise = null; }
      } else if (msg.type === 'result') {
        const entry = ffmpegPending.get(msg.requestId);
        if (entry) { entry.resolve(msg.output); ffmpegPending.delete(msg.requestId); }
      } else if (msg.type === 'error') {
        const entry = ffmpegPending.get(msg.requestId);
        if (entry) { entry.reject(new Error(msg.error)); ffmpegPending.delete(msg.requestId); }
      }
    };
    window.addEventListener('message', handler);
    ffmpegIframe._handler = handler;

    return ffmpegIframe;
  };

  onCleanup(() => {
    if (ffmpegIframe) {
      if (ffmpegIframe._handler) window.removeEventListener('message', ffmpegIframe._handler);
      ffmpegIframe.remove();
      ffmpegIframe = null;
    }
    ffmpegReadyPromise?.reject?.(new Error('Component unmounted'));
    ffmpegReadyPromise = null;
    for (const entry of ffmpegPending.values()) {
      entry.reject(new Error('Component unmounted'));
    }
    ffmpegPending.clear();
  });

  const convertToOpus = async (wavBlob, trimmedDuration) => {
    setState(STATES.CONVERTING_LOADING_WASM);
    try {
      const iframe = getFfmpegIframe();

      if (!ffmpegReady) {
        await new Promise((resolve, reject) => {
          ffmpegReadyPromise = { resolve, reject };
        });
      }

      setState(STATES.CONVERTING);
      setConversionProgress(0);

      const wavBuffer = await wavBlob.arrayBuffer();

      const requestId = crypto.randomUUID();
      const output = await new Promise((resolve, reject) => {
        ffmpegPending.set(requestId, { resolve, reject });
        iframe.contentWindow.postMessage(
          { type: 'convert', requestId, wavBuffer },
          window.location.origin,
          [wavBuffer]
        );
      });

      const opusBlob = new Blob([output], { type: 'audio/ogg; codecs=opus' });
      setFileSize(opusBlob.size);

      const dataUrl = await blobToDataUrl(opusBlob);
      setObjectUrl(dataUrl);
      blob = opusBlob;

      setDuration(trimmedDuration);
      setState(STATES.READY);
      unregisterUnload();
      props.onAudioReady(opusBlob, trimmedDuration);
    } catch (err) {
      setErrorMsg('Conversion error: ' + (err.message || 'Unknown error'));
      if (state() !== STATES.READY) setState(STATES.RECORDED);
    }
  };

  const reset = () => {
    cleanup();
    setState(STATES.IDLE);
    setElapsed(0);
    setTrimStart(0);
    setTrimEnd(0);
    setDuration(0);
    setErrorMsg('');
    setConversionProgress(0);
    setFileSize(0);
    setMicLevel(0);
    setWaveformPeaks([]);
    setObjectUrl(null);
    unregisterUnload();
  };

  // ── elapsed timer ──

  const startElapsedTimer = () => {
    elapsedTimer = setInterval(() => {
      setElapsed(e => {
        const next = e + 1;
        if (next >= RECORD_LIMIT_SEC) stopRecording();
        return next;
      });
    }, 1000);
  };

  const stopElapsedTimer = () => {
    if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = null; }
  };

  // ── waveform (analyser node → canvas) ──

  const startWaveform = () => {
    if (!canvasRef || !analyser) return;
    const canvas = canvasRef;
    const ctx2d = canvas.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animFrame = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      const w = canvas.width;
      const h = canvas.height;
      ctx2d.clearRect(0, 0, w, h);

      ctx2d.lineWidth = 2;
      ctx2d.strokeStyle = 'var(--color-primary, #4ade80)';
      ctx2d.beginPath();

      const sliceWidth = w / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * h) / 2;
        if (i === 0) ctx2d.moveTo(x, y);
        else ctx2d.lineTo(x, y);
        x += sliceWidth;
      }
      ctx2d.stroke();

      // RMS level for meter
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = (dataArray[i] - 128) / 128;
        sum += v * v;
      }
      setMicLevel(Math.sqrt(sum / bufferLength));
    };
    draw();
  };

  const stopWaveform = () => {
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    if (canvasRef) {
      const ctx = canvasRef.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.width, canvasRef.height);
    }
  };

  // ── static waveform for preview ──

  function extractPeaks(audioBuffer, numBars = 200) {
    const data = audioBuffer.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / numBars));
    const peaks = [];
    for (let i = 0; i < data.length; i += step) {
      let max = 0;
      const end = Math.min(i + step, data.length);
      for (let j = i; j < end; j++) {
        const abs = Math.abs(data[j]);
        if (abs > max) max = abs;
      }
      peaks.push(max);
    }
    return peaks;
  }

  const redrawStaticWaveform = (canvas) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const peaks = waveformPeaks();
    if (peaks.length === 0) return;

    const barWidth = w / peaks.length;
    const halfH = h / 2;

    ctx.fillStyle = 'rgba(74, 222, 128, 0.35)';
    for (let i = 0; i < peaks.length; i++) {
      const x = i * barWidth;
      const peakH = peaks[i] * halfH;
      ctx.fillRect(x, halfH - peakH, barWidth - 1, peakH * 2);
    }

    if (duration() > 0) {
      const startX = (trimStart() / duration()) * w;
      const endX = (trimEnd() / duration()) * w;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(0, 0, startX, h);
      ctx.fillRect(endX, 0, w - endX, h);

      ctx.fillStyle = 'var(--color-primary, #4ade80)';
      ctx.fillRect(startX - 1, 0, 3, h);
      ctx.fillRect(endX - 1, 0, 3, h);
    }
  };

  // ── format time ──

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // ── render ──

  return (
    <div class="flex flex-col gap-4 max-w-lg mx-auto">
      {/* IDLE */}
      <Show when={state() === STATES.IDLE}>
        <button
          onClick={requestMic}
          class="w-full py-10 rounded-2xl border-2 border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors flex flex-col items-center gap-3"
        >
          <Mic size={40} />
          <span class="font-semibold">Record</span>
        </button>
      </Show>

      {/* REQUESTING_MIC */}
      <Show when={state() === STATES.REQUESTING_MIC}>
        <div class="flex items-center gap-3 py-16 justify-center">
          <div class="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <span class="text-sm text-[var(--color-muted)]">Requesting microphone…</span>
        </div>
      </Show>

      {/* COUNTDOWN */}
      <Show when={state() === STATES.COUNTDOWN}>
        <div class="flex items-center justify-center py-16">
          <span class="text-6xl font-black text-[var(--color-primary)] animate-pulse">{elapsed()}</span>
        </div>
      </Show>

      {/* RECORDING */}
      <Show when={state() === STATES.RECORDING}>
        <div class="flex flex-col gap-3">
          {/* Level meter */}
          <div class="w-full h-2 bg-[var(--color-bg)] rounded-full overflow-hidden">
            <div class="h-full bg-[var(--color-primary)] rounded-full transition-all duration-75" style={`width: ${micLevel() * 100}%`} />
          </div>

          <canvas ref={canvasRef} width="400" height="80" class="w-full h-20 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]" />

          <div class="flex items-center justify-between">
            <span class="text-sm font-mono text-[var(--color-text)]">{fmt(elapsed())}</span>
            <Show when={elapsed() >= RECORD_LIMIT_SEC - 60}>
              <span class="text-xs text-[var(--color-warning)]">{RECORD_LIMIT_SEC - elapsed()}s remaining</span>
            </Show>
          </div>

          <button onClick={stopRecording} class="w-full py-3 rounded-xl bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 text-[var(--color-error)] font-semibold text-sm hover:bg-[var(--color-error)]/20 transition-colors">
            Stop Recording
          </button>
        </div>
      </Show>

      {/* RECORDED */}
      <Show when={state() === STATES.RECORDED}>
        <div class="flex flex-col gap-3">
          <Show when={errorMsg()}>
            <div class="p-3 rounded-lg bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 text-sm text-[var(--color-error)]">
              {errorMsg()}
            </div>
          </Show>

          <div class="relative w-full h-20">
            <canvas
              ref={setStaticCanvasEl}
              width="400" height="80"
              class="absolute inset-0 w-full h-full rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]"
            />
            <canvas
              ref={setOverlayCanvasEl}
              width="400" height="80"
              class="absolute inset-0 w-full h-full pointer-events-none"
            />
          </div>

          <Show when={objectUrl()}>
            <audio ref={setAudioEl} controls src={objectUrl()} class="w-full h-10 rounded-lg" />
          </Show>

          <div class="flex flex-col gap-2">
            <label class="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">Trim</label>
            <div class="flex items-center gap-3">
              <div class="flex flex-col gap-1 flex-1">
                <span class="text-[10px] text-[var(--color-muted)]">Start</span>
                <input
                  type="range" min={0} max={duration() || 1} step={0.1}
                  value={trimStart()} onInput={e => { const v = parseFloat(e.target.value); if (v < trimEnd()) setTrimStart(v); }}
                  class="w-full accent-[var(--color-primary)]"
                />
                <span class="text-xs font-mono text-[var(--color-text)]">{fmt(trimStart())}</span>
              </div>
              <div class="flex flex-col gap-1 flex-1">
                <span class="text-[10px] text-[var(--color-muted)]">End</span>
                <input
                  type="range" min={0} max={duration() || 1} step={0.1}
                  value={trimEnd()} onInput={e => { const v = parseFloat(e.target.value); if (v > trimStart()) setTrimEnd(v); }}
                  class="w-full accent-[var(--color-primary)]"
                />
                <span class="text-xs font-mono text-[var(--color-text)]">{fmt(trimEnd())}</span>
              </div>
            </div>
            <p class="text-[10px] text-[var(--color-muted)] italic">Select the portion to keep. Silences and mistakes at the start/end will be removed.</p>
          </div>

          <div class="flex gap-3">
            <button onClick={reset} class="flex-1 py-3 rounded-xl border border-[var(--color-border)] text-[var(--color-muted)] font-semibold text-sm hover:text-[var(--color-text)] transition-colors">
              Record Again
            </button>
            <button onClick={applyTrimAndConvert} class="flex-1 py-3 rounded-xl bg-[var(--color-primary)] text-black font-semibold text-sm hover:opacity-90 transition-colors">
              Apply Trim & Convert
            </button>
          </div>
        </div>
      </Show>

      {/* TRIMMING */}
      <Show when={state() === STATES.TRIMMING}>
        <div class="flex items-center gap-3 py-16 justify-center">
          <div class="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <span class="text-sm text-[var(--color-muted)]">Trimming audio…</span>
        </div>
      </Show>

      {/* CONVERTING_LOADING_WASM */}
      <Show when={state() === STATES.CONVERTING_LOADING_WASM}>
        <div class="flex flex-col items-center gap-3 py-16">
          <div class="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <span class="text-sm text-[var(--color-muted)]">Loading audio converter…</span>
        </div>
      </Show>

      {/* CONVERTING */}
      <Show when={state() === STATES.CONVERTING}>
        <div class="flex flex-col gap-3 py-10">
          <div class="w-full bg-[var(--color-bg)] rounded-full h-3 overflow-hidden">
            <div class="h-full bg-[var(--color-primary)] rounded-full transition-all duration-200" style={`width: ${conversionProgress()}%`} />
          </div>
          <span class="text-sm text-[var(--color-muted)] text-center">Converting to Opus… {conversionProgress()}%</span>
        </div>
      </Show>

      {/* READY */}
      <Show when={state() === STATES.READY}>
        <div class="flex flex-col gap-3">
          <div class="relative w-full h-20">
            <canvas ref={setStaticCanvasEl} width="400" height="80" class="absolute inset-0 w-full h-full rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]" />
            <canvas ref={setOverlayCanvasEl} width="400" height="80" class="absolute inset-0 w-full h-full pointer-events-none" />
          </div>

          <Show when={objectUrl()}>
            <audio ref={setAudioEl} controls src={objectUrl()} class="w-full h-10 rounded-lg" />
          </Show>

          <div class="flex items-center justify-between text-xs text-[var(--color-muted)]">
            <span>Duration: {fmt(duration())}</span>
            <span>Size: {fileSize() > 1024 ? `${(fileSize() / 1024).toFixed(0)} KB` : `${fileSize()} B`}</span>
          </div>

          <p class="text-sm text-[var(--color-primary)] font-semibold">Audio ready to publish</p>

          <button onClick={reset} class="w-full py-3 rounded-xl border border-[var(--color-border)] text-[var(--color-muted)] font-semibold text-sm hover:text-[var(--color-text)] transition-colors">
            Record Again
          </button>
        </div>
      </Show>

      {/* MIC_ERROR */}
      <Show when={state() === STATES.MIC_ERROR}>
        <div class="flex flex-col gap-3 py-10 items-center text-center">
          <span class="text-2xl">🚫</span>
          <p class="text-sm text-[var(--color-error)] font-semibold">{errorMsg()}</p>
          <button onClick={reset} class="px-6 py-2 rounded-xl border border-[var(--color-border)] text-[var(--color-muted)] text-sm hover:text-[var(--color-text)] transition-colors">
            Try Again
          </button>
        </div>
      </Show>
    </div>
  );
}
