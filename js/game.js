// Pure game logic — no DOM, no timers. The clock is advanced from outside via advance(elapsedMs).
import {
  ROUND_BASE_MS, MS_PER_LEVEL, MAX_ITEMS,
  FOOD_MIN, FOOD_MAX, DIFF_PROBABILITY, TIME_ATTACK_MS, LIVES_COUNT,
} from './config.js';

const FOOD_COUNT = FOOD_MAX - FOOD_MIN + 1;

export function multisetEqual(a, b) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}

export function createGame({ mode = 'endless', shuffle = false, rng = Math.random } = {}) {
  const state = {
    mode, shuffle,
    phase: 'idle', // idle | running | paused | over
    level: 1, maxLevel: 1,
    right: 0, wrong: 0, timeouts: 0,
    points: 0,
    required: [], actual: [], isSame: true,
    roundBudgetMs: ROUND_BASE_MS,
    roundRemainingMs: ROUND_BASE_MS,
    globalRemainingMs: mode === 'ta' ? TIME_ATTACK_MS : Infinity,
    lives: mode === 'lives' ? LIVES_COUNT : Infinity,
  };

  // Wrong answers and timeouts both cost a life; at 0 the run is over.
  function loseLife() {
    if (state.mode !== 'lives') return false;
    state.lives--;
    if (state.lives <= 0) {
      state.lives = 0;
      state.phase = 'over';
      return true;
    }
    return false;
  }

  const randomFood = () => FOOD_MIN + Math.floor(rng() * FOOD_COUNT);

  function startRound() {
    const count = Math.min(state.level, MAX_ITEMS);
    const required = Array.from({ length: count }, randomFood);
    const actual = required.slice();

    if (state.shuffle) {
      for (let i = actual.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [actual[i], actual[j]] = [actual[j], actual[i]];
      }
    }

    state.isSame = true;
    if (rng() < DIFF_PROBABILITY) {
      // Deviation from the original's `id/2 + 1` (which maps ids 1-2 to themselves ->
      // unwinnable rounds, and never mutated the last slot): pick any slot uniformly
      // and replace with a uniformly random *different* id.
      const slot = Math.floor(rng() * count);
      const offset = 1 + Math.floor(rng() * (FOOD_COUNT - 1));
      actual[slot] = FOOD_MIN + ((actual[slot] - FOOD_MIN + offset) % FOOD_COUNT);
      state.isSame = false;
    }

    state.required = required;
    state.actual = actual;
    state.roundBudgetMs = ROUND_BASE_MS - state.level * MS_PER_LEVEL;
    state.roundRemainingMs = state.roundBudgetMs;
  }

  function start() {
    state.phase = 'running';
    state.level = 1;
    state.maxLevel = 1;
    state.right = 0;
    state.wrong = 0;
    state.timeouts = 0;
    state.points = 0;
    state.globalRemainingMs = state.mode === 'ta' ? TIME_ATTACK_MS : Infinity;
    state.lives = state.mode === 'lives' ? LIVES_COUNT : Infinity;
    startRound();
  }

  function answer(saysSame) {
    if (state.phase !== 'running') return null;
    const correct = saysSame === state.isSame;
    if (correct) {
      state.right++;
      state.level++;
      state.maxLevel = Math.max(state.maxLevel, state.level);
      state.points += Math.max(0, Math.round(state.roundRemainingMs));
    } else {
      state.wrong++;
      state.level = Math.max(1, state.level - 1);
      if (loseLife()) return 'wrong';
    }
    startRound();
    return correct ? 'correct' : 'wrong';
  }

  // Advance both clocks by elapsedMs. Returns 'running' | 'timeout' | 'gameover' | null.
  // At most one timeout per call: the caller drives frequently (rAF) and auto-pauses on hide.
  function advance(elapsedMs) {
    if (state.phase !== 'running') return null;
    if (state.mode === 'ta') {
      state.globalRemainingMs -= elapsedMs;
      if (state.globalRemainingMs <= 0) {
        state.globalRemainingMs = 0;
        state.phase = 'over';
        return 'gameover';
      }
    }
    state.roundRemainingMs -= elapsedMs;
    if (state.roundRemainingMs <= 0) {
      state.timeouts++;
      state.level = Math.max(1, state.level - 1);
      if (loseLife()) return 'timeout'; // caller sees phase 'over'
      startRound();
      return 'timeout';
    }
    return 'running';
  }

  function pause() { if (state.phase === 'running') state.phase = 'paused'; }
  function resume() { if (state.phase === 'paused') state.phase = 'running'; }

  // Serializable mid-run snapshot. Infinity never enters JSON: lives/taRemainingMs
  // are null unless the mode uses them. The current round is NOT saved — loadState
  // deals a fresh round at the saved level.
  function snapshot() {
    return {
      mode: state.mode, shuffle: state.shuffle,
      level: state.level, maxLevel: state.maxLevel,
      right: state.right, wrong: state.wrong, timeouts: state.timeouts,
      points: state.points,
      lives: state.mode === 'lives' ? state.lives : null,
      taRemainingMs: state.mode === 'ta' ? Math.max(0, Math.round(state.globalRemainingMs)) : null,
    };
  }

  function loadState(snap) {
    state.level = snap.level;
    state.maxLevel = snap.maxLevel || snap.level;
    state.right = snap.right || 0;
    state.wrong = snap.wrong || 0;
    state.timeouts = snap.timeouts || 0;
    state.points = snap.points || 0;
    state.lives = state.mode === 'lives' ? (snap.lives ?? LIVES_COUNT) : Infinity;
    state.globalRemainingMs = state.mode === 'ta' ? (snap.taRemainingMs ?? TIME_ATTACK_MS) : Infinity;
    state.phase = 'running';
    startRound();
  }

  return { state, start, answer, advance, pause, resume, startRound, snapshot, loadState };
}
