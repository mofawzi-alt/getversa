import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Returns the total number of votes cast across ALL polls in the last hour.
 * Refreshes every 60s. Used by the live voter count strip below the hero card.
 */
export function useLiveVoterCount() {
  return useQuery({
    queryKey: ['live-voter-count-1h'],
    queryFn: async () => {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count, error } = await supabase
        .from('votes')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', since);
      if (error) {
        console.error('useLiveVoterCount error:', error);
        return 0;
      }
      return count || 0;
    },
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 60,
  });
}
