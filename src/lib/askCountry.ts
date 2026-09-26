/**
 * Country-aware copy for Ask Versa.
 *
 * Ask Versa used to be hardcoded to Egypt ("Can't decide? Egypt already did.").
 * This module resolves the viewer's country into the right headlines, placeholders,
 * suggestion chips and verdict wording, with a universal fallback for countries
 * that don't have a dedicated voice yet.
 */

export type AskCountryKey = 'EG' | 'AE' | 'GLOBAL';

export interface AskSuggestion {
  text: string;
  tag: string;
  icon: 'flame' | 'users' | 'zap' | 'trending';
}

export interface AskCountryCopy {
  key: AskCountryKey;
  /** Canonical country name sent to the answer engine (null = unknown). */
  countryName: string | null;
  /** Short place label used inside sentences, e.g. "Egypt", "the UAE". */
  place: string;
  /** People label, e.g. "Egyptians", "UAE residents", "people". */
  people: string;
  decideTitle: string;
  researchTitle: string;
  decidePlaceholders: string[];
  researchPlaceholders: string[];
  decideSuggestions: AskSuggestion[];
  researchSuggestions: AskSuggestion[];
  /** Verdict line key — takes a {pct} variable. */
  verdictLineKey: string;
  /** Share-card sample-size line (plain English, drawn on canvas). */
  shareSampleLine: (votes: number) => string;
  /** Native share text (plain English). */
  shareText: (pct: number, label: string, question: string) => string;
}

const EG: AskCountryCopy = {
  key: 'EG',
  countryName: 'Egypt',
  place: 'Egypt',
  people: 'Egyptians',
  decideTitle: "Can't decide? Egypt already did.",
  researchTitle: 'Understand what Egypt really thinks',
  decidePlaceholders: [
    'Ask what Egypt thinks…',
    'What are people choosing?',
    'Ask the pulse of Egypt…',
    'What would Egypt pick?',
    'Help me decide…',
  ],
  researchPlaceholders: [
    'Explore public sentiment…',
    'What does Egypt really think?',
    'Discover opinion patterns…',
    'Analyze the public mood…',
  ],
  decideSuggestions: [
    { text: 'Costa or Cilantro for studying?', tag: 'Trending', icon: 'flame' },
    { text: 'iPhone or Samsung — which lasts longer?', tag: '2.4K voted', icon: 'users' },
    { text: 'Should I order Talabat or Elmenus tonight?', tag: 'Hot', icon: 'zap' },
    { text: 'Nike or Adidas for everyday wear?', tag: '50/50 split', icon: 'trending' },
  ],
  researchSuggestions: [
    { text: 'How do students feel about online learning?', tag: 'Popular', icon: 'flame' },
    { text: 'What do people think about marriage age in Egypt?', tag: 'Divisive', icon: 'trending' },
    { text: 'Cairo vs Alexandria lifestyle differences', tag: '1.8K votes', icon: 'users' },
    { text: 'Which fast food brand wins with 18–24?', tag: 'Hot', icon: 'zap' },
    { text: 'How divided are Egyptians on Ahly vs Zamalek?', tag: '50/50', icon: 'flame' },
  ],
  verdictLineKey: '{pct}% of Egypt chose this',
  shareSampleLine: (votes) => `Based on ${votes.toLocaleString()} Egyptian votes`,
  shareText: (pct, label, question) => `${pct}% of Egyptians pick ${label}. ${question}`,
};

