// Web Audio: background music loop + synthesized sound effects.
// Nothing is created until unlock() runs inside a user gesture (iOS requirement).
import { loadMuted, saveMuted } from './storage.js';

let ctx = null;
let masterGain = null;
let musicGain = null;
let sfxGain = null;
let musicSource = null;
let musicBuffer = null;
let muted = loadMuted();

export const isMuted = () => muted;

export function setMuted(m) {
  muted = !!m;
  saveMuted(muted);
  if (masterGain) {
    masterGain.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.02);
  }
}

// Find where the real signal starts/ends — AAC encoding pads the edges with
// near-silence which causes an audible seam on loop. Trimming makes it gapless.
function findLoopPoints(buffer) {
  const data = buffer.getChannelData(0);
  const scanSamples = Math.min(data.length, Math.floor(buffer.sampleRate * 0.2));
  const threshold = 1e-4;
  let startIdx = 0;
  for (let i = 0; i < scanSamples; i++) {
    if (Math.abs(data[i]) > threshold) { startIdx = i; break; }
  }
  let endIdx = data.length - 1;
  for (let i = 0; i < scanSamples; i++) {
    if (Math.abs(data[data.length - 1 - i]) > threshold) { endIdx = data.length - 1 - i; break; }
  }
  return { loopStart: startIdx / buffer.sampleRate, loopEnd: (endIdx + 1) / buffer.sampleRate };
}

function startMusic() {
  if (!musicBuffer || musicSource) return;
  const { loopStart, loopEnd } = findLoopPoints(musicBuffer);
  musicSource = ctx.createBufferSource();
  musicSource.buffer = musicBuffer;
  musicSource.loop = true;
  musicSource.loopStart = loopStart;
  musicSource.loopEnd = loopEnd;
  musicSource.connect(musicGain);
  musicSource.start(0, loopStart);
}

async function loadMusic() {
  try {
    const res = await fetch('assets/music.m4a');
    const bytes = await res.arrayBuffer();
    musicBuffer = await ctx.decodeAudioData(bytes);
    startMusic();
  } catch {
    // No music is not fatal — the game stays playable.
  }
}

// Must be called from a user gesture handler (Play tap / resume tap).
export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 1;
    masterGain.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.35;
    musicGain.connect(masterGain);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.8;
    sfxGain.connect(masterGain);
    loadMusic();
  }
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
}

function tone({ freq, endFreq, type = 'sine', duration, at = 0, volume = 1 }) {
  const t0 = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + duration);
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(volume, t0 + 0.008);
  env.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(env);
  env.connect(sfxGain);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

// Synthesized effects (no asset files needed; swap for samples later if wanted).
export function playSfx(kind) {
  if (!ctx || ctx.state !== 'running') return;
  switch (kind) {
    case 'correct':
      tone({ freq: 660, type: 'triangle', duration: 0.07, volume: 0.5 });
      tone({ freq: 990, type: 'triangle', duration: 0.09, at: 0.07, volume: 0.5 });
      break;
    case 'wrong':
      tone({ freq: 220, endFreq: 160, type: 'square', duration: 0.18, volume: 0.25 });
      break;
    case 'timeout':
      tone({ freq: 440, endFreq: 220, type: 'sawtooth', duration: 0.25, volume: 0.2 });
      break;
    case 'gameover':
      tone({ freq: 523, type: 'triangle', duration: 0.12, volume: 0.4 });
      tone({ freq: 392, type: 'triangle', duration: 0.12, at: 0.13, volume: 0.4 });
      tone({ freq: 330, type: 'triangle', duration: 0.25, at: 0.26, volume: 0.4 });
      break;
  }
}
