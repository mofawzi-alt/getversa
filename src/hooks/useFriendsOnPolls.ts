import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type FriendOnPoll = {
  friendId: string;
  friendName: string;
  friendAvatarUrl: string | null;
  choice: 'A' | 'B';
};

/**
 * Batched: returns a Map<pollId, FriendOnPoll[]> for ALL the user's friends
 * who voted on ANY of the given pollIds. One DB roundtrip per Live Debates feed.
 * Reused for the Live Debates avatar stack.
 */
export function useFriendsOnPolls(pollIds: string[] | undefined) {
  const { user } = useAuth();
  // Only check first 20 polls to limit query size
  const limitedPollIds = (pollIds || []).slice(0, 20);
  const key = limitedPollIds.slice().sort().join(',');
  return useQuery({
    queryKey: ['friends-on-polls', user?.id, key],
    enabled: !!user && limitedPollIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Record<string, FriendOnPoll[]>> => {
      if (!user || limitedPollIds.length === 0) return {};

      // 1) friend ids
      const { data: friendships } = await supabase
        .from('friendships')
        .select('requester_id, recipient_id')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`);
      const friendIds = (friendships || []).map((f: any) =>
        f.requester_id === user.id ? f.recipient_id : f.requester_id
      );
      if (!friendIds.length) return {};

      // 2) all their votes on the visible polls
      const { data: votes } = await supabase
        .from('votes')
        .select('user_id, poll_id, choice, created_at')
        .in('user_id', friendIds)
        .in('poll_id', limitedPollIds)
        .order('created_at', { ascending: false });
      if (!votes?.length) return {};

      // 3) profiles
      const userIds = Array.from(new Set(votes.map((v: any) => v.user_id)));
      const { data: profiles } = await supabase
        .from('users')
        .select('id, name, avatar_url')
        .in('id', userIds);
      const profileMap = new Map(
        (profiles || []).map((p: any) => [p.id, { name: p.name || 'Friend', avatar_url: p.avatar_url }])
      );

      // 4) group by poll
      const out: Record<string, FriendOnPoll[]> = {};
      for (const v of votes as any[]) {
        const prof = profileMap.get(v.user_id);
        const list = out[v.poll_id] || (out[v.poll_id] = []);
        // dedupe (one vote per friend per poll, but be safe)
        if (list.some((f) => f.friendId === v.user_id)) continue;
        list.push({
          friendId: v.user_id,
          friendName: prof?.name || 'Friend',
          friendAvatarUrl: prof?.avatar_url ?? null,
          choice: v.choice as 'A' | 'B',
        });
      }
      return out;
    },
  });
}
