import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Radio, Users, ChevronRight } from 'lucide-react';

type LivePoll = {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  image_a_url: string | null;
  image_b_url: string | null;
  category: string | null;
  totalVotes: number;
  percentA: number;
  percentB: number;
};

export default function LivePollSection({ votedPollIds }: { votedPollIds?: Set<string> }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: livePolls } = useQuery({
    queryKey: ['live-polls-home'],
    queryFn: async () => {
      const { data: polls } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, image_a_url, image_b_url, category')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(20);
      if (!polls || polls.length === 0) return [];
      const pollIds = polls.map(p => p.id);
      const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: pollIds });
      const resultsMap = new Map(results?.map((r: any) => [r.poll_id, r]) || []);
      return polls.map(p => {
        const r = resultsMap.get(p.id) as any;
        const total = (r?.total_votes as number) || 0;
        const votesA = (r?.votes_a as number) || 0;
        const pctA = total > 0 ? Math.round((votesA / total) * 100) : 50;
        return { ...p, totalVotes: total, percentA: pctA, percentB: 100 - pctA } as LivePoll;
      }).filter(p => p.totalVotes > 0);
    },
    refetchInterval: 15000, // Auto-refresh every 15s for live feel
    staleTime: 1000 * 10,
  });

  // Realtime subscription for instant updates
  useEffect(() => {
    const channel = supabase
      .channel('live-poll-votes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'votes' }, () => {
        queryClient.invalidateQueries({ queryKey: ['live-polls-home'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  if (!livePolls || livePolls.length === 0) return null;

  // Show top 3 polls with most votes as "live"
  const featured = [...livePolls].sort((a, b) => b.totalVotes - a.totalVotes).slice(0, 3);

  return (
    <section className="mb-2">
      <div className="px-3 flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <Radio className="h-3.5 w-3.5 text-destructive" />
          </motion.div>
          <span className="text-[10px] font-display font-bold text-destructive uppercase tracking-wider">Live Results</span>
        </div>
        <button onClick={() => navigate('/vote')} className="text-[10px] text-primary font-semibold flex items-center gap-0.5">
          Vote <ChevronRight className="h-3 w-3" />
        </button>
      </div>
      <div className="px-3 space-y-2">
        {featured.map((poll, i) => {
          const hasVoted = votedPollIds?.has(poll.id);
          return (
            <motion.div
              key={poll.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => hasVoted ? undefined : navigate(`/vote?pollId=${poll.id}`)}
              className={`rounded-xl bg-card/80 backdrop-blur-sm border border-border/50 p-3 ${!hasVoted ? 'cursor-pointer' : ''}`}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-xs font-bold text-foreground leading-tight flex-1 pr-2">{poll.question}</h3>
                <span className="text-[9px] text-muted-foreground flex items-center gap-0.5 shrink-0">
                  <Users className="h-2.5 w-2.5" /> {poll.totalVotes}
                </span>
              </div>

              {/* Option A bar */}
              <div className="mb-1.5">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] font-semibold text-foreground truncate max-w-[60%]">{poll.option_a}</span>
                  <span className="text-[10px] font-bold text-primary">{poll.percentA}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${poll.percentA}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
              </div>

              {/* Option B bar */}
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] font-semibold text-foreground truncate max-w-[60%]">{poll.option_b}</span>
                  <span className="text-[10px] font-bold text-accent">{poll.percentB}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-accent"
                    initial={{ width: 0 }}
                    animate={{ width: `${poll.percentB}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                  />
                </div>
              </div>

              {!hasVoted && (
                <p className="text-[9px] text-primary font-semibold mt-1.5">Tap to vote →</p>
              )}
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
