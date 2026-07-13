import { getTuneById } from './db';
import { getRecentlyAddedTunes } from './supabase';

const COOKIE_NAME = 'tt_last_visit';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function getLastVisit() {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + COOKIE_NAME + '=([^;]*)'));
  if (!match) return null;
  const value = decodeURIComponent(match[1]);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function setLastVisit(timestamp = new Date().toISOString()) {
  if (typeof document === 'undefined') return;
  const encoded = encodeURIComponent(timestamp);
  document.cookie = `${COOKIE_NAME}=${encoded}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}

export async function loadRecentlyAdded(limit = 10) {
  const added = await getRecentlyAddedTunes(null, limit);
  const seen = new Set();
  const tunes = [];
  for (const item of added) {
    if (seen.has(item.tune_id)) continue;
    seen.add(item.tune_id);
    const tune = getTuneById(item.tune_id);
    if (tune) {
      tunes.push({ ...tune, youtubeId: item.youtubeId, created_at: item.created_at });
    }
  }
  return tunes;
}
