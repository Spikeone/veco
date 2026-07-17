// Bootstrap and game driver: rAF loop, persistence, pause-on-background, SW registration.
import { createGame, multisetEqual } from './game.js';
import { createUi } from './ui.js';
import * as audio from './audio.js';
import * as storage from './storage.js';
import { LABELS, FOOD_MIN, FOOD_MAX, foodSrc } from './config.js';

let game = null;
let best = { points: 0, level: 1 };
let startBestPoints = 0; // best at session start, for the "New best!" badge
let stats = storage.loadStats();
let lastFrame = 0;
let pauseShownAt = 0;
let ui = null;

function refreshStartScreen() {
  if (!ui) return;
  best = storage.loadBest(ui.selection.mode, ui.selection.shuffle);
  ui.updateStartScreen(stats, best, LABELS);
}

function persistProgress() {
  const st = game.state;
  best = storage.saveBest(st.mode, st.shuffle, st.points, st.maxLevel).best;
  storage.saveStats(stats);
}

function onPlay(mode, shuffle) {
  audio.unlock();
  startBestPoints = storage.loadBest(mode, shuffle).points;
  best = storage.loadBest(mode, shuffle);
  game = createGame({ mode, shuffle });
  game.start();
  ui.hideOverlays();
  ui.renderRound(game.state);
  ui.renderHud(game.state, best);
  lastFrame = performance.now();
}

function onAnswer(saysSame) {
  if (!game || game.state.phase !== 'running') return;
  const res = game.answer(saysSame);
  if (res === 'correct') stats.totalRight++;
  else stats.totalWrong++;
  ui.flash(res);
  audio.playSfx(res);
  persistProgress();
  ui.renderRound(game.state);
  ui.renderHud(game.state, best);
}

function onPauseToggle() {
  if (!game) return;
  if (game.state.phase === 'running') {
    game.pause();
    storage.saveStats(stats);
    pauseShownAt = performance.now();
    ui.showOverlay('pause');
  } else if (game.state.phase === 'paused') {
    onResume();
  }
}

function onResume() {
  if (!game || game.state.phase !== 'paused') return;
  // swallow the ghost click of the very tap that opened the pause overlay
  if (performance.now() - pauseShownAt < 350) return;
  audio.unlock(); // re-resumes the AudioContext after backgrounding
  game.resume();
  ui.hideOverlays();
  lastFrame = performance.now();
}

function finishTimeAttack() {
  const st = game.state;
  persistProgress();
  audio.playSfx('gameover');
  ui.showEndScreen(st.points, best, st.points > startBestPoints, LABELS);
}

function onPlayAgain() {
  onPlay(game.state.mode, game.state.shuffle);
}

function onMenu() {
  game = null;
  refreshStartScreen();
  ui.showOverlay('start');
}

function onMuteToggle() {
  audio.setMuted(!audio.isMuted());
  ui.setMuteIcon(audio.isMuted());
}

// Clock step — wall-clock based, so it can be driven from both rAF (smooth display)
// and a setInterval watchdog (keeps the game fair if rAF is throttled).
function step(now) {
  if (!game) return;
  const st = game.state;
  if (st.phase !== 'running') {
    lastFrame = now;
    return;
  }
  const elapsed = Math.min(1000, now - lastFrame);
  lastFrame = now;
  stats.totalPlayMs += elapsed;
  const res = game.advance(elapsed);
  if (res === 'timeout') {
    stats.totalTimeouts++;
    ui.flash('timeout');
    audio.playSfx('timeout');
    persistProgress();
    ui.renderRound(st);
  } else if (res === 'gameover') {
    finishTimeAttack();
    return;
  }
  ui.renderHud(st, best);
}

function frame(now) {
  requestAnimationFrame(frame);
  step(now);
}

function preloadFoods() {
  for (let id = FOOD_MIN; id <= FOOD_MAX; id++) {
    const img = new Image();
    img.src = foodSrc(id);
  }
}

// ----- boot -----
ui = createUi({
  onPlay, onAnswer, onPauseToggle, onResume,
  onPlayAgain, onMenu, onMuteToggle,
  onSelectionChange: refreshStartScreen,
});

ui.setMuteIcon(audio.isMuted());
refreshStartScreen();
ui.showOverlay('start');
preloadFoods();
requestAnimationFrame(frame);
setInterval(() => step(performance.now()), 200);

// iOS: block pinch zoom (Safari fires the proprietary gesture events even with the viewport meta)
document.addEventListener('gesturestart', (e) => e.preventDefault());

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (game && game.state.phase === 'running') {
      game.pause();
      pauseShownAt = performance.now();
      ui.showOverlay('pause');
    }
    storage.saveStats(stats);
  }
});
window.addEventListener('pagehide', () => storage.saveStats(stats));

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// Test hook: open with #debug to poke at the game from the console.
if (location.hash === '#debug') {
  window.veco = {
    get game() { return game; },
    set level(n) { if (game) { game.state.level = n; game.startRound(); ui.renderRound(game.state); } },
    createGame, multisetEqual, storage, stats,
  };
}
