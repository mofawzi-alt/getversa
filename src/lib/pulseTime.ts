// Helpers for Daily Pulse timing windows.
// Window is the user's *local* clock (they get the morning/evening feeling
// at a sensible time wherever they are), but the *content* shown is the
// global cached pulse (most recent row in daily_pulse).

export type PulseSlot = 'morning' | 'evening';

export function localHourNow(): number {
  return new Date().getHours();
}

/** True between 06:00 and 10:59 local time. */
export function isInMorningWindow(hour: number = localHourNow()): boolean {
  return hour >= 6 && hour < 11;
}

/** True between 20:00 and 23:59 local time. */
export function isInEveningWindow(hour: number = localHourNow()): boolean {
  return hour >= 20 && hour < 24;
}

export function currentPulseSlot(hour: number = localHourNow()): PulseSlot | null {
  if (isInEveningWindow(hour)) return 'evening';
  if (isInMorningWindow(hour)) return 'morning';
  return null;
}

/** Local YYYY-MM-DD date string (per-user gating). */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const SEEN_KEY_PREFIX = 'pulse:seen:';

export function pulseSeenKey(topic: string, dateKey: string = localDateKey()): string {
  return `${SEEN_KEY_PREFIX}${topic}:${dateKey}`;
}

export function hasSeenLocally(topic: string): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(pulseSeenKey(topic)) === '1';
}

export function markSeenLocally(topic: string) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(pulseSeenKey(topic), '1'); } catch {}
}
