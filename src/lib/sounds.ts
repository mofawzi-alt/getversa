/**
 * VERSA Sound System — 4 structured sound categories.
 * All sounds are programmatic via Web Audio API.
 * Premium, minimal, under 0.4s each. No overlapping.
 */

const SOUND_ENABLED_KEY = 'versa-sound-effects';

let audioCtx: AudioContext | null = null;
let lastSoundTime = 0;

function getAudioContext(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

export function isSoundEnabled(): boolean {
  const stored = localStorage.getItem(SOUND_ENABLED_KEY);
  return stored === null ? true : stored === 'true';
}

export function setSoundEnabled(enabled: boolean): void {
  localStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
}

/** Prevent overlapping sounds — enforces minimum gap */
function canPlay(): boolean {
  const now = performance.now();
  if (now - lastSoundTime < 150) return false;
  lastSoundTime = now;
  return true;
}

/**
 * 1. Swipe Snap — short clean tick when card locks into vote.
 * Duration: ~80ms. Soft sine descent.
 */
export function playSwipeSound(): void {
  if (!isSoundEnabled() || !canPlay()) return;
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1100, t);
    osc.frequency.exponentialRampToValueAtTime(700, t + 0.06);

    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.08);
  } catch { /* non-critical */ }
}

/**
 * 2. Result Reveal — soft ascending tone when percentages animate.
 * Duration: ~120ms. Gentle sine rise.
 */
export function playResultSound(): void {
  if (!isSoundEnabled() || !canPlay()) return;
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.1);

    gain.gain.setValueAtTime(0.05, t);
    gain.gain.linearRampToValueAtTime(0.04, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.12);
  } catch { /* non-critical */ }
}

/**
 * 3. Minority Trigger — slightly deeper, contemplative tone.
 * Duration: ~150ms. Two-note minor interval.
 */
export function playMinoritySound(): void {
  if (!isSoundEnabled() || !canPlay()) return;
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, t);
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.08);
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.15);

    gain.gain.setValueAtTime(0.05, t);
    gain.gain.linearRampToValueAtTime(0.035, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.15);
  } catch { /* non-critical */ }
}

/**
 * 4. Milestone Chime — subtle two-note ascending chime.
 * Duration: ~200ms. For 10/25/50 swipe events.
 */
export function playMilestoneSound(): void {
  if (!isSoundEnabled() || !canPlay()) return;
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;

    // First note
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(784, t); // G5
    gain1.gain.setValueAtTime(0.04, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc1.connect(gain1).connect(ctx.destination);
    osc1.start(t);
    osc1.stop(t + 0.1);

    // Second note (delayed)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1047, t + 0.08); // C6
    gain2.gain.setValueAtTime(0.001, t);
    gain2.gain.linearRampToValueAtTime(0.04, t + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc2.connect(gain2).connect(ctx.destination);
    osc2.start(t + 0.08);
    osc2.stop(t + 0.2);
  } catch { /* non-critical */ }
}
