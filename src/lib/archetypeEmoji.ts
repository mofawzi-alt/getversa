// Lookup emoji for taste archetypes and personality type names.
// Used by user story viewer to render expressive icon per personality.

const ARCHETYPE_EMOJI: Record<string, string> = {
  'The Risk Taker': '🎲',
  'The Loyalist': '🛡️',
  'The Explorer': '🧭',
  'The Minimalist': '✨',
  'The Trendsetter': '👑',
  'The Strategist': '🎯',
  'The Visionary': '🚀',
  'The Optimizer': '⚡',
  'The Individual': '💎',
  'The Newcomer': '🌱',
};

const PERSONALITY_EMOJI: Record<string, string> = {
  'The Architect': '🏗️',
  'The Analyst': '🔬',
  'The Commander': '👑',
  'The Maverick': '⚡',
  'The Idealist': '🌙',
  'The Dreamer': '🦋',
  'The Ambassador': '🤝',
  'The Spark': '✨',
  'The Anchor': '⚓',
  'The Guardian': '🛡️',
  'The Executive': '📊',
  'The Host': '🎪',
  'The Craftsman': '🔧',
  'The Artist': '🎨',
  'The Dynamo': '🚀',
  'The Performer': '🎭',
};

export function getArchetypeEmoji(name?: string | null): string | undefined {
  if (!name) return undefined;
  return ARCHETYPE_EMOJI[name] || PERSONALITY_EMOJI[name];
}

export function resolveTasteStoryEmoji(content: any): string {
  return (
    content?.archetype_emoji ||
    content?.personality_emoji ||
    getArchetypeEmoji(content?.archetype) ||
    getArchetypeEmoji(content?.personality_name) ||
    '💎'
  );
}
