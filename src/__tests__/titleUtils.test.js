import { describe, it, expect } from 'vitest';

function cleanTitleForDisplay(title, matchedTunes) {
  if (!matchedTunes.length) return title;
  
  let cleaned = title;
  for (const tune of matchedTunes) {
    const escaped = tune.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    cleaned = cleaned.replace(new RegExp(escaped, 'gi'), '').trim();
  }
  
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  const separators = cleaned.match(/[-–—|]/g);
  if (separators && separators.length > 0) {
    cleaned = cleaned.replace(/[-–—|]\s*/g, (m) => {
      return separators.shift() ? ' – ' : m;
    });
  }
  
  return cleaned || title;
}

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

function findMatchingTunes(text, existingIds = new Set()) {
  if (!text || !db) return [];
  
  const words = text
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .filter(w => !STOP_WORDS.has(w.toLowerCase()))
    .filter(w => !/^\d+$/.test(w));
  
  if (words.length === 0) return [];
  
  const seen = new Set();
  const matches = [];
  
  for (const word of words) {
    const results = searchTunes(word, 5);
    for (const tune of results) {
      if (!existingIds.has(tune.tune_id) && !seen.has(tune.tune_id)) {
        seen.add(tune.tune_id);
        matches.push(tune);
      }
    }
  }
  
  return matches.slice(0, 8);
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her',
  'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how',
  'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy',
  'did', 'let', 'put', 'say', 'she', 'too', 'use', 'this', 'with', 'from',
  'live', 'session', 'music', 'cover', 'live', 'video', 'song', 'feat',
  'official', 'hd', 'live', 'studio', 'recording', 'pub', 'irish',
]);

describe('STOP_WORDS', () => {
  it('contains common words that should be filtered', () => {
    expect(STOP_WORDS.has('the')).toBe(true);
    expect(STOP_WORDS.has('and')).toBe(true);
    expect(STOP_WORDS.has('session')).toBe(true);
    expect(STOP_WORDS.has('music')).toBe(true);
  });

  it('does not contain tune-like words', () => {
    expect(STOP_WORDS.has('jig')).toBe(false);
    expect(STOP_WORDS.has('reel')).toBe(false);
    expect(STOP_WORDS.has('march')).toBe(false);
  });
});
