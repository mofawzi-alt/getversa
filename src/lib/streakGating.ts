/**
 * Progressive Unlocks — streak-gated insight tiers.
 * Day 3+: city split, Day 7+: age split, Day 14+: full taste profile.
 */

export type InsightTier = 'none' | 'city' | 'age' | 'full';

export function getInsightTier(currentStreak: number): InsightTier {
  if (currentStreak >= 14) return 'full';
  if (currentStreak >= 7) return 'age';
  if (currentStreak >= 3) return 'city';
  return 'none';
}

export function getNextUnlock(currentStreak: number): { daysNeeded: number; label: string } | null {
  if (currentStreak >= 14) return null;
  if (currentStreak >= 7) return { daysNeeded: 14 - currentStreak, label: 'Full Taste Profile' };
  if (currentStreak >= 3) return { daysNeeded: 7 - currentStreak, label: 'Age Split Insights' };
  return { daysNeeded: 3 - currentStreak, label: 'City Split Insights' };
}

export const TIER_LABELS: Record<InsightTier, string> = {
  none: 'Keep your streak to unlock insights',
  city: 'City Split',
  age: 'Age Split',
  full: 'Full Taste Profile',
};
