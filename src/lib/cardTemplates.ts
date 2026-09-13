import { getCategoryEmoji, mapToVersaCategory } from '@/lib/categoryMeta';

/**
 * Four distinct visual layouts for feed cards so the feed feels varied
 * (Instagram-style) instead of one repeated card design.
 */
export type CardTemplate = 'cinematic' | 'bold-type' | 'color-block' | 'split-vs';

export const CARD_TEMPLATES: CardTemplate[] = ['cinematic', 'bold-type', 'color-block', 'split-vs'];

/** Solid background per category, used by the Color Block template. */
const CATEGORY_BLOCK_BG: Record<string, string> = {
  relationships: 'bg-rose-600',
  money: 'bg-blue-700',
  education: 'bg-indigo-700',
  'digital life': 'bg-teal-700',
  food: 'bg-orange-600',
  entertainment: 'bg-amber-600',
  lifestyle: 'bg-purple-700',
  egypt: 'bg-red-700',
};

export function getCategoryBlockBg(category?: string | null): string {
  const key = mapToVersaCategory(category).toLowerCase();
  return CATEGORY_BLOCK_BG[key] ?? 'bg-neutral-800';
}

export function getCardEmoji(category?: string | null): string {
  return getCategoryEmoji(category);
}

interface TemplatePoll {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  category?: string | null;
  image_a_url?: string | null;
  image_b_url?: string | null;
}

/** Short, name-like option (brand / product / place) rather than a sentence. */
function looksLikeName(option: string): boolean {
  const value = (option || '').trim();
  if (!value || value.length > 22) return false;
  const words = value.split(/\s+/);
  if (words.length > 3) return false;
  // Starts with a capital letter or is a well-known short label
  return /^[A-Z\u0621-\u064A0-9]/.test(value);
}

function isPreferenceQuestion(question: string): boolean {
  return /\b(vs|or|prefer|favou?rite|better|pick|choose|team)\b/i.test(question || '');
}

function isOpinionQuestion(question: string): boolean {
  return /\b(should|would|is it|do you|can you|ok to|acceptable|worth it|red flag|deal ?breaker|right|wrong)\b/i.test(
    question || ''
  );
}

/** Preferred template for a single poll, from its category + content. */
export function preferredTemplate(poll: TemplatePoll): CardTemplate {
  const category = mapToVersaCategory(poll.category);
  const hasBothImages = Boolean(poll.image_a_url && poll.image_b_url);
  const bothAreNames = looksLikeName(poll.option_a) && looksLikeName(poll.option_b);

  // Split VS — both options are brands / products / places with their own visuals
  if (hasBothImages && bothAreNames) return 'split-vs';

  // Color Block — light, fun preference polls with short options
  if (bothAreNames && isPreferenceQuestion(poll.question)) return 'color-block';

  // Bold Type — opinion / decision / relationship questions
  if (isOpinionQuestion(poll.question) || category === 'Relationships' || category === 'Money' || category === 'Education' || category === 'Digital Life') {
    return 'bold-type';
  }

  // Cinematic — lifestyle, food mood, Egypt, travel, entertainment
  if (category === 'Lifestyle' || category === 'Food' || category === 'Egypt' || category === 'Entertainment') {
    return 'cinematic';
  }

  return poll.image_a_url || poll.image_b_url ? 'cinematic' : 'bold-type';
}

/** Fallbacks that still respect what the poll actually has to show. */
function alternatives(poll: TemplatePoll, preferred: CardTemplate): CardTemplate[] {
  const hasBothImages = Boolean(poll.image_a_url && poll.image_b_url);
  const hasAnyImage = Boolean(poll.image_a_url || poll.image_b_url);
  const ordered: CardTemplate[] = ['cinematic', 'bold-type', 'color-block', 'split-vs'];
  return ordered.filter((template) => {
    if (template === preferred) return false;
    if (template === 'split-vs') return hasBothImages;
    if (template === 'cinematic') return hasAnyImage;
    return true;
  });
}

/**
 * Assign a template per poll, never repeating the previous card's template
 * so no two consecutive cards look the same.
 */
export function assignCardTemplates<T extends TemplatePoll>(polls: T[]): Map<string, CardTemplate> {
  const result = new Map<string, CardTemplate>();
  let previous: CardTemplate | null = null;

  polls.forEach((poll) => {
    const preferred = preferredTemplate(poll);
    let chosen = preferred;
    if (previous === chosen) {
      const options = alternatives(poll, preferred);
      chosen = options[0] ?? preferred;
    }
    result.set(poll.id, chosen);
    previous = chosen;
  });

  return result;
}
