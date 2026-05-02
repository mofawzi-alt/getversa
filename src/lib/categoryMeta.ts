import {
  Banknote,
  Car,
  Compass,
  Flame,
  Heart,
  Popcorn,
  ShoppingBag,
  Sparkles,
  Users,
  Utensils,
  Wifi,
  ShoppingBasket,
  type LucideIcon,
} from 'lucide-react';

/**
 * The 10 official Versa categories. All polls must map to one of these.
 */
export const VERSA_CATEGORIES = [
  'FMCG & Food',
  'Beauty & Personal Care',
  'Financial Services',
  'Media & Entertainment',
  'Retail & E-commerce',
  'Telco & Tech',
  'Food Delivery & Dining',
  'Automotive & Mobility',
  'Lifestyle & Society',
  'The Pulse',
] as const;

export type VersaCategory = (typeof VERSA_CATEGORIES)[number];

const EXACT_CATEGORY_ICONS: Record<string, LucideIcon> = {
  'fmcg & food': ShoppingBasket,
  'beauty & personal care': Sparkles,
  'financial services': Banknote,
  'media & entertainment': Popcorn,
  'retail & e-commerce': ShoppingBag,
  'telco & tech': Wifi,
  'food delivery & dining': Utensils,
  'automotive & mobility': Car,
  'lifestyle & society': Heart,
  'the pulse': Flame,
};

/** Tailwind color hint per category (used for chips/badges) */
export const CATEGORY_COLOR: Record<string, string> = {
  'fmcg & food': 'bg-green-100 text-green-700',
  'beauty & personal care': 'bg-pink-100 text-pink-700',
  'financial services': 'bg-blue-100 text-blue-700',
  'media & entertainment': 'bg-amber-100 text-amber-700',
  'retail & e-commerce': 'bg-purple-100 text-purple-700',
  'telco & tech': 'bg-teal-100 text-teal-700',
  'food delivery & dining': 'bg-orange-100 text-orange-700',
  'automotive & mobility': 'bg-gray-100 text-gray-700',
  'lifestyle & society': 'bg-rose-100 text-rose-700',
  'the pulse': 'bg-red-100 text-red-700',
};

const KEYWORD_FALLBACK: Array<{ keywords: string[]; icon: LucideIcon }> = [
  { keywords: ['money', 'finance', 'fintech', 'bank', 'budget', 'crypto', 'payment', 'business', 'startup'], icon: Banknote },
  { keywords: ['beauty', 'makeup', 'skincare', 'cosmetic', 'hair'], icon: Sparkles },
  { keywords: ['delivery', 'restaurant', 'dining', 'cafe', 'café'], icon: Utensils },
  { keywords: ['food', 'drink', 'snack', 'beverage', 'fmcg'], icon: ShoppingBasket },
  { keywords: ['retail', 'shopping', 'ecommerce', 'e-commerce', 'store', 'brand'], icon: ShoppingBag },
  { keywords: ['telecom', 'mobile', 'phone', 'network', 'internet', 'tech', 'app'], icon: Wifi },
  { keywords: ['car', 'auto', 'vehicle', 'mobility', 'ride'], icon: Car },
  { keywords: ['movie', 'film', 'series', 'tv', 'show', 'celeb', 'music', 'sport', 'game', 'entertainment'], icon: Popcorn },
  { keywords: ['lifestyle', 'society', 'relationship', 'wellness', 'style', 'fashion', 'personality'], icon: Heart },
  { keywords: ['pulse', 'trend', 'viral', 'culture', 'news'], icon: Flame },
];

export function normalizeCategoryName(category?: string | null): string {
  return category?.trim().toLowerCase() ?? '';
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
  return CATEGORY_COLOR[normalizeCategoryName(category)] ?? 'bg-muted text-muted-foreground';
}

/**
 * Map any free-form category string to one of the 10 Versa categories.
 * Returns 'The Pulse' as the default catch-all.
 */
export function mapToVersaCategory(input?: string | null): VersaCategory {
  const n = normalizeCategoryName(input);
  if (!n) return 'The Pulse';

  // Direct match
  for (const cat of VERSA_CATEGORIES) {
    if (n === cat.toLowerCase()) return cat;
  }

  // Keyword routing
  if (/(deliver|restaurant|dining|cafe|café|talabat|elmenus|otlob)/.test(n)) return 'Food Delivery & Dining';
  if (/(beauty|makeup|skincare|cosmetic|shampoo|perfume|hair)/.test(n)) return 'Beauty & Personal Care';
  if (/(bank|finance|fintech|money|budget|crypto|payment|wallet|loan|business|startup)/.test(n)) return 'Financial Services';
  if (/(telecom|mobile|phone|network|internet|wifi|tech|app|software|gadget|telco)/.test(n)) return 'Telco & Tech';
  if (/(car|auto|vehicle|mobility|ride|uber|careem|swvl|motorcycle|scooter)/.test(n)) return 'Automotive & Mobility';
  if (/(retail|shopping|ecommerce|e-commerce|store|brand|amazon|noon|jumia)/.test(n)) return 'Retail & E-commerce';
  if (/(movie|film|series|tv|show|celeb|music|song|artist|sport|football|game|gaming|entertainment)/.test(n)) return 'Media & Entertainment';
  if (/(food|drink|snack|beverage|fmcg|coffee|tea|chips|cola|juice|chocolate)/.test(n)) return 'FMCG & Food';
  if (/(lifestyle|society|relationship|dating|wellness|habit|style|fashion|design|personality|travel|education|school|university|study|learning)/.test(n)) return 'Lifestyle & Society';
  if (/(pulse|trend|viral|culture|news|politic|debate)/.test(n)) return 'The Pulse';

  return 'The Pulse';
}
