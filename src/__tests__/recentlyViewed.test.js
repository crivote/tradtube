import { describe, it, expect, beforeEach } from 'vitest';
import { recordView, getRecentlyViewed, updateViewYoutubeId } from '../lib/recentlyViewed';

const STORAGE_KEY = 'tt_recently_viewed';

describe('recentlyViewed', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getRecentlyViewed', () => {
    it('returns empty array when nothing stored', () => {
      expect(getRecentlyViewed()).toEqual([]);
    });

    it('returns empty array for invalid JSON', () => {
      localStorage.setItem(STORAGE_KEY, 'not-json');
      expect(getRecentlyViewed()).toEqual([]);
    });

    it('returns parsed array from storage', () => {
      const data = [
        { tune_id: 1, name: 'The Earl\'s Chair', type: 'reel' },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      expect(getRecentlyViewed()).toEqual(data);
    });
  });

  describe('recordView', () => {
    it('adds tune to empty list', () => {
      const tune = { tune_id: 1, name: 'The Earl\'s Chair', type: 'reel' };
      recordView(tune);
      const list = getRecentlyViewed();
      expect(list).toHaveLength(1);
      expect(list[0]).toEqual({ ...tune, youtubeId: null });
    });

    it('stores youtubeId when provided', () => {
      const tune = { tune_id: 1, name: 'The Earl\'s Chair', type: 'reel' };
      recordView(tune, 'dQw4w9WgXcQ');
      const list = getRecentlyViewed();
      expect(list[0]).toEqual({ ...tune, youtubeId: 'dQw4w9WgXcQ' });
    });

    it('moves existing tune to front without duplicating', () => {
      const tune1 = { tune_id: 1, name: 'Tune One', type: 'reel' };
      const tune2 = { tune_id: 2, name: 'Tune Two', type: 'jig' };
      recordView(tune1);
      recordView(tune2);
      recordView(tune1);
      const list = getRecentlyViewed();
      expect(list).toHaveLength(2);
      expect(list[0]).toEqual({ ...tune1, youtubeId: null });
      expect(list[1]).toEqual({ ...tune2, youtubeId: null });
    });

    it('limits to MAX entries (25)', () => {
      for (let i = 0; i < 30; i++) {
        recordView({ tune_id: i, name: `Tune ${i}`, type: 'reel' });
      }
      const list = getRecentlyViewed();
      expect(list).toHaveLength(25);
      expect(list[0].tune_id).toBe(29);
    });

    it('updates youtubeId without reordering', () => {
      const tune1 = { tune_id: 1, name: 'Tune One', type: 'reel' };
      const tune2 = { tune_id: 2, name: 'Tune Two', type: 'jig' };
      recordView(tune1);
      recordView(tune2);
      updateViewYoutubeId(1, 'abc123');
      const list = getRecentlyViewed();
      expect(list).toHaveLength(2);
      expect(list[0]).toEqual({ ...tune2, youtubeId: null });
      expect(list[1]).toEqual({ ...tune1, youtubeId: 'abc123' });
    });

    it('does nothing when tune_id is not in list', () => {
      updateViewYoutubeId(999, 'abc123');
      expect(getRecentlyViewed()).toEqual([]);
    });
  });
});
