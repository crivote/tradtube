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
