import { supabase } from '@/integrations/supabase/client';

const shuffle = <T,>(items: T[]) => [...items].sort(() => Math.random() - 0.5);

export async function pickDuelPollIds(
  seedPollIds: string[] = [],
  desiredCount = 5,
  category?: string | null
) {
  const uniqueSeedIds = Array.from(new Set(seedPollIds.filter(Boolean)));

  let categoryIds: string[] = [];
  if (category) {
    const { data: catData, error: catError } = await supabase
      .from('polls')
      .select('id')
      .eq('is_active', true)
      .ilike('category', category)
      .limit(Math.max(desiredCount * 24, 120));
    if (catError) throw catError;
    categoryIds = shuffle((catData ?? []).map((p) => p.id)).filter(
      (id) => !uniqueSeedIds.includes(id)
    );
  }

  const combined = [...uniqueSeedIds, ...categoryIds];

  // Top up with random polls if we don't have enough
  if (combined.length < desiredCount) {
    const { data, error } = await supabase
      .from('polls')
      .select('id')
      .eq('is_active', true)
      .limit(Math.max(desiredCount * 24, 120));
    if (error) throw error;
    const fillerIds = shuffle((data ?? []).map((p) => p.id)).filter(
      (id) => !combined.includes(id)
    );
    combined.push(...fillerIds);
  }

  return combined.slice(0, desiredCount);
}

export async function fetchDuelCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from('polls')
    .select('category')
    .eq('is_active', true)
    .not('category', 'is', null);
  if (error) throw error;
  const set = new Set<string>();
  (data ?? []).forEach((row: { category: string | null }) => {
    if (row.category) set.add(row.category.trim());
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function normalizeDuelChoices(raw: string | null) {
  if (!raw) return null;
  if (raw === 'A' || raw === 'B') return JSON.stringify([raw]);

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    const validChoices = parsed.filter(
      (choice): choice is 'A' | 'B' => choice === 'A' || choice === 'B'
    );

    return validChoices.length ? JSON.stringify(validChoices) : null;
  } catch {
    return null;
  }
}
