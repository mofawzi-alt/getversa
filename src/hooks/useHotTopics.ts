import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type HotTopic = {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  image_a_url: string | null;
  image_b_url: string | null;
  category: string | null;
  recentVotes: number;
};

const WINDOW_MS = 6 * 60 * 60 * 1000;

/**
 * Hottest polls right now — ranked by votes received in the last 6 hours.
 * Refreshes on pull-to-refresh (query invalidation) and every 2 minutes.
 */
export function useHotTopics(limit = 10) {
  return useQuery({
    queryKey: ['hot-topics', limit],
    queryFn: async (): Promise<HotTopic[]> => {
      const since = new Date(Date.now() - WINDOW_MS).toISOString();

      const { data: votes } = await supabase
        .from('votes')
        .select('poll_id')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(3000);

      const counts = new Map<string, number>();
      for (const v of (votes || []) as { poll_id: string }[]) {
        counts.set(v.poll_id, (counts.get(v.poll_id) || 0) + 1);
      }

      const topIds = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit * 3)
        .map(([id]) => id);

      if (topIds.length === 0) return [];

      const { data: polls } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, image_a_url, image_b_url, category, ends_at')
        .in('id', topIds)
        .eq('is_active', true);

      const nowMs = Date.now();

      return (polls || [])
        .filter((p: any) => !p.ends_at || new Date(p.ends_at).getTime() > nowMs)
        .map((p: any) => ({
          id: p.id,
          question: p.question,
          option_a: p.option_a,
          option_b: p.option_b,
          image_a_url: p.image_a_url,
          image_b_url: p.image_b_url,
          category: p.category,
          recentVotes: counts.get(p.id) || 0,
        }))
        .sort((a, b) => b.recentVotes - a.recentVotes)
        .slice(0, limit);
    },
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 2,
  });
}
