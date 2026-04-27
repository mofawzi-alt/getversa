// Editorial story types — the 6 new colored stories on the home Stories row.
// Each has its own color, emoji, label, and frequency. Distinct from existing pulse circles.

export type EditorialStoryType =
  | 'egypt_today'
  | 'generation_gap'
  | 'city_divide'
  | 'brand_intel'
  | 'trend_alert'
  | 'this_week';

export type EditorialCard = {
  // Card 1 — Hook
  hook?: { headline: string; bigStat: string; subtext?: string };
  // Card 2 — Data
  data?: {
    question: string;
    option_a: string;
    option_b: string;
    pct_a: number;
    pct_b: number;
    total_votes: number;
    image_a_url?: string | null;
    image_b_url?: string | null;
    demographic_split?: {
      label: string;
      a_value: string; a_pct: number;
      b_value: string; b_pct: number;
    };
  };
  // Card 3 — Insight
  insight?: { emoji: string; text: string; basedOnVotes: number };
  // Card 4 — Connection
  connection?: {
    text: string;
    sourceName?: string | null;
    sourceUrl?: string | null;
    trend?: { from_pct: number; to_pct: number; label?: string } | null;
  };
  // Card 5 — Action (resolved at render time from cta_poll_id)
  action?: { ctaLabel?: string };
};

export const EDITORIAL_STORY_META: Record<
  EditorialStoryType,
  {
    label: string;
    emoji: string;
    color: string;       // primary brand color
    bgTint: string;      // soft background for hook card pill
    frequency: string;
    source: 'manual' | 'auto';
  }
> = {
  egypt_today:    { label: 'Egypt Today',    emoji: '🇪🇬', color: '#2563EB', bgTint: '#EFF6FF', frequency: 'daily',   source: 'manual' },
  generation_gap: { label: 'Generation Gap', emoji: '⚡',  color: '#7C3AED', bgTint: '#F5F3FF', frequency: 'daily',   source: 'auto'   },
  city_divide:    { label: 'City Divide',    emoji: '🏙',  color: '#D97706', bgTint: '#FFFBEB', frequency: 'daily',   source: 'auto'   },
  brand_intel:    { label: 'Brand Intel',    emoji: '📊',  color: '#059669', bgTint: '#ECFDF5', frequency: 'weekly',  source: 'auto'   },
  trend_alert:    { label: 'Trend Alert',    emoji: '📈',  color: '#DC2626', bgTint: '#FEF2F2', frequency: 'monthly', source: 'auto'   },
  this_week:      { label: 'This Week',      emoji: '🔥',  color: '#F59E0B', bgTint: '#FFFBEB', frequency: 'weekly',  source: 'manual' },
};

export const EDITORIAL_TYPES: EditorialStoryType[] = [
  'egypt_today', 'generation_gap', 'city_divide', 'brand_intel', 'trend_alert', 'this_week',
];
