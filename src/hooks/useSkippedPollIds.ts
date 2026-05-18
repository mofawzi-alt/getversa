import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Returns the set of poll IDs the current user (or guest) has skipped.
 * Skipped polls should not be re-shown in any feed.
 */
export function useSkippedPollIds() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-skipped-ids', user?.id],
    queryFn: async () => {
      if (!user) {
        try {
          const stored = localStorage.getItem('versa_guest_skipped_polls');
          return new Set<string>(stored ? JSON.parse(stored) : []);
        } catch {
          return new Set<string>();
        }
      }
      const all = new Set<string>();
      const PAGE = 1000;
      let from = 0;
      for (let i = 0; i < 50; i++) {
        const { data, error } = await supabase
          .from('skipped_polls')
          .select('poll_id')
          .eq('user_id', user.id)
          .range(from, from + PAGE - 1);
        if (error) break;
        if (!data || data.length === 0) break;
        data.forEach((r: any) => all.add(r.poll_id));
        if (data.length < PAGE) break;
        from += PAGE;
      }
      return all;
    },
    staleTime: 1000 * 30,
  });
}
