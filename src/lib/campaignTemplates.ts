export interface TemplatePollStub {
  question: string;
  option_a: string;
  option_b: string;
}

export interface CampaignTemplate {
  id: string;
  name: string;
  tagline: string;
  description: string;
  /** Use {brandA} / {brandB} / {brand} placeholders; replaced at apply time. */
  polls: TemplatePollStub[];
  needsTwoBrands?: boolean;
}

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: 'brand-battle',
    name: 'Brand Battle',
    tagline: 'Head-to-head across 5 dimensions',
    description: 'Two brands compete on taste, price, packaging, advertising and loyalty.',
    needsTwoBrands: true,
    polls: [
      { question: 'Which tastes better?', option_a: '{brandA}', option_b: '{brandB}' },
      { question: 'Which feels like better value for money?', option_a: '{brandA}', option_b: '{brandB}' },
      { question: 'Which has the more iconic packaging?', option_a: '{brandA}', option_b: '{brandB}' },
      { question: 'Whose ads do you actually remember?', option_a: '{brandA}', option_b: '{brandB}' },
      { question: 'Which one would you stay loyal to?', option_a: '{brandA}', option_b: '{brandB}' },
    ],
  },
  {
    id: 'product-intel',
    name: 'Product Intelligence',
    tagline: 'Single brand · feature trade-offs',
    description: 'Surface what your customers actually prioritise about your product.',
    polls: [
      { question: 'What matters more in {brand}?', option_a: 'Quality', option_b: 'Price' },
      { question: 'Pick the {brand} feature you can\'t live without', option_a: 'Speed', option_b: 'Reliability' },
      { question: 'For {brand}, you\'d rather have…', option_a: 'More variety', option_b: 'Better classics' },
      { question: '{brand} should focus on…', option_a: 'New launches', option_b: 'Improving the staples' },
    ],
  },
  {
    id: 'market-pulse',
    name: 'Market Pulse',
    tagline: 'Category-wide sentiment',
    description: 'Read the room across an entire category — not just your brand.',
    polls: [
      { question: 'What drives your choice in this category?', option_a: 'Trust', option_b: 'Trying new things' },
      { question: 'When buying, you go for…', option_a: 'The well-known name', option_b: 'The challenger' },
      { question: 'Best place to shop this category?', option_a: 'Online', option_b: 'In store' },
      { question: 'Worth paying more for?', option_a: 'Yes, premium', option_b: 'No, basics work' },
    ],
  },
  {
    id: 'perception-gap',
    name: 'Perception Gap',
    tagline: 'Identity & values',
    description: 'Reveal the gap between how the audience sees themselves and your brand.',
    polls: [
      { question: '{brand} is more for…', option_a: 'Everyday people', option_b: 'A specific crowd' },
      { question: '{brand} feels more…', option_a: 'Modern', option_b: 'Classic' },
      { question: '{brand} stands for…', option_a: 'Comfort', option_b: 'Status' },
      { question: 'You\'d describe {brand} fans as…', option_a: 'Loyal', option_b: 'Curious' },
    ],
  },
  {
    id: 'health-pulse',
    name: 'Brand Health Pulse',
    tagline: 'Recurring tracker',
    description: 'A repeatable 3-poll tracker for recommend / modern / trustworthy.',
    polls: [
      { question: 'Would you recommend {brand} to a friend?', option_a: 'Yes', option_b: 'Not really' },
      { question: 'Does {brand} feel modern?', option_a: 'Modern', option_b: 'Outdated' },
      { question: 'Do you trust {brand}?', option_a: 'Trust it', option_b: 'Have doubts' },
    ],
  },
];

export function applyTemplate(
  tpl: CampaignTemplate,
  vars: { brand: string; brandA?: string; brandB?: string }
): TemplatePollStub[] {
  return tpl.polls.map((p) => ({
    question: fill(p.question, vars),
    option_a: fill(p.option_a, vars),
    option_b: fill(p.option_b, vars),
  }));
}

function fill(s: string, vars: { brand: string; brandA?: string; brandB?: string }): string {
  return s
    .replace(/\{brand\}/g, vars.brand || 'this brand')
    .replace(/\{brandA\}/g, vars.brandA || vars.brand || 'Brand A')
    .replace(/\{brandB\}/g, vars.brandB || 'Brand B');
}
