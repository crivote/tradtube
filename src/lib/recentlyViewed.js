const KEY = 'tt_recently_viewed';
const MAX = 10;

export function recordView(tune) {
  const list = getRecentlyViewed().filter(t => t.tune_id !== tune.tune_id);
  list.unshift(tune);
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // localStorage unavailable (SSR, incognito, etc.)
  }
}

export function getRecentlyViewed() {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}
