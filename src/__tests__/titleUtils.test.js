import { describe, it, expect } from 'vitest';
import { cleanTitleForDisplay } from '../lib/utils';

describe('cleanTitleForDisplay', () => {
  it('returns original title when no matches', () => {
    const title = 'Some Video Title';
    expect(cleanTitleForDisplay(title, [])).toBe(title);
  });

  it('removes matched tune names from title', () => {
    const title = 'The Banshee - Irish Traditional';
    const matched = [{ name: 'The Banshee' }];
    const result = cleanTitleForDisplay(title, matched);
    expect(result).toContain('Irish Traditional');
    expect(result).not.toContain('Banshee');
  });

  it('handles multiple matched tunes', () => {
    const title = 'Morrison\'s Jig and Drops of Brandy - Session';
    const matched = [
      { name: "Morrison's Jig" },
      { name: 'Drops of Brandy' }
    ];
    const result = cleanTitleForDisplay(title, matched);
    expect(result).toContain('Session');
    expect(result).not.toContain('Morrison');
    expect(result).not.toContain('Brandy');
  });

  it('returns original title if all content removed', () => {
    const title = 'The Banshee';
    const matched = [{ name: 'The Banshee' }];
    expect(cleanTitleForDisplay(title, matched)).toBe(title);
  });

  it('handles regex special characters in tune names', () => {
    const title = 'The Star (Above the Garter) - Demo';
    const matched = [{ name: 'Star (Above the Garter)' }];
    const result = cleanTitleForDisplay(title, matched);
    expect(result).toContain('Demo');
    expect(result).not.toContain('Star');
  });
});

import { STOP_WORDS } from '../lib/db';

describe('STOP_WORDS', () => {
  it('contains common words that should be filtered', () => {
    expect(STOP_WORDS.has('the')).toBe(true);
    expect(STOP_WORDS.has('and')).toBe(true);
    expect(STOP_WORDS.has('session')).toBe(true);
    expect(STOP_WORDS.has('music')).toBe(true);
  });

  it('contains tune type words to avoid false positives', () => {
    expect(STOP_WORDS.has('jig')).toBe(true);
    expect(STOP_WORDS.has('reel')).toBe(true);
    expect(STOP_WORDS.has('march')).toBe(true);
  });
});
