import { describe, it, expect, vi } from 'vitest';
import { audioBufferToWav, trimAudioBuffer, getBufferDuration } from '../lib/audioUtils';

// Helper: create a fake AudioBuffer-like object
function createFakeBuffer(channels, length, sampleRate = 44100) {
  const data = [];
  for (let ch = 0; ch < channels; ch++) {
    const arr = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      arr[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5;
    }
    data.push(arr);
  }
  return {
    numberOfChannels: channels,
    sampleRate,
    length,
    duration: length / sampleRate,
    getChannelData(ch) { return data[ch]; },
    copyFromChannel() {},
    copyToChannel() {},
  };
}

describe('audioBufferToWav', () => {
  it('produces valid WAV header (mono)', () => {
    const buf = createFakeBuffer(1, 44100, 44100);
    const wav = audioBufferToWav(buf);

    // Check RIFF header
    const view = new DataView(wav.buffer);
    expect(String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3))).toBe('RIFF');
    expect(String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11))).toBe('WAVE');

    // fmt chunk
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(44100); // sample rate
    expect(view.getUint16(34, true)).toBe(16); // bits per sample

    // data chunk
    expect(String.fromCharCode(view.getUint8(36), view.getUint8(37), view.getUint8(38), view.getUint8(39))).toBe('data');

    // size should be 44 (header) + samples * 2 (16-bit)
    expect(wav.length).toBe(44 + 44100 * 2);
  });

  it('produces valid WAV header (stereo)', () => {
    const buf = createFakeBuffer(2, 22050, 44100);
    const wav = audioBufferToWav(buf);

    const view = new DataView(wav.buffer);
    expect(view.getUint16(22, true)).toBe(2); // stereo
    expect(wav.length).toBe(44 + 22050 * 2 * 2); // double samples for stereo
  });

  it('clamps samples to [-1, 1] range', () => {
    const buf = createFakeBuffer(1, 10, 44100);
    // Set samples outside range
    buf.getChannelData(0)[0] = 2.5;
    buf.getChannelData(0)[1] = -2.5;

    const wav = audioBufferToWav(buf);
    const view = new DataView(wav.buffer);

    // First sample should be clamped to max 16-bit value
    const s0 = view.getInt16(44, true);
    expect(s0).toBeLessThanOrEqual(32767);
    expect(s0).toBeGreaterThanOrEqual(-32768);

    const s1 = view.getInt16(46, true);
    expect(s1).toBeLessThanOrEqual(32767);
    expect(s1).toBeGreaterThanOrEqual(-32768);
  });
});

describe('getBufferDuration', () => {
  it('calculates duration from length and sampleRate', () => {
    const buf = createFakeBuffer(1, 44100, 44100);
    expect(getBufferDuration(buf)).toBe(1);

    const buf2 = createFakeBuffer(1, 88200, 44100);
    expect(getBufferDuration(buf2)).toBe(2);
  });
});

describe('trimAudioBuffer', () => {
  it('creates a trimmed buffer with correct frame count', () => {
    const buf = createFakeBuffer(1, 44100, 44100); // 1 second
    const trimmed = trimAudioBuffer(buf, 0.5, 1.0); // second half

    expect(trimmed.numberOfChannels).toBe(1);
    expect(trimmed.sampleRate).toBe(44100);
    expect(trimmed.length).toBe(22050); // 0.5 seconds of samples
  });

  it('creates trimmed stereo buffer', () => {
    const buf = createFakeBuffer(2, 44100, 44100);
    const trimmed = trimAudioBuffer(buf, 0.25, 0.75);

    expect(trimmed.numberOfChannels).toBe(2);
    expect(trimmed.length).toBe(22050); // 0.5 seconds
  });

  it('throws on invalid trim range', () => {
    const buf = createFakeBuffer(1, 44100, 44100);
    expect(() => trimAudioBuffer(buf, 1.0, 0.5)).toThrow('Invalid trim range');
    expect(() => trimAudioBuffer(buf, 0.5, 0.5)).toThrow('Invalid trim range');
  });
});
