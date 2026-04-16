import {
  Brain,
  Clapperboard,
  Compass,
  Flame,
  Gamepad2,
  HeartHandshake,
  Landmark,
  MonitorSmartphone,
  Music,
  Palette,
  Plane,
  Rocket,
  Smartphone,
  Sparkles,
  Tag,
  Trophy,
  UserRound,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';

const EXACT_CATEGORY_ICONS: Record<string, LucideIcon> = {
  'the pulse': Flame,
  brands: Tag,
  brand: Tag,
  'business & startups': Rocket,
  'fintech & money': Landmark,
  'style & design': Palette,
  style: Palette,
  entertainment: Clapperboard,
  sports: Trophy,
  'wellness & habits': Brain,
  personality: UserRound,
  lifestyle: Sparkles,
  'food & drinks': UtensilsCrossed,
  food: UtensilsCrossed,
  telecom: Smartphone,
  beauty: Sparkles,
  relationships: HeartHandshake,
  travel: Plane,
  music: Music,
  gaming: Gamepad2,
  tech: MonitorSmartphone,
  fashion: Palette,
};

const KEYWORD_CATEGORY_ICONS: Array<{ keywords: string[]; icon: LucideIcon }> = [
  { keywords: ['money', 'finance', 'fintech', 'bank', 'budget', 'crypto', 'payment'], icon: Landmark },
  { keywords: ['brand', 'shopping', 'retail', 'product'], icon: Tag },
  { keywords: ['business', 'startup', 'career', 'hustle'], icon: Rocket },
  { keywords: ['style', 'design', 'fashion', 'aesthetic'], icon: Palette },
  { keywords: ['beauty', 'makeup', 'skincare'], icon: Sparkles },
  { keywords: ['entertainment', 'movie', 'film', 'series', 'tv', 'show', 'celeb'], icon: Clapperboard },
  { keywords: ['sports', 'sport', 'football', 'soccer', 'basketball', 'match'], icon: Trophy },
  { keywords: ['wellness', 'habit', 'health', 'mind', 'routine'], icon: Brain },
  { keywords: ['personality', 'identity', 'traits'], icon: UserRound },
  { keywords: ['lifestyle', 'life', 'vibe'], icon: Sparkles },
  { keywords: ['food', 'drink', 'coffee', 'tea', 'restaurant', 'burger', 'pizza'], icon: UtensilsCrossed },
  { keywords: ['telecom', 'mobile', 'phone', 'network', 'internet'], icon: Smartphone },
  { keywords: ['relationship', 'dating', 'love', 'couple'], icon: HeartHandshake },
  { keywords: ['travel', 'trip', 'vacation', 'flight'], icon: Plane },
  { keywords: ['music', 'song', 'artist', 'album'], icon: Music },
  { keywords: ['gaming', 'game', 'console'], icon: Gamepad2 },
  { keywords: ['tech', 'technology', 'app', 'digital', 'software'], icon: MonitorSmartphone },
  { keywords: ['pulse', 'trend', 'viral', 'culture', 'news'], icon: Flame },
];

export function normalizeCategoryName(category?: string | null): string {
  return category?.trim().toLowerCase() ?? '';
}

export function getCategoryIcon(category?: string | null): LucideIcon {
  const normalizedCategory = normalizeCategoryName(category);

  if (!normalizedCategory) {
    return Compass;
  }

  const exactMatch = EXACT_CATEGORY_ICONS[normalizedCategory];
  if (exactMatch) {
    return exactMatch;
  }

  const keywordMatch = KEYWORD_CATEGORY_ICONS.find(({ keywords }) =>
    keywords.some((keyword) => normalizedCategory.includes(keyword))
  );

  return keywordMatch?.icon ?? Compass;
}
