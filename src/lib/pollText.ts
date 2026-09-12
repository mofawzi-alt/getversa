// Language helpers for bilingual polls (English + Arabic)

export type AppLanguage = 'en' | 'ar';

export interface BilingualPollFields {
  question: string;
  option_a: string;
  option_b: string;
  subtitle?: string | null;
  question_ar?: string | null;
  option_a_ar?: string | null;
  option_b_ar?: string | null;
  subtitle_ar?: string | null;
}

/**
 * Returns the poll text in the requested language.
 * Falls back to English whenever the Arabic field is missing.
 */
export function pollText(poll: BilingualPollFields, lang: AppLanguage) {
  const ar = lang === 'ar';
  return {
    question: ar && poll.question_ar ? poll.question_ar : poll.question,
    optionA: ar && poll.option_a_ar ? poll.option_a_ar : poll.option_a,
    optionB: ar && poll.option_b_ar ? poll.option_b_ar : poll.option_b,
    subtitle: ar && poll.subtitle_ar ? poll.subtitle_ar : (poll.subtitle ?? null),
  };
}

/** Arabic labels for the 8 fixed categories (display only; DB keeps English keys). */
export const CATEGORY_AR: Record<string, string> = {
  'Relationships': 'علاقات',
  'Money': 'فلوس',
  'Education': 'تعليم',
  'Digital Life': 'حياة رقمية',
  'Food': 'أكل',
  'Entertainment': 'ترفيه',
  'Lifestyle': 'لايف ستايل',
  'Egypt': 'مصر',
};

export function categoryLabel(category: string | null | undefined, lang: AppLanguage): string {
  if (!category) return '';
  return lang === 'ar' ? (CATEGORY_AR[category] || category) : category;
}
