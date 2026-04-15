/**
 * Versa Personality Type System
 * 
 * Maps voting traits to 4 binary axes → 16 unique personality types
 * Each type has a custom Versa name + MBTI-equivalent code
 * 
 * Axes:
 * E/I — Social vs Independent (outward vs inward choices)
 * S/N — Practical vs Visionary (grounded vs future-oriented)
 * T/F — Strategic vs Authentic (logic vs values)
 * J/P — Decisive vs Flexible (structured vs spontaneous)
 */

interface TraitEntry {
  tag: string;
  vote_count: number;
}

// Which traits push toward each pole
const AXIS_TAGS = {
  E: ['social', 'global', 'brand_oriented', 'experience'],
  I: ['independent', 'local', 'minimalist', 'minimal'],
  S: ['convenience', 'price_sensitive', 'practical', 'traditional', 'tradition'],
  N: ['innovation', 'innovative', 'growth', 'adventurous'],
  T: ['price_sensitive', 'growth', 'quality', 'speed', 'convenience'],
  F: ['experience', 'social', 'indulgent', 'health', 'luxury'],
  J: ['brand_oriented', 'traditional', 'tradition', 'quality', 'local'],
  P: ['adventurous', 'innovative', 'innovation', 'global', 'growth'],
};

// 16 personality types with Versa names + MBTI codes
export const PERSONALITY_TYPES: Record<string, { name: string; emoji: string; description: string; strengths: string[] }> = {
  INTJ: {
    name: 'The Architect',
    emoji: '🏗️',
    description: 'Strategic and independent — you see the long game in every choice and build decisions with precision.',
    strengths: ['Strategic thinking', 'Independent judgment', 'Quality-focused'],
  },
  INTP: {
    name: 'The Analyst',
    emoji: '🔬',
    description: 'Curious and logical — you explore every angle before committing, driven by understanding over trends.',
    strengths: ['Deep analysis', 'Open-minded', 'Pattern recognition'],
  },
  ENTJ: {
    name: 'The Commander',
    emoji: '👑',
    description: 'Bold and decisive — you gravitate toward premium, trusted choices and lead with confidence.',
    strengths: ['Decisive action', 'Brand instinct', 'Leadership taste'],
  },
  ENTP: {
    name: 'The Maverick',
    emoji: '⚡',
    description: 'Inventive and restless — always first to try the new thing, you thrive on disrupting the expected.',
    strengths: ['Early adopter', 'Creative choices', 'Trend-setting'],
  },
  INFJ: {
    name: 'The Idealist',
    emoji: '🌙',
    description: 'Thoughtful and values-driven — your choices reflect deep personal principles, not popular opinion.',
    strengths: ['Values-aligned', 'Intentional living', 'Authentic taste'],
  },
  INFP: {
    name: 'The Dreamer',
    emoji: '🦋',
    description: 'Sensitive and creative — you choose what feels right, drawn to experiences that nourish the soul.',
    strengths: ['Emotional intelligence', 'Creative vision', 'Unique perspective'],
  },
  ENFJ: {
    name: 'The Ambassador',
    emoji: '🤝',
    description: 'Warm and influential — you pick what brings people together, naturally drawn to shared experiences.',
    strengths: ['Social connector', 'Quality advocate', 'Community builder'],
  },
  ENFP: {
    name: 'The Spark',
    emoji: '✨',
    description: 'Enthusiastic and spontaneous — you chase excitement and meaning, turning every choice into an adventure.',
    strengths: ['Adventurous spirit', 'Optimistic outlook', 'Experience hunter'],
  },
  ISTJ: {
    name: 'The Anchor',
    emoji: '⚓',
    description: 'Reliable and grounded — you trust what works and value consistency over novelty in every decision.',
    strengths: ['Dependable taste', 'Value-conscious', 'Practical wisdom'],
  },
  ISFJ: {
    name: 'The Guardian',
    emoji: '🛡️',
    description: 'Caring and steady — your choices prioritize comfort, well-being, and the people around you.',
    strengths: ['Thoughtful choices', 'Health-conscious', 'Loyal preferences'],
  },
  ESTJ: {
    name: 'The Executive',
    emoji: '📊',
    description: 'Efficient and brand-savvy — you know what delivers and stick with proven winners.',
    strengths: ['Efficiency-driven', 'Brand loyalty', 'Results-oriented'],
  },
  ESFJ: {
    name: 'The Host',
    emoji: '🎪',
    description: 'Social and generous — you choose what everyone will enjoy, the ultimate crowd-pleaser with great taste.',
    strengths: ['Social awareness', 'Crowd instinct', 'Generous spirit'],
  },
  ISTP: {
    name: 'The Craftsman',
    emoji: '🔧',
    description: 'Cool and analytical — you strip choices down to what actually works, no hype needed.',
    strengths: ['No-nonsense taste', 'Practical analysis', 'Independent mind'],
  },
  ISFP: {
    name: 'The Artist',
    emoji: '🎨',
    description: 'Gentle and aesthetic — you follow your senses, choosing what feels beautiful and authentic.',
    strengths: ['Aesthetic sense', 'Authentic living', 'Sensory awareness'],
  },
  ESTP: {
    name: 'The Dynamo',
    emoji: '🚀',
    description: 'Action-oriented and bold — you choose fast, live loud, and never look back.',
    strengths: ['Quick decisions', 'Bold choices', 'Real-world pragmatism'],
  },
  ESFP: {
    name: 'The Performer',
    emoji: '🎭',
    description: 'Playful and magnetic — life is a stage and your choices are always the most exciting ones.',
    strengths: ['Fun-seeker', 'Social energy', 'Living in the moment'],
  },
};

