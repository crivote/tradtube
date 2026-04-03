import { describe, it, expect } from 'vitest';

function extractYoutubeId(input) {
  if (!input) return null;
  const s = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) return m[1];
  }
  return null;
}

describe('extractYoutubeId', () => {
  it('extracts video ID from watch URL', () => {
    expect(extractYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts video ID from youtu.be URL', () => {
    expect(extractYoutubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts video ID from embed URL', () => {
    expect(extractYoutubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('returns ID as-is if already 11 characters', () => {
    expect(extractYoutubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('returns null for invalid input', () => {
    expect(extractYoutubeId('')).toBeNull();
    expect(extractYoutubeId(null)).toBeNull();
    expect(extractYoutubeId('https://youtube.com')).toBeNull();
  });

  it('handles URLs with additional parameters', () => {
    expect(extractYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120')).toBe('dQw4w9WgXcQ');
  });
});

function parseSec(val) {
  const s = String(val ?? '').trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  const m = s.match(/^(\d+):(\d{2})$/);
  if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
  return null;
}

describe('parseSec', () => {
  it('parses seconds only', () => {
    expect(parseSec(227)).toBe(227);
    expect(parseSec('60')).toBe(60);
    expect(parseSec('0')).toBe(0);
  });

  it('parses mm:ss format', () => {
    expect(parseSec('3:47')).toBe(227);
    expect(parseSec('0:00')).toBe(0);
    expect(parseSec('10:30')).toBe(630);
  });

  it('returns null for empty/invalid input', () => {
    expect(parseSec('')).toBeNull();
    expect(parseSec(null)).toBeNull();
    expect(parseSec('abc')).toBeNull();
    expect(parseSec('1:2:3')).toBeNull();
  });
});

function formatSec(sec) {
  if (sec == null) return '';
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

describe('formatSec', () => {
  it('formats seconds to m:ss', () => {
    expect(formatSec(227)).toBe('3:47');
    expect(formatSec(0)).toBe('0:00');
    expect(formatSec(60)).toBe('1:00');
    expect(formatSec(630)).toBe('10:30');
  });

  it('pads single digit seconds with zero', () => {
    expect(formatSec(5)).toBe('0:05');
    expect(formatSec(65)).toBe('1:05');
  });

  it('returns empty string for null/undefined', () => {
    expect(formatSec(null)).toBe('');
    expect(formatSec(undefined)).toBe('');
  });
});
