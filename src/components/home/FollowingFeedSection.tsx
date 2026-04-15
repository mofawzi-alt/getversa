import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFollows } from '@/hooks/useFollows';
import { UserCheck, Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { getPollDisplayImageSrc } from '@/lib/pollImages';
import PollOptionImage from '@/components/poll/PollOptionImage';

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

  const { data: feedVotes = [], isLoading } = useQuery({
    queryKey: ['following-feed', user?.id, following.length],
    queryFn: async () => {
      if (!user || !following.length) return [];

      // Get recent votes from people we follow (last 48h)
      const twoDaysAgo = new Date();
      twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);

      const { data: votes, error } = await supabase
        .from('votes')
        .select('user_id, poll_id, choice, created_at')
        .in('user_id', following)
        .gte('created_at', twoDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(20);

      if (error || !votes?.length) return [];

      // Get profiles
      const voterIds = [...new Set(votes.map(v => v.user_id))];
      const { data: profiles } = await supabase.rpc('get_public_profiles', { user_ids: voterIds });
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.username]));

      // Get polls
      const pollIds = [...new Set(votes.map(v => v.poll_id))];
      const { data: polls } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, image_a_url, image_b_url')
        .in('id', pollIds);

      const pollMap = new Map((polls || []).map(p => [p.id, p]));

      // Deduplicate: one entry per poll (show latest voter)
      const seenPolls = new Set<string>();
      const result: FollowingFeedVote[] = [];

      for (const v of votes) {
        if (seenPolls.has(v.poll_id)) continue;
        seenPolls.add(v.poll_id);
        const poll = pollMap.get(v.poll_id);
        if (!poll) continue;

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

      return result.slice(0, 10);
    },
    enabled: !!user && following.length > 0,
    staleTime: 1000 * 60 * 2,
  });

  if (!user || following.length === 0 || isLoading || feedVotes.length === 0) return null;

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <section className="mb-3">
      <div className="px-3 flex items-center gap-2 mb-2">
        <UserCheck className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wider">
          Following Feed
        </span>
        <span className="text-[10px] text-muted-foreground">· {feedVotes.length} recent</span>
      </div>

      <div className="flex gap-3 overflow-x-auto px-3 scrollbar-hide pb-1 snap-x snap-mandatory">
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
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="shrink-0 w-36 snap-start"
            >
              <div className="rounded-xl overflow-hidden border border-border/60 bg-card shadow-sm">
                {/* Chosen option image */}
                <div className="relative aspect-square overflow-hidden">
                  {resolvedImg ? (
                    <img src={resolvedImg} alt={chosenOption} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                      <span className="text-2xl font-bold text-primary/30">{fv.choice}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-1.5 left-1.5 right-1.5">
                    <p className="text-white text-[9px] font-bold truncate drop-shadow-lg">{chosenOption}</p>
                  </div>
                </div>

                <div className="p-2 space-y-1">
                  {/* User + time */}
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-[7px] font-bold text-primary">{fv.username[0]?.toUpperCase()}</span>
                    </div>
                    <span className="text-[9px] font-semibold text-foreground truncate">@{fv.username}</span>
                    <span className="text-[8px] text-muted-foreground ml-auto shrink-0">{timeAgo(fv.voted_at)}</span>
                  </div>

                  {/* Poll question */}
                  <p className="text-[9px] text-muted-foreground line-clamp-2 leading-tight">{fv.question}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
