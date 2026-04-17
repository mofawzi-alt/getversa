import { supabase } from '@/integrations/supabase/client';

const shuffle = <T,>(items: T[]) => [...items].sort(() => Math.random() - 0.5);

export async function pickDuelPollIds(seedPollIds: string[] = [], desiredCount = 5) {
  const uniqueSeedIds = Array.from(new Set(seedPollIds.filter(Boolean)));
  const { data, error } = await supabase
    .from('polls')
    .select('id')
    .eq('is_active', true)
    .limit(Math.max(desiredCount * 24, 120));

  if (error) throw error;

  const remainingIds = shuffle((data ?? []).map((poll) => poll.id)).filter(
    (id) => !uniqueSeedIds.includes(id)
  );

  return [...uniqueSeedIds, ...remainingIds].slice(0, desiredCount);
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
