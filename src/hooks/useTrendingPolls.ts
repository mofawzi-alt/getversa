import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const TRENDING_THRESHOLD = 100;
const WINDOW_MS = 2 * 60 * 60 * 1000;

/**
 * Returns a Set of poll IDs that have received >100 votes in the last 2 hours.
 * Only checks the first 20 poll IDs to keep the query lightweight.
 */
export function useTrendingPolls(pollIds: string[]) {
  // Only check the first 20 polls for trending status
  const checkIds = pollIds.slice(0, 20);
  const idsKey = checkIds.join('|');

  return useQuery({
    queryKey: ['trending-pollIds', idsKey],
    queryFn: async () => {
      if (checkIds.length === 0) return new Set<string>();
      const since = new Date(Date.now() - WINDOW_MS).toISOString();

      // Check each poll individually with count query (much lighter than fetching rows)
      const trending = new Set<string>();
      const checks = checkIds.map(async (pollId) => {
        const { count } = await supabase
          .from('votes')
          .select('*', { count: 'exact', head: true })
          .eq('poll_id', pollId)
          .gte('created_at', since);
        if ((count || 0) >= TRENDING_THRESHOLD) trending.add(pollId);
      });

      await Promise.all(checks);
      return trending;
    },
    enabled: checkIds.length > 0,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
  });
}