const AE: AskCountryCopy = {
  key: 'AE',
  countryName: 'United Arab Emirates',
  place: 'the UAE',
  people: 'people in the UAE',
  decideTitle: "Can't decide? The UAE already did.",
  researchTitle: 'Understand what the UAE really thinks',
  decidePlaceholders: [
    'Ask what the UAE thinks…',
    'What are people choosing?',
    'Ask the pulse of the UAE…',
    'What would the UAE pick?',
    'Help me decide…',
  ],
  researchPlaceholders: [
    'Explore public sentiment…',
    'What does the UAE really think?',
    'Discover opinion patterns…',
    'Analyze the public mood…',
  ],
  decideSuggestions: [
    { text: 'Dubai Mall or Mall of the Emirates for a day out?', tag: 'Trending', icon: 'flame' },
    { text: 'iPhone or Samsung — which lasts longer?', tag: '2.4K voted', icon: 'users' },
    { text: 'Should I order Talabat or Deliveroo tonight?', tag: 'Hot', icon: 'zap' },
    { text: 'Nike or Adidas for everyday wear?', tag: '50/50 split', icon: 'trending' },
  ],
  researchSuggestions: [
    { text: 'How do students feel about online learning?', tag: 'Popular', icon: 'flame' },
    { text: 'What do people in the UAE think about remote work?', tag: 'Divisive', icon: 'trending' },
    { text: 'Dubai vs Abu Dhabi lifestyle differences', tag: '1.8K votes', icon: 'users' },
    { text: 'Which coffee spot wins with 18–24?', tag: 'Hot', icon: 'zap' },
    { text: 'Beach day or desert escape — what wins the weekend?', tag: '50/50', icon: 'flame' },
  ],
  verdictLineKey: '{pct}% of the UAE chose this',
  shareSampleLine: (votes) => `Based on ${votes.toLocaleString()} votes in the UAE`,
  shareText: (pct, label, question) => `${pct}% in the UAE pick ${label}. ${question}`,
};

function buildGlobal(countryName: string | null): AskCountryCopy {
  return {
    key: 'GLOBAL',
    countryName,
    place: 'people',
    people: 'people',
    decideTitle: "Can't decide? Versa already did.",
    researchTitle: 'Understand what people really think',
    decidePlaceholders: [
      'Ask what people think…',
      'What are people choosing?',
      'Ask the public pulse…',
      'What would most people pick?',
      'Help me decide…',
    ],
    researchPlaceholders: [
      'Explore public sentiment…',
      'What do people really think?',
      'Discover opinion patterns…',
      'Analyze the public mood…',
    ],
    decideSuggestions: [
      { text: 'Coffee or tea to start the day?', tag: 'Trending', icon: 'flame' },
      { text: 'iPhone or Samsung — which lasts longer?', tag: '2.4K voted', icon: 'users' },
      { text: 'Cook at home or order in tonight?', tag: 'Hot', icon: 'zap' },
      { text: 'Nike or Adidas for everyday wear?', tag: '50/50 split', icon: 'trending' },
    ],
    researchSuggestions: [
      { text: 'How do students feel about online learning?', tag: 'Popular', icon: 'flame' },
      { text: 'What do people think about remote work?', tag: 'Divisive', icon: 'trending' },
      { text: 'City life vs small town living', tag: '1.8K votes', icon: 'users' },
      { text: 'Which fast food brand wins with 18–24?', tag: 'Hot', icon: 'zap' },
      { text: 'Early bird or night owl — which side wins?', tag: '50/50', icon: 'flame' },
    ],
    verdictLineKey: '{pct}% of people chose this',
    shareSampleLine: (votes) => `Based on ${votes.toLocaleString()} real votes`,
    shareText: (pct, label, question) => `${pct}% pick ${label}. ${question}`,
  };
}

const EGYPT_MATCH = /^(eg|egy|egypt|مصر|arab republic of egypt)$/i;
const UAE_MATCH = /^(ae|uae|u\.a\.e\.?|emirates|united arab emirates|الإمارات|الامارات)$/i;

export function resolveAskCountry(country?: string | null): AskCountryCopy {
  const raw = (country || '').trim();
  if (!raw) return buildGlobal(null);
  if (EGYPT_MATCH.test(raw) || /egypt/i.test(raw)) return EG;
  if (UAE_MATCH.test(raw) || /emirat/i.test(raw) || /\buae\b/i.test(raw)) return AE;
  return buildGlobal(raw);
}
