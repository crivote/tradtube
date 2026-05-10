import { getDB, searchTunes } from './db';

export function extractYoutubeId(input) {
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

export function parseSec(val) {
  const s = String(val ?? '').trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  const m = s.match(/^(\d+):(\d{2})$/);
  if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
  return null;
}

export function formatSec(sec) {
  if (sec == null) return '';
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

export function formatTime(sec) {
  if (sec == null) return null;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her',
  'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how',
  'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy',
  'did', 'let', 'put', 'say', 'she', 'too', 'use', 'this', 'with', 'from',
  'live', 'session', 'music', 'cover', 'video', 'song', 'feat',
  'official', 'hd', 'studio', 'recording', 'pub', 'irish',
  'reel', 'jig', 'hornpipe', 'polka', 'slide', 'waltz', 'march', 'slip',
  'set', 'dance', 'air', 'tune', 'tunes',
  'trad', 'traditional', 'played', 'version', 'full', 'original', 'slow', 'fast',
  'medley', 'parts',
  'de', 'le', 'la', 'les', 'des', 'du',
]);

export function findMatchingTunes(text, existingIds = new Set()) {
  if (!text || !getDB()) return [];

  const cleaned = text
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ');

  const phrases = cleaned.split(/[,;\/|–—\\-]+/)
    .map(s => s.trim())
    .filter(Boolean);

  const seen = new Set(existingIds);
  const matches = [];

  for (const phrase of phrases) {
    const words = phrase
      .replace(/[^\w\s'-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
      .filter(w => !STOP_WORDS.has(w.toLowerCase()))
      .filter(w => !/^\d+$/.test(w));

    if (words.length === 0) continue;

    const results = searchTunes(words.join(' '), 5);
    for (const tune of results) {
      if (!seen.has(tune.tune_id)) {
        seen.add(tune.tune_id);
        matches.push(tune);
      }
    }

    if (matches.length >= 8) break;
  }

  return matches.slice(0, 8);
}

export function cleanTitleForDisplay(title, matchedTunes) {
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
