export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

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

/**
 * Convierte un valor de timestamp a segundos enteros.
 * Acepta segundos como número o string ("227"), o formato m:ss ("3:47").
 *
 * @param {number|string|null} val - Valor a parsear: segundos ("227"), m:ss ("3:47"), o null/undefined.
 * @returns {number|null} Segundos como entero, o null si la entrada es inválida o vacía.
 *
 * @example
 * parseSec(227)     // => 227
 * parseSec('3:47')  // => 227
 * parseSec('')      // => null
 * parseSec('abc')   // => null
 */
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

export function validateTimestamp(val) {
  const str = String(val ?? '').trim();
  if (!str) return { value: null, error: null };
  if (/^\d+$/.test(str)) return { value: parseInt(str, 10), error: null };
  if (/^\d+:\d{2}$/.test(str)) {
    const [m, s] = str.split(':');
    const sec = parseInt(m) * 60 + parseInt(s);
    if (parseInt(s) >= 60) return { value: null, error: 'Seconds must be 00–59' };
    return { value: sec, error: null };
  }
  return { value: null, error: 'Use m:ss or seconds' };
}

export function formatTime(sec) {
  if (sec == null) return null;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Normaliza los timestamps de un clip de media.
 * - startSec nulo -> 0
 * - endSec nulo   -> duración total conocida (si está disponible)
 * Devuelve { startSec, endSec } para pasar como props a reproductores.
 */
export function normalizeMediaTimestamps(startSec, endSec, duration) {
  return {
    startSec: startSec ?? 0,
    endSec: endSec ?? duration ?? null,
  };
}

/**
 * Formatea una fecha ISO como tiempo relativo legible.
 * @param {string|null} isoString
 * @returns {string}
 */
export function relativeTime(isoString) {
  if (!isoString) return '';
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function cleanTitleForDisplay(title, matchedTunes) {
  if (!matchedTunes.length) return title;
  
  let cleaned = title;
  for (const tune of matchedTunes) {
    const escaped = tune.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    cleaned = cleaned.replace(new RegExp(escaped, 'gi'), '');
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