function scoreAxis(traits: TraitEntry[], positiveTags: string[], negativeTags: string[]): number {
  let score = 0;
  for (const t of traits) {
    const tag = t.tag?.toLowerCase();
    if (positiveTags.includes(tag)) score += t.vote_count;
    if (negativeTags.includes(tag)) score -= t.vote_count;
  }
  return score;
}

export interface PersonalityResult {
  code: string;       // e.g. "ENTJ"
  name: string;       // e.g. "The Commander"
  emoji: string;
  description: string;
  strengths: string[];
  axes: {
    ei: number; // positive = E, negative = I
    sn: number; // positive = S, negative = N
    tf: number; // positive = T, negative = F
    jp: number; // positive = J, negative = P
  };
  ready: boolean;     // whether enough votes for a type
}

export function computePersonalityType(traits: TraitEntry[], voteCount: number): PersonalityResult {
  const MIN_VOTES = 30;
  
  if (voteCount < MIN_VOTES || !traits.length) {
    return {
      code: '????',
      name: 'Undiscovered',
      emoji: '🌱',
      description: `Vote on ${Math.max(0, MIN_VOTES - voteCount)} more polls to reveal your personality type.`,
      strengths: [],
      axes: { ei: 0, sn: 0, tf: 0, jp: 0 },
      ready: false,
    };
  }

  const ei = scoreAxis(traits, AXIS_TAGS.E, AXIS_TAGS.I);
  const sn = scoreAxis(traits, AXIS_TAGS.S, AXIS_TAGS.N);
  const tf = scoreAxis(traits, AXIS_TAGS.T, AXIS_TAGS.F);
  const jp = scoreAxis(traits, AXIS_TAGS.J, AXIS_TAGS.P);

  const code =
    (ei >= 0 ? 'E' : 'I') +
    (sn >= 0 ? 'S' : 'N') +
    (tf >= 0 ? 'T' : 'F') +
    (jp >= 0 ? 'J' : 'P');

  const type = PERSONALITY_TYPES[code] || PERSONALITY_TYPES['INFP'];

  return {
    code,
    ...type,
    axes: { ei, sn, tf, jp },
    ready: true,
  };
}

// Explain why the user got this type based on their top traits
export function getPersonalityExplanation(traits: TraitEntry[], result: PersonalityResult): string[] {
  if (!result.ready) return [];
  
  const reasons: string[] = [];
  const { axes } = result;

  if (axes.ei >= 0) {
    reasons.push('You lean toward popular brands and shared experiences → Extroverted (E)');
  } else {
    reasons.push('You prefer niche, local, or independent choices → Introverted (I)');
  }

  if (axes.sn >= 0) {
    reasons.push('You prioritize practical value and convenience → Sensing (S)');
  } else {
    reasons.push('You chase innovation and future-forward options → Intuitive (N)');
  }

  if (axes.tf >= 0) {
    reasons.push('You decide with logic — price, speed, and efficiency matter → Thinking (T)');
  } else {
    reasons.push('You decide with values — experience, health, and enjoyment matter → Feeling (F)');
  }

  if (axes.jp >= 0) {
    reasons.push('You stick with what you trust — loyal and consistent → Judging (J)');
  } else {
    reasons.push('You stay open to new options — flexible and exploratory → Perceiving (P)');
  }

  return reasons;
}
