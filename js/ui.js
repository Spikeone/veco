// DOM layer: grid building/rendering, HUD, overlays, and input (buttons, swipe, keyboard).
import { GRID_COLS, GRID_ROWS, MAX_ITEMS, FLASH_MS, foodSrc } from './config.js';

const $ = (id) => document.getElementById(id);

// Logical slot 0 is bottom-left (like the original); DOM cells run top-left to bottom-right.
const domIndexFor = Array.from({ length: MAX_ITEMS }, (_, i) =>
  (GRID_ROWS - 1 - Math.floor(i / GRID_COLS)) * GRID_COLS + (i % GRID_COLS));

const SWIPE_DISTANCE = 60;   // px that always counts
const SWIPE_FLICK_DISTANCE = 30;
const SWIPE_FLICK_VELOCITY = 0.5; // px/ms

export function createUi(callbacks) {
  const {
    onPlay, onAnswer, onPauseToggle, onResume,
    onPlayAgain, onMenu, onMuteToggle,
  } = callbacks;

  const els = {
    playfield: $('playfield'),
    level: $('hud-level'),
    time: $('hud-time'),
    right: $('hud-right'),
    wrong: $('hud-wrong'),
    points: $('hud-points'),
    best: $('hud-best'),
    roundBarFill: $('round-bar-fill'),
    muteImg: $('img-mute'),
    overlays: {
      start: $('overlay-start'),
      pause: $('overlay-pause'),
      end: $('overlay-end'),
      credits: $('overlay-credits'),
    },
    startBest: $('start-best'),
    statsBlock: $('stats-block'),
    endScore: $('end-score'),
    endBest: $('end-best'),
    endNewBest: $('end-new-best'),
    modeButtons: Array.from(document.querySelectorAll('[data-mode]')),
    shuffleToggle: $('toggle-shuffle'),
  };

  const cells = { required: [], actual: [] };
  for (const key of ['required', 'actual']) {
    const grid = $(key === 'required' ? 'grid-required' : 'grid-actual');
    for (let d = 0; d < MAX_ITEMS; d++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      const img = document.createElement('img');
      img.draggable = false;
      img.alt = '';
      cell.appendChild(img);
      grid.appendChild(cell);
      cells[key].push({ cell, img });
    }
  }

  // ----- selection state (start screen) -----
  const selection = { mode: 'endless', shuffle: false };

  function renderSelection() {
    els.modeButtons.forEach((b) =>
      b.classList.toggle('selected', b.dataset.mode === selection.mode));
    els.shuffleToggle.classList.toggle('selected', selection.shuffle);
    els.shuffleToggle.setAttribute('aria-pressed', String(selection.shuffle));
    callbacks.onSelectionChange?.(selection);
  }

  els.modeButtons.forEach((b) => b.addEventListener('click', () => {
    selection.mode = b.dataset.mode;
    renderSelection();
  }));
  els.shuffleToggle.addEventListener('click', () => {
    selection.shuffle = !selection.shuffle;
    renderSelection();
  });

  // ----- overlays -----
  function showOverlay(name) {
    for (const [key, el] of Object.entries(els.overlays)) {
      el.classList.toggle('hidden', key !== name);
    }
  }
  function hideOverlays() {
    for (const el of Object.values(els.overlays)) el.classList.add('hidden');
  }

  // ----- rendering -----
  function renderRound(state) {
    for (const key of ['required', 'actual']) {
      const ids = state[key];
      for (let i = 0; i < MAX_ITEMS; i++) {
        const { cell, img } = cells[key][domIndexFor[i]];
        if (i < ids.length) {
          img.src = foodSrc(ids[i]);
          cell.classList.add('filled');
        } else {
          cell.classList.remove('filled');
        }
      }
    }
  }

  function renderHud(state, best) {
    els.level.textContent = `Level ${state.level}`;
    els.right.textContent = state.right;
    els.wrong.textContent = state.wrong;
    els.points.textContent = state.points;
    els.best.textContent = best ? best.points : 0;
    if (state.mode === 'ta') {
      els.time.textContent = (Math.max(0, state.globalRemainingMs) / 1000).toFixed(1);
    } else {
      els.time.textContent = Math.max(0, Math.round(state.roundRemainingMs));
    }
    const frac = state.roundBudgetMs > 0
      ? Math.max(0, Math.min(1, state.roundRemainingMs / state.roundBudgetMs)) : 0;
    els.roundBarFill.style.width = `${frac * 100}%`;
  }

  let flashTimer = 0;
  function flash(kind) {
    const el = els.playfield;
    el.classList.remove('flash-correct', 'flash-wrong', 'flash-timeout');
    void el.offsetWidth; // restart the animation when the same class is re-added
    el.classList.add(`flash-${kind}`);
    clearTimeout(flashTimer);
    flashTimer = setTimeout(
      () => el.classList.remove('flash-correct', 'flash-wrong', 'flash-timeout'), FLASH_MS);
  }

  function setMuteIcon(muted) {
    els.muteImg.src = muted ? 'assets/ui/sound-off.png' : 'assets/ui/sound-on.png';
  }

  function formatPlayTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m ${String(s).padStart(2, '0')}s`;
  }

  function updateStartScreen(stats, best, labels) {
    els.startBest.textContent = `${labels.best}: ${best.points} · ${labels.level} ${best.level}`;
    const rounds = stats.totalRight + stats.totalWrong + stats.totalTimeouts;
    const answered = stats.totalRight + stats.totalWrong;
    const accuracy = answered > 0 ? `${Math.round((stats.totalRight / answered) * 100)}%` : '–';
    const rows = [
      [labels.rounds, rounds],
      [labels.right, stats.totalRight],
      [labels.wrong, stats.totalWrong],
      [labels.accuracy, accuracy],
      [labels.playTime, formatPlayTime(stats.totalPlayMs)],
    ];
    els.statsBlock.innerHTML = rows
      .map(([k, v]) => `<div class="stats-row"><span>${k}</span><span>${v}</span></div>`)
      .join('');
  }

  function showEndScreen(points, best, isNewBest, labels) {
    els.endScore.textContent = points;
    els.endBest.textContent = `${labels.best}: ${best.points}`;
    els.endNewBest.classList.toggle('hidden', !isNewBest);
    showOverlay('end');
  }

  // ----- input -----
  $('btn-yes').addEventListener('pointerdown', (e) => { e.preventDefault(); onAnswer(true); });
  $('btn-no').addEventListener('pointerdown', (e) => { e.preventDefault(); onAnswer(false); });
  $('btn-pause').addEventListener('pointerdown', (e) => { e.preventDefault(); onPauseToggle(); });
  $('btn-mute').addEventListener('pointerdown', (e) => { e.preventDefault(); onMuteToggle(); });

  $('btn-play').addEventListener('click', () => onPlay(selection.mode, selection.shuffle));
  els.overlays.pause.addEventListener('click', () => onResume());
  $('btn-play-again').addEventListener('click', () => onPlayAgain());
  $('btn-menu').addEventListener('click', () => onMenu());
  $('btn-credits').addEventListener('click', () => showOverlay('credits'));
  $('btn-credits-close').addEventListener('click', () => showOverlay('start'));

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === 'a') onAnswer(true);
    else if (k === 'd') onAnswer(false);
    else if (k === 'p') onPauseToggle();
  });

  // Swipe on the playfield: right = same, left = different.
  let swipe = null;
  const pf = els.playfield;
  pf.addEventListener('pointerdown', (e) => {
    swipe = { id: e.pointerId, x0: e.clientX, t0: performance.now() };
    pf.style.transition = 'none';
    try { pf.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  });
  pf.addEventListener('pointermove', (e) => {
    if (!swipe || e.pointerId !== swipe.id) return;
    const dx = e.clientX - swipe.x0;
    const tx = Math.tanh(dx / 150) * 40; // follow the finger with resistance
    pf.style.transform = `translateX(${tx}px)`;
  });
  function endSwipe(e, evaluate) {
    if (!swipe || e.pointerId !== swipe.id) return;
    const dx = e.clientX - swipe.x0;
    const dt = Math.max(1, performance.now() - swipe.t0);
    swipe = null;
    pf.style.transition = 'transform 120ms ease-out';
    pf.style.transform = 'translateX(0)';
    if (!evaluate) return;
    const flick = Math.abs(dx) > SWIPE_FLICK_DISTANCE && Math.abs(dx) / dt > SWIPE_FLICK_VELOCITY;
    if (Math.abs(dx) > SWIPE_DISTANCE || flick) onAnswer(dx > 0);
  }
  pf.addEventListener('pointerup', (e) => endSwipe(e, true));
  pf.addEventListener('pointercancel', (e) => endSwipe(e, false));

  renderSelection();

  return {
    selection,
    showOverlay, hideOverlays,
    renderRound, renderHud, flash,
    setMuteIcon, updateStartScreen, showEndScreen,
  };
}
