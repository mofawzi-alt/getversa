import {
  Banknote,
  Compass,
  Flag,
  GraduationCap,
  Heart,
  Popcorn,
  Smartphone,
  Sparkles,
  Utensils,
  type LucideIcon,
} from 'lucide-react';

/**
 * The 8 official Versa categories. All polls must map to one of these.
 */
export const VERSA_CATEGORIES = [
  'Relationships',
  'Money',
  'Education',
  'Digital Life',
  'Food',
  'Entertainment',
  'Lifestyle',
  'Egypt',
] as const;

export type VersaCategory = (typeof VERSA_CATEGORIES)[number];

/** Emoji per category (used for compact chips and stories) */
export const CATEGORY_EMOJI: Record<string, string> = {
  relationships: '❤️',
  money: '💰',
  education: '🎓',
  'digital life': '📱',
  food: '🍔',
  entertainment: '🎬',
  lifestyle: '🌍',
  egypt: '🇪🇬',
};

const EXACT_CATEGORY_ICONS: Record<string, LucideIcon> = {
  relationships: Heart,
  money: Banknote,
  education: GraduationCap,
  'digital life': Smartphone,
  food: Utensils,
  entertainment: Popcorn,
  lifestyle: Sparkles,
  egypt: Flag,
};

/** Tailwind color hint per category (used for chips/badges) */
export const CATEGORY_COLOR: Record<string, string> = {
  relationships: 'bg-rose-200 text-rose-900 ring-1 ring-rose-300/60',
  money: 'bg-blue-200 text-blue-900 ring-1 ring-blue-300/60',
  education: 'bg-indigo-200 text-indigo-900 ring-1 ring-indigo-300/60',
  'digital life': 'bg-teal-200 text-teal-900 ring-1 ring-teal-300/60',
  food: 'bg-orange-200 text-orange-900 ring-1 ring-orange-300/60',
  entertainment: 'bg-amber-200 text-amber-900 ring-1 ring-amber-300/60',
  lifestyle: 'bg-purple-200 text-purple-900 ring-1 ring-purple-300/60',
  egypt: 'bg-red-200 text-red-900 ring-1 ring-red-300/60',
};

const KEYWORD_FALLBACK: Array<{ keywords: string[]; icon: LucideIcon }> = [
  { keywords: ['relationship', 'dating', 'love', 'marriage', 'friend', 'family'], icon: Heart },
  { keywords: ['money', 'finance', 'fintech', 'bank', 'budget', 'crypto', 'payment', 'business', 'startup', 'career', 'work', 'salary', 'real estate'], icon: Banknote },
  { keywords: ['education', 'school', 'university', 'study', 'learning', 'exam', 'student'], icon: GraduationCap },
  { keywords: ['tech', 'telecom', 'mobile', 'phone', 'network', 'internet', 'app', 'social media', 'digital', 'gaming'], icon: Smartphone },
  { keywords: ['food', 'drink', 'snack', 'beverage', 'fmcg', 'restaurant', 'delivery', 'dining', 'cafe', 'café'], icon: Utensils },
  { keywords: ['movie', 'film', 'series', 'tv', 'show', 'celeb', 'music', 'sport', 'entertainment', 'media'], icon: Popcorn },
  { keywords: ['lifestyle', 'beauty', 'fashion', 'style', 'wellness', 'health', 'travel', 'shopping', 'retail', 'car', 'auto', 'mobility'], icon: Sparkles },
  { keywords: ['egypt', 'pulse', 'trend', 'viral', 'culture', 'news', 'society'], icon: Flag },
];

export function normalizeCategoryName(category?: string | null): string {
  return category?.trim().toLowerCase() ?? '';
}

export function getCategoryEmoji(category?: string | null): string {
  return CATEGORY_EMOJI[normalizeCategoryName(mapToVersaCategory(category))] ?? '✨';
}

export function getCategoryIcon(category?: string | null): LucideIcon {
  const normalized = normalizeCategoryName(category);
  if (!normalized) return Compass;

  const exact = EXACT_CATEGORY_ICONS[normalized];
  if (exact) return exact;

  const fallback = KEYWORD_FALLBACK.find(({ keywords }) =>
    keywords.some((k) => normalized.includes(k))
  );
  return fallback?.icon ?? Compass;
}

export function getCategoryColorClass(category?: string | null): string {
  const direct = CATEGORY_COLOR[normalizeCategoryName(category)];
  if (direct) return direct;
  return CATEGORY_COLOR[normalizeCategoryName(mapToVersaCategory(category))] ?? 'bg-muted text-muted-foreground';
}

/**
 * Map any free-form category string to one of the 8 Versa categories.
 * Returns 'Egypt' as the default catch-all.
 */
export function mapToVersaCategory(input?: string | null): VersaCategory {
  const n = normalizeCategoryName(input);
  if (!n) return 'Egypt';

  // Direct match
  for (const cat of VERSA_CATEGORIES) {
    if (n === cat.toLowerCase()) return cat;
  }

  // Keyword routing
  if (/(relationship|dating|love|marriage|romance|friend|family|parent)/.test(n)) return 'Relationships';
  if (/(bank|finance|financial|fintech|money|budget|crypto|payment|wallet|loan|business|startup|career|work|job|salary|invest|real estate)/.test(n)) return 'Money';
  if (/(education|school|university|study|studies|learning|exam|student|course)/.test(n)) return 'Education';
  if (/(telecom|telco|mobile|phone|network|internet|wifi|tech|app|software|gadget|digital|gaming|social media|ai)/.test(n)) return 'Digital Life';
  if (/(food|drink|snack|beverage|fmcg|coffee|tea|chips|cola|juice|chocolate|deliver|restaurant|dining|cafe|café)/.test(n)) return 'Food';
  if (/(movie|film|series|tv|show|celeb|music|song|artist|sport|football|entertainment|media|content)/.test(n)) return 'Entertainment';
  if (/(lifestyle|beauty|makeup|skincare|cosmetic|perfume|hair|fashion|style|wellness|health|fitness|travel|shopping|retail|ecommerce|e-commerce|store|brand|car|auto|vehicle|mobility|ride|transport)/.test(n)) return 'Lifestyle';
  if (/(egypt|pulse|trend|viral|culture|news|politic|debate|society)/.test(n)) return 'Egypt';

  return 'Egypt';
}
