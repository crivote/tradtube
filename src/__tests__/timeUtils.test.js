import { describe, it, expect } from 'vitest';
import { formatTime, normalizeMediaTimestamps } from '../lib/utils';

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

describe('normalizeMediaTimestamps', () => {
  it('keeps explicit start and end times', () => {
    expect(normalizeMediaTimestamps(30, 120, 300)).toEqual({ startSec: 30, endSec: 120 });
  });

  it('defaults null start to 0', () => {
    expect(normalizeMediaTimestamps(null, 120, 300)).toEqual({ startSec: 0, endSec: 120 });
    expect(normalizeMediaTimestamps(undefined, 120, 300)).toEqual({ startSec: 0, endSec: 120 });
  });

  it('falls back null end to provided duration', () => {
    expect(normalizeMediaTimestamps(0, null, 300)).toEqual({ startSec: 0, endSec: 300 });
    expect(normalizeMediaTimestamps(0, undefined, 300)).toEqual({ startSec: 0, endSec: 300 });
  });

  it('falls back both nulls to 0 and duration', () => {
    expect(normalizeMediaTimestamps(null, null, 300)).toEqual({ startSec: 0, endSec: 300 });
  });

  it('keeps end null when duration is unknown', () => {
    expect(normalizeMediaTimestamps(null, null, null)).toEqual({ startSec: 0, endSec: null });
    expect(normalizeMediaTimestamps(0, null, undefined)).toEqual({ startSec: 0, endSec: null });
  });
});
