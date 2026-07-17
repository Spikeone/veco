// localStorage wrapper — every access guarded (Safari private mode throws on setItem).
const PREFIX = 'veco.';

function get(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function set(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* ignore */ }
}

export const loadMuted = () => get('muted', false);
export const saveMuted = (m) => set('muted', !!m);

const bestKey = (mode, shuffle) => `best.${mode}.${shuffle ? 'shuffle' : 'normal'}`;

export const loadBest = (mode, shuffle) => get(bestKey(mode, shuffle), { points: 0, level: 1 });

// Keeps the stored maxima; returns { best, isNewPoints }
export function saveBest(mode, shuffle, points, maxLevel) {
  const prev = loadBest(mode, shuffle);
  const best = {
    points: Math.max(prev.points, points),
    level: Math.max(prev.level, maxLevel),
  };
  set(bestKey(mode, shuffle), best);
  return { best, isNewPoints: points > prev.points };
}

const EMPTY_STATS = { totalRight: 0, totalWrong: 0, totalTimeouts: 0, totalPlayMs: 0 };
export const loadStats = () => ({ ...EMPTY_STATS, ...get('stats', {}) });
export const saveStats = (s) => set('stats', s);
