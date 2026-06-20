/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLastVisit, setLastVisit, loadRecentlyAdded } from '../lib/recentlyAdded';

const COOKIE_NAME = 'tt_last_visit';

vi.mock('../lib/supabase', () => ({
  getRecentlyAddedTunes: vi.fn(),
}));
vi.mock('../lib/db', () => ({
  getTuneById: vi.fn(),
}));

import { getRecentlyAddedTunes } from '../lib/supabase';
import { getTuneById } from '../lib/db';

describe('recentlyAdded', () => {
  beforeEach(() => {
    document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    vi.clearAllMocks();
  });

  describe('getLastVisit', () => {
    it('returns null when cookie is not set', () => {
      expect(getLastVisit()).toBeNull();
    });

    it('returns ISO string stored in cookie', () => {
      const ts = '2026-06-20T12:00:00.000Z';
      document.cookie = `${COOKIE_NAME}=${encodeURIComponent(ts)}`;
      expect(getLastVisit()).toBe(ts);
    });

    it('returns null for invalid date value', () => {
      document.cookie = `${COOKIE_NAME}=not-a-date`;
      expect(getLastVisit()).toBeNull();
    });
  });

  describe('setLastVisit', () => {
    it('writes timestamp to cookie', () => {
      const ts = '2026-06-21T10:00:00.000Z';
      setLastVisit(ts);
      expect(document.cookie).toContain(`${COOKIE_NAME}=${encodeURIComponent(ts)}`);
    });
  });

  describe('loadRecentlyAdded', () => {
    it('enriches tunes from db and removes duplicate tune ids', async () => {
      getRecentlyAddedTunes.mockResolvedValue([
        { tune_id: 1, youtubeId: 'abc123', created_at: '2026-06-21T10:00:00Z' },
        { tune_id: 1, youtubeId: 'def456', created_at: '2026-06-21T09:00:00Z' },
        { tune_id: 2, youtubeId: null, created_at: '2026-06-21T08:00:00Z' },
      ]);
      getTuneById.mockImplementation((id) => {
        if (id === 1) return { tune_id: 1, name: 'Tune One', type: 'reel' };
        if (id === 2) return { tune_id: 2, name: 'Tune Two', type: 'jig' };
        return null;
      });

      const result = await loadRecentlyAdded('2026-06-20T00:00:00Z');

      expect(getRecentlyAddedTunes).toHaveBeenCalledWith('2026-06-20T00:00:00Z');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        tune_id: 1, name: 'Tune One', type: 'reel',
        youtubeId: 'abc123', created_at: '2026-06-21T10:00:00Z',
      });
      expect(result[1]).toEqual({
        tune_id: 2, name: 'Tune Two', type: 'jig',
        youtubeId: null, created_at: '2026-06-21T08:00:00Z',
      });
    });
  });
});
