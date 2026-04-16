import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFollows } from '@/hooks/useFollows';
import { motion } from 'framer-motion';
import { getPollDisplayImageSrc } from '@/lib/pollImages';

interface FollowingFeedVote {
  user_id: string;
  username: string;
  poll_id: string;
  question: string;
  option_a: string;
  option_b: string;
  image_a_url: string | null;
  image_b_url: string | null;
  choice: string;
  voted_at: string;
}

export default function FollowingFeedSection() {
  const { user } = useAuth();
  const { following } = useFollows();
  const navigate = useNavigate();

  const { data: feedVotes = [], isLoading } = useQuery({
    queryKey: ['following-feed', user?.id, following.length],
    queryFn: async () => {
      if (!user || !following.length) return [];

      const twoDaysAgo = new Date();
      twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);

      const { data: votes, error } = await supabase
        .from('votes')
        .select('user_id, poll_id, choice, created_at')
        .in('user_id', following)
        .gte('created_at', twoDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(30);

      if (error || !votes?.length) return [];

      const voterIds = [...new Set(votes.map(v => v.user_id))];
      const { data: profiles } = await supabase.rpc('get_public_profiles', { user_ids: voterIds });
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.username]));

      const pollIds = [...new Set(votes.map(v => v.poll_id))];
      const { data: polls } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, image_a_url, image_b_url')
        .in('id', pollIds);

      const pollMap = new Map((polls || []).map(p => [p.id, p]));

      // Deduplicate by user (one story per friend, latest vote)
      const seenUsers = new Set<string>();
      const result: FollowingFeedVote[] = [];

      for (const v of votes) {
        if (seenUsers.has(v.user_id)) continue;
        const poll = pollMap.get(v.poll_id);
        if (!poll) continue;
        seenUsers.add(v.user_id);

        result.push({
          user_id: v.user_id,
          username: profileMap.get(v.user_id) || 'User',
          poll_id: v.poll_id,
          question: poll.question,
          option_a: poll.option_a,
          option_b: poll.option_b,
          image_a_url: poll.image_a_url,
          image_b_url: poll.image_b_url,
          choice: v.choice,
          voted_at: v.created_at || '',
        });
      }

      return result.slice(0, 15);
    },
    enabled: !!user && following.length > 0,
    staleTime: 1000 * 60 * 2,
  });

  if (!user || following.length === 0 || isLoading || feedVotes.length === 0) return null;

  return (
    <div className="flex gap-3 overflow-x-auto px-3 scrollbar-hide pb-2 mb-1">
      {feedVotes.map((fv, i) => {
        const chosenOption = fv.choice === 'A' ? fv.option_a : fv.option_b;
        const chosenImg = fv.choice === 'A' ? fv.image_a_url : fv.image_b_url;
        const resolvedImg = getPollDisplayImageSrc({
          imageUrl: chosenImg,
          option: chosenOption,
          question: fv.question,
          side: fv.choice as 'A' | 'B',
        });

        return (
          <motion.div
            key={`${fv.poll_id}-${fv.user_id}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="flex flex-col items-center gap-1 shrink-0 cursor-pointer"
            onClick={() => navigate(`/poll/${fv.poll_id}`)}
          >
            <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-primary via-primary/70 to-primary/40">
              <div className="w-full h-full rounded-full overflow-hidden border-2 border-background bg-muted">
                {resolvedImg ? (
                  <img src={resolvedImg} alt={chosenOption} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary/60">{fv.username[0]?.toUpperCase()}</span>
                  </div>
                )}
              </div>
            </div>
            <span className="text-[10px] font-medium text-foreground truncate max-w-[64px] text-center">
              @{fv.username}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
