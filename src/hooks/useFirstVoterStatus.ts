import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const FIRST_VOTER_LIMIT = 10;

/**
 * Returns whether the current user is among the first 10 voters on the given poll.
 * Used to show the "First Voter" badge on the result screen and profile.
 */
export function useFirstVoterStatus(pollId: string | null | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['first-voter-status', pollId, user?.id],
    queryFn: async () => {
      if (!pollId || !user) return false;
      const { data, error } = await supabase
        .from('votes')
        .select('user_id, created_at')
        .eq('poll_id', pollId)
        .order('created_at', { ascending: true })
        .limit(FIRST_VOTER_LIMIT);
      if (error) {
        console.error('useFirstVoterStatus error:', error);
        return false;
      }
      return (data || []).some(v => v.user_id === user.id);
    },
    enabled: !!pollId && !!user,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Bulk version: returns a Set of poll IDs where the user is among first 10 voters.
 * Used on the profile to surface badges across the user's vote history.
 */
export function useFirstVoterPolls(pollIds: string[]) {
  const { user } = useAuth();
  const idsKey = pollIds.slice().sort().join('|');
  return useQuery({
    queryKey: ['first-voter-polls', idsKey, user?.id],
    queryFn: async () => {
      if (!user || pollIds.length === 0) return new Set<string>();
      // Fetch first 10 voters per poll. We do it in one query and group client-side.
      const { data, error } = await supabase
        .from('votes')
        .select('poll_id, user_id, created_at')
        .in('poll_id', pollIds)
        .order('created_at', { ascending: true })
        .limit(10000);
      if (error) {
        console.error('useFirstVoterPolls error:', error);
        return new Set<string>();
      }
      // Group first 10 per poll
      const firstByPoll = new Map<string, Set<string>>();
      for (const row of (data || []) as any[]) {
        const set = firstByPoll.get(row.poll_id) || new Set<string>();
        if (set.size < FIRST_VOTER_LIMIT) {
          set.add(row.user_id);
          firstByPoll.set(row.poll_id, set);
        }
      }
      const userPolls = new Set<string>();
      firstByPoll.forEach((voters, pid) => {
        if (voters.has(user.id)) userPolls.add(pid);
      });
      return userPolls;
    },
    enabled: !!user && pollIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });
}
