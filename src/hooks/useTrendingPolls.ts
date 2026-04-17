import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const TRENDING_THRESHOLD = 100; // votes in the last 2 hours
const WINDOW_MS = 2 * 60 * 60 * 1000;

/**
 * Returns a Set of poll IDs that have received >100 votes in the last 2 hours.
 * Used by both the Trending badge and Closing Soon strip.
 */
export function useTrendingPolls(pollIds: string[]) {
  const idsKey = pollIds.slice().sort().join('|');

  return useQuery({
    queryKey: ['trending-pollIds', idsKey],
    queryFn: async () => {
      if (pollIds.length === 0) return new Set<string>();
      const since = new Date(Date.now() - WINDOW_MS).toISOString();
      const { data, error } = await supabase
        .from('votes')
        .select('poll_id')
        .in('poll_id', pollIds)
        .gte('created_at', since)
        .limit(10000);
      if (error) {
        console.error('useTrendingPolls error:', error);
        return new Set<string>();
      }
      const counts = new Map<string, number>();
      data?.forEach((v: any) => {
        counts.set(v.poll_id, (counts.get(v.poll_id) || 0) + 1);
      });
      const trending = new Set<string>();
      counts.forEach((count, id) => {
        if (count >= TRENDING_THRESHOLD) trending.add(id);
      });
      return trending;
    },
    enabled: pollIds.length > 0,
    staleTime: 1000 * 60 * 2, // recompute every 2 min
    refetchInterval: 1000 * 60 * 2,
  });
}
