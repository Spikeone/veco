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

const DEFAULT_VOLUMES = { music: 0.35, sfx: 0.8 };
export const loadVolumes = () => ({ ...DEFAULT_VOLUMES, ...get('volume', {}) });
export const saveVolumes = (v) => set('volume', v);

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
const statsKey = (mode, shuffle) => `stats.${mode}.${shuffle ? 'shuffle' : 'normal'}`;

export const loadStatsFor = (mode, shuffle) =>
  ({ ...EMPTY_STATS, ...get(statsKey(mode, shuffle), {}) });
export const saveStatsFor = (mode, shuffle, s) => set(statsKey(mode, shuffle), s);

// One-time migration: fold the pre-per-mode global stats into endless/normal.
(() => {
  const legacy = get('stats', null);
  if (!legacy) return;
  const target = loadStatsFor('endless', false);
  for (const k of Object.keys(EMPTY_STATS)) target[k] += legacy[k] || 0;
  saveStatsFor('endless', false, target);
  try { localStorage.removeItem(PREFIX + 'stats'); } catch { /* ignore */ }
})();
