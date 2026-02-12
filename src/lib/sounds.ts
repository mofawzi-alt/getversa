/**
 * Micro UI sound feedback using Web Audio API.
 * Generates sounds programmatically — no audio files needed.
 * Respects user preference stored in localStorage.
 */

const SOUND_ENABLED_KEY = 'versa-sound-effects';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

export function isSoundEnabled(): boolean {
  const stored = localStorage.getItem(SOUND_ENABLED_KEY);
  return stored === null ? true : stored === 'true';
}

export function setSoundEnabled(enabled: boolean): void {
  localStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
}

/**
 * Premium "tick/snap" sound — short, linear, clean.
 * Duration: ~100ms
 */
export function playSwipeSound(): void {
  if (!isSoundEnabled()) return;

  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(1200, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.06);

    gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.1);
  } catch {
    // Silently fail — sound is non-critical
  }
}

/**
 * Subtle "rise" tone for result reveal — soft ascending tone.
 * Duration: ~140ms
 */
export function playResultSound(): void {
  if (!isSoundEnabled()) return;

  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(600, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.12);

    gainNode.gain.setValueAtTime(0.06, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.06);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.14);
  } catch {
    // Silently fail
  }
}
