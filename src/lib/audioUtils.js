/**
 * audioUtils.js
 * Funciones puras para procesamiento de audio: WAV serialization, trim.
 * Sin dependencias del navegador — testables unitariamente.
 */

/**
 * Serializa un AudioBuffer (mono o stereo) a WAV en memoria.
 * ~20 líneas sin librería: PCM raw + header WAV.
 */
export function audioBufferToWav(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const bitsPerSample = 16;
  const format = 1; // PCM
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);

  const samples = numChannels === 2
    ? interleave(audioBuffer.getChannelData(0), audioBuffer.getChannelData(1))
    : audioBuffer.getChannelData(0);

  const dataSize = samples.length * (bitsPerSample / 8);
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
    view.setInt16(offset + i * 2, val, true);
  }

  return new Uint8Array(buffer);
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function interleave(left, right) {
  const length = left.length + right.length;
  const result = new Float32Array(length);
  for (let i = 0, j = 0; i < left.length; i++, j += 2) {
    result[j] = left[i];
    result[j + 1] = right[i];
  }
  return result;
}

/**
 * Recorta un AudioBuffer a [startSec, endSec].
 * Retorna un objeto simple { numberOfChannels, sampleRate, length, getChannelData(ch) }
 * sin depender de AudioContext. El caller crea el AudioBuffer si lo necesita.
 */
export function trimAudioBuffer(sourceBuffer, startSec, endSec) {
  const sampleRate = sourceBuffer.sampleRate;
  const numChannels = sourceBuffer.numberOfChannels;

  const startSample = Math.floor(startSec * sampleRate);
  const endSample = Math.floor(endSec * sampleRate);
  const frameCount = endSample - startSample;

  if (frameCount <= 0) throw new Error('Invalid trim range');

  const channelData = [];
  for (let ch = 0; ch < numChannels; ch++) {
    const srcData = sourceBuffer.getChannelData(ch);
    const dst = new Float32Array(frameCount);
    for (let i = 0; i < frameCount; i++) {
      dst[i] = srcData[startSample + i];
    }
    channelData.push(dst);
  }

  return {
    numberOfChannels: numChannels,
    sampleRate,
    length: frameCount,
    getChannelData(ch) { return channelData[ch]; },
    copyFromChannel() {},
    copyToChannel() {},
  };
}

/**
 * Calcula la duración en segundos de un AudioBuffer.
 */
export function getBufferDuration(buffer) {
  return buffer.length / buffer.sampleRate;
}
