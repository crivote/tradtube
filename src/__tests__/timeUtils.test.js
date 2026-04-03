import { describe, it, expect } from 'vitest';

function formatTime(sec) {
  if (sec == null) return null;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

describe('formatTime', () => {
  it('formats seconds to m:ss', () => {
    expect(formatTime(227)).toBe('3:47');
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(60)).toBe('1:00');
    expect(formatTime(3600)).toBe('60:00');
  });

  it('pads single digit seconds', () => {
    expect(formatTime(5)).toBe('0:05');
    expect(formatTime(65)).toBe('1:05');
  });

  it('returns null for null/undefined', () => {
    expect(formatTime(null)).toBeNull();
    expect(formatTime(undefined)).toBeNull();
  });

  it('handles fractional seconds by flooring', () => {
    expect(formatTime(3.7)).toBe('0:03');
    expect(formatTime(227.9)).toBe('3:47');
  });
});
