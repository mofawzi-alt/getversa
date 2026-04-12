import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CelebrityVote {
  username: string;
  choice: 'A' | 'B';
  verified_category: string | null;
}

/**
 * Fetches verified public figure votes on a given poll.
 * Returns max 2, prioritising category match with the poll's category.
 */
export function useCelebrityVotes(pollId: string | undefined, pollCategory: string | null | undefined) {
  return useQuery<CelebrityVote[]>({
    queryKey: ['celebrity-votes', pollId],
    queryFn: async () => {
      if (!pollId) return [];

      // Get public votes (is_public_vote = true) on this poll, joined with user info
      const { data: publicVotes } = await supabase
        .from('votes')
        .select('choice, user_id')
        .eq('poll_id', pollId)
        .eq('is_public_vote', true);

      if (!publicVotes || publicVotes.length === 0) return [];

      const userIds = publicVotes.map(v => v.user_id);

      const { data: users } = await supabase
        .from('users')
        .select('id, username, verified_public_figure, verified_category')
        .in('id', userIds)
        .eq('verified_public_figure', true);

      if (!users || users.length === 0) return [];

      // Map user data to votes
      const userMap = new Map(users.map(u => [u.id, u]));
      let celebVotes: CelebrityVote[] = publicVotes
        .filter(v => userMap.has(v.user_id))
        .map(v => {
          const u = userMap.get(v.user_id)!;
          return {
            username: u.username || 'Verified User',
            choice: v.choice as 'A' | 'B',
            verified_category: u.verified_category,
          };
        });

      // Prioritise category match
      if (pollCategory && celebVotes.length > 2) {
        const matching = celebVotes.filter(c => c.verified_category === pollCategory);
        const nonMatching = celebVotes.filter(c => c.verified_category !== pollCategory);
        celebVotes = [...matching, ...nonMatching];
      }

      return celebVotes.slice(0, 2);
    },
    enabled: !!pollId,
    staleTime: 30000,
  });
}

/**
 * Just checks if any verified public figure voted on a poll (for card indicators).
 * Returns names only, no vote choices.
 */
export function useCelebrityPresence(pollIds: string[]) {
  return useQuery<Record<string, { username: string }[]>>({
    queryKey: ['celebrity-presence', pollIds.sort().join(',')],
    queryFn: async () => {
      if (pollIds.length === 0) return {};

      const { data: publicVotes } = await supabase
        .from('votes')
        .select('poll_id, user_id')
        .in('poll_id', pollIds)
        .eq('is_public_vote', true);

      if (!publicVotes || publicVotes.length === 0) return {};

      const userIds = [...new Set(publicVotes.map(v => v.user_id))];
      const { data: users } = await supabase
        .from('users')
        .select('id, username, verified_public_figure')
        .in('id', userIds)
        .eq('verified_public_figure', true);

      if (!users || users.length === 0) return {};

      const userMap = new Map(users.map(u => [u.id, u.username || 'Verified User']));
      const result: Record<string, { username: string }[]> = {};

      publicVotes.forEach(v => {
        const username = userMap.get(v.user_id);
        if (!username) return;
        if (!result[v.poll_id]) result[v.poll_id] = [];
        if (!result[v.poll_id].some(c => c.username === username)) {
          result[v.poll_id].push({ username });
        }
      });

      return result;
    },
    enabled: pollIds.length > 0,
    staleTime: 30000,
  });
}
