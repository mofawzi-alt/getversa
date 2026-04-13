/**
 * Taste-based poll scoring.
 * Scores polls based on how well they match a user's voting history
 * (preferred categories and behavioral tags).
 */

export interface TasteProfile {
  /** category → vote count */
  categories: Map<string, number>;
  /** option tag → vote count */
  tags: Map<string, number>;
  totalVotes: number;
}

/**
 * Build a taste profile from raw vote/category data and trait tags.
 */
export function buildTasteProfile(
  categoryVotes: { category: string; count: number }[],
  traitTags: { tag: string; vote_count: number }[],
): TasteProfile {
  const categories = new Map<string, number>();
  let totalVotes = 0;
  for (const cv of categoryVotes) {
    categories.set(cv.category.toLowerCase(), cv.count);
    totalVotes += cv.count;
  }
  const tags = new Map<string, number>();
  for (const tt of traitTags) {
    tags.set(tt.tag.toLowerCase(), tt.vote_count);
  }
  return { categories, tags, totalVotes };
}

/**
 * Score a single poll against a user's taste profile.
 * Returns a value between 0 and 1 (1 = perfect match).
 */
export function tastePollScore(
  poll: {
    category: string | null;
    option_a_tag?: string | null;
    option_b_tag?: string | null;
    tags?: string[] | null;
  },
  taste: TasteProfile,
): number {
  if (taste.totalVotes === 0) return 0.5; // no data, neutral

  let score = 0;
  let signals = 0;

  // Category match (strongest signal — 60% weight)
  const cat = poll.category?.toLowerCase();
  if (cat && taste.categories.has(cat)) {
    const catCount = taste.categories.get(cat)!;
    // Normalize: how much of user's voting went to this category
    const catAffinity = Math.min(catCount / taste.totalVotes, 1);
    score += catAffinity * 0.6;
    signals++;
  }

  // Option tag match (30% weight)
  const pollTags = [poll.option_a_tag, poll.option_b_tag].filter(Boolean).map(t => t!.toLowerCase());
  if (pollTags.length > 0 && taste.tags.size > 0) {
    let tagScore = 0;
    let tagMatches = 0;
    const maxTagCount = Math.max(...taste.tags.values(), 1);
    for (const pt of pollTags) {
      if (taste.tags.has(pt)) {
        tagScore += taste.tags.get(pt)! / maxTagCount;
        tagMatches++;
      }
    }
    if (tagMatches > 0) {
      score += (tagScore / pollTags.length) * 0.3;
      signals++;
    }
  }

  // Poll tags array match (10% weight)
  if (poll.tags && poll.tags.length > 0 && taste.tags.size > 0) {
    let anyMatch = false;
    for (const t of poll.tags) {
      if (taste.tags.has(t.toLowerCase()) || taste.categories.has(t.toLowerCase())) {
        anyMatch = true;
        break;
      }
    }
    if (anyMatch) {
      score += 0.1;
      signals++;
    }
  }

  // If no signals matched, give a small discovery bonus so untouched categories still appear
  if (signals === 0) return 0.15;

  return Math.min(score, 1);
}

/**
 * Compute a blended ranking score for a poll combining taste, trending, and admin weight.
 *
 * Weights:
 *  - taste match: 50%
 *  - time-decay trending: 35%
 *  - admin weight: 15% (capped so it's a boost, not an override)
 */
export function blendedPollScore(
  poll: {
    category: string | null;
    option_a_tag?: string | null;
    option_b_tag?: string | null;
    tags?: string[] | null;
    totalVotes: number;
    created_at: string;
    weight_score?: number | null;
  },
  taste: TasteProfile,
  nowMs: number,
): number {
  // 1. Taste score (0-1)
  const ts = tastePollScore(poll, taste);

  // 2. Time-decay trending score (0-1, normalized)
  const ageHours = Math.max(0, (nowMs - new Date(poll.created_at).getTime()) / (1000 * 60 * 60));
  const rawDecay = poll.totalVotes / Math.pow(ageHours + 2, 0.6);
  // Normalize: cap at ~200 as a reasonable upper bound
  const trendScore = Math.min(rawDecay / 200, 1);

  // 3. Admin weight (0-1, normalized)
  const ws = poll.weight_score ?? 500;
  // 500 is default → 0, 10000 → 1
  const adminScore = Math.min(Math.max((ws - 500) / 9500, 0), 1);

  return ts * 0.50 + trendScore * 0.35 + adminScore * 0.15;
}
