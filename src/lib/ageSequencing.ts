/**
 * Age-based poll sequencing configuration.
 * Maps age segments to ordered priority poll questions.
 * After priority polls are exhausted, standard algorithm takes over.
 */

// Each segment's priority list — matched by question substring (case-insensitive)
const SEGMENT_18_24 = [
  'iPhone or Samsung',
  'Careem or Uber',
  'Netflix or cinema',
  'Starbucks or local',
  'Ahly or Zamalek',
  'Spotify or Anghami',
  'Cairo or Dubai',
  'Nike or Adidas',
  'Eat out or cook at home',
  'Turkish series or Egyptian',
  'Instagram or TikTok',
  'WhatsApp or Telegram',
  'Noon or Amazon',
  'Dahab or Sharm',
  'Big wedding or',
  'Startup or corporate',
  'Local brand or global',
  'Cadbury or Mars',
  'Coffee shop or home office',
  'Arabic or English at work',
];

const SEGMENT_25_35 = [
  'Careem or Uber',
  'iPhone or Samsung',
  'Startup or corporate',
  'Instashop or Breadfast',
  'InstaPay or bank counter',
  'Cairo or Dubai',
  'New Cairo or Sheikh Zayed',
  'Valu or',
  'Stocks or gold',
  'Eat out or cook at home',
  'Netflix or cinema',
  'Ahly or Zamalek',
  'Own business or corporate',
  'Cash or digital wallet',
  'Vodafone or Orange',
  'Rooftop dinner or beach',
  'Dahab or Sharm',
  'Nike or Adidas',
  'Real estate or stocks',
  'Buy now pay later or save',
];

const SEGMENT_35_PLUS = [
  'Ahly or Zamalek',
  'Nile view or sea view',
  'Careem or Uber',
  'New Cairo or Sheikh Zayed',
  'Cairo or Dubai',
  'Eat out or cook at home',
  'Gold or crypto',
  'Real estate or stocks',
  'Vodafone or Orange',
  'Sahel property or Cairo',
  'Turkish series or Egyptian',
  'InstaPay or bank counter',
  'Manufacture or trade',
  'Own business or corporate',
  'Cash or digital wallet',
  'Rooftop dinner or beach',
  'Big wedding or',
  'Compound or city apartment',
  'Local brand or global',
  'Dahab or Sharm',
];

function getSegmentForAge(ageRange: string | null | undefined): string[] {
  if (!ageRange) return SEGMENT_25_35; // default

  const lower = ageRange.toLowerCase();
  // "18-24", "18–24", "under 18"
  if (lower.includes('under 18') || lower.includes('18-24') || lower.includes('18–24')) {
    return SEGMENT_18_24;
  }
  // "25-34", "25–34"
  if (lower.includes('25-34') || lower.includes('25–34')) {
    return SEGMENT_25_35;
  }
  // "35-44", "35–44", "45+", "45-54", etc.
  if (lower.includes('35') || lower.includes('45') || lower.includes('55') || lower.includes('65')) {
    return SEGMENT_35_PLUS;
  }
  return SEGMENT_25_35;
}

/**
 * Matches a poll question to a segment pattern (case-insensitive substring match).
 * Returns the priority index (0-based) or -1 if not in segment.
 */
function getPriorityIndex(question: string, segment: string[]): number {
  const q = question.toLowerCase();
  for (let i = 0; i < segment.length; i++) {
    if (q.includes(segment[i].toLowerCase())) return i;
  }
  return -1;
}

/**
 * Sort polls by age-based priority for the user's age range.
 * Priority polls come first in segment order, remaining polls keep their original order.
 * Already-voted polls are respected — skipped priority polls don't block the sequence.
 */
export function applyAgeSequencing<T extends { id: string; question: string }>(
  polls: T[],
  ageRange: string | null | undefined,
  votedPollIds?: Set<string>,
): T[] {
  const segment = getSegmentForAge(ageRange);

  // Split into priority and remaining
  const prioritySlots: (T | null)[] = new Array(segment.length).fill(null);
  const remaining: T[] = [];

  for (const poll of polls) {
    const idx = getPriorityIndex(poll.question, segment);
    if (idx !== -1 && prioritySlots[idx] === null) {
      prioritySlots[idx] = poll;
    } else if (idx !== -1 && prioritySlots[idx] !== null) {
      // Duplicate match — prefer unvoted one
      const existing = prioritySlots[idx]!;
      if (votedPollIds?.has(existing.id) && !votedPollIds?.has(poll.id)) {
        prioritySlots[idx] = poll;
        remaining.push(existing);
      } else {
        remaining.push(poll);
      }
    } else {
      remaining.push(poll);
    }
  }

  // Flatten: priority (non-null, in order) then remaining
  const priorityPolls = prioritySlots.filter((p): p is T => p !== null);
  return [...priorityPolls, ...remaining];
}
