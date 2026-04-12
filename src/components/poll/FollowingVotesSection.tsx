import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { UserCheck, Heart, UserPlus } from 'lucide-react';
import { useFollows } from '@/hooks/useFollows';

interface FollowingVotesSectionProps {
  pollId: string;
  userChoice: 'A' | 'B';
  optionA: string;
  optionB: string;
}

interface FollowingVote {
  user_id: string;
  username: string | null;
  choice: string;
}

export default function FollowingVotesSection({
  pollId,
  userChoice,
  optionA,
  optionB,
}: FollowingVotesSectionProps) {
  const { user } = useAuth();
  const { isFollowing, toggleFollow } = useFollows();

  const { data: followingVotes = [], isLoading } = useQuery({
    queryKey: ['following-votes', pollId, user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data: follows, error: followsError } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      if (followsError || !follows?.length) return [];

      const followingIds = follows.map(f => f.following_id);

      const { data: votes, error: votesError } = await supabase
        .from('votes')
        .select('user_id, choice')
        .eq('poll_id', pollId)
        .in('user_id', followingIds);

      if (votesError || !votes?.length) return [];

      const voterIds = votes.map(v => v.user_id);
      const { data: profiles } = await supabase.rpc('get_public_profiles', {
        user_ids: voterIds,
      });

      const profileMap = new Map(
        profiles?.map((p: any) => [p.id, p.username]) || []
      );

      return votes.map(v => ({
        user_id: v.user_id,
        username: profileMap.get(v.user_id) || null,
        choice: v.choice,
      })) as FollowingVote[];
    },
    enabled: !!user,
    staleTime: 1000 * 60,
  });

  // Also fetch other voters on this poll who the user doesn't follow (for discovery)
  const { data: otherVoters = [] } = useQuery({
    queryKey: ['other-voters', pollId, user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data: votes } = await supabase
        .from('votes')
        .select('user_id, choice')
        .eq('poll_id', pollId)
        .neq('user_id', user.id)
        .limit(10);

      if (!votes?.length) return [];

      const voterIds = votes.map(v => v.user_id);
      const { data: profiles } = await supabase.rpc('get_public_profiles', {
        user_ids: voterIds,
      });

      const profileMap = new Map(
        profiles?.map((p: any) => [p.id, p.username]) || []
      );

      return votes
        .filter(v => profileMap.get(v.user_id))
        .map(v => ({
          user_id: v.user_id,
          username: profileMap.get(v.user_id) || null,
          choice: v.choice,
        })) as FollowingVote[];
    },
    enabled: !!user && followingVotes.length === 0,
    staleTime: 1000 * 60,
  });

  if (!user || isLoading) return null;

  const agreeing = followingVotes.filter(v => v.choice === userChoice);
  const disagreeing = followingVotes.filter(v => v.choice !== userChoice);

  // Show other voters to follow if no following votes
  const showDiscovery = followingVotes.length === 0 && otherVoters.length > 0;
  const sameChoiceVoters = otherVoters.filter(v => v.choice === userChoice && !isFollowing(v.user_id));

  if (followingVotes.length === 0 && !showDiscovery) return null;

  return (
    <div className="mt-3 p-3 rounded-xl bg-secondary/50 border border-border/40">
      {followingVotes.length > 0 ? (
        <>
          <div className="flex items-center gap-2 mb-2">
            <UserCheck className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-bold text-foreground">
              People you follow voted
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {followingVotes.slice(0, 8).map(fv => (
              <div
                key={fv.user_id}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium ${
                  fv.choice === userChoice
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-[8px] font-bold text-primary">
                    {fv.username?.[0]?.toUpperCase() || '?'}
                  </span>
                </div>
                <span className="truncate max-w-[60px]">
                  @{fv.username || 'user'}
                </span>
                {fv.choice === userChoice && (
                  <Heart className="h-2.5 w-2.5 fill-current" />
                )}
              </div>
            ))}
          </div>

          {agreeing.length > 0 && (
            <p className="text-[10px] text-muted-foreground mt-2">
              <span className="font-bold text-primary">{agreeing.length}</span>{' '}
              {agreeing.length === 1 ? 'person' : 'people'} you follow agree with you
              {disagreeing.length > 0 && (
                <>
                  {' · '}
                  <span className="font-bold">{disagreeing.length}</span> chose the other side
                </>
              )}
            </p>
          )}
        </>
      ) : showDiscovery && sameChoiceVoters.length > 0 ? (
        <>
          <div className="flex items-center gap-2 mb-2">
            <UserPlus className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-bold text-foreground">
              People who agree with you
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {sameChoiceVoters.slice(0, 5).map(v => (
              <button
                key={v.user_id}
                onClick={() => toggleFollow(v.user_id)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-[8px] font-bold">
                    {v.username?.[0]?.toUpperCase() || '?'}
                  </span>
                </div>
                <span className="truncate max-w-[50px]">@{v.username || 'user'}</span>
                <UserPlus className="h-2.5 w-2.5" />
              </button>
            ))}
          </div>

          <p className="text-[10px] text-muted-foreground mt-2">
            Tap to follow and see their votes on future polls
          </p>
        </>
      ) : null}
    </div>
  );
}