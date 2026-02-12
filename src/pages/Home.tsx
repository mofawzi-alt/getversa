import AppLayout from '@/components/layout/AppLayout';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowRight, Flame, Users, Zap } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Check if unseen polls exist
  const { data: unseenCount, isLoading: loadingUnseen } = useQuery({
    queryKey: ['unseen-poll-count', user?.id],
    queryFn: async () => {
      const { data: polls } = await supabase
        .from('polls')
        .select('id')
        .eq('is_active', true);

      if (!polls || !user) return polls?.length || 0;

      const { data: votes } = await supabase
        .from('votes')
        .select('poll_id')
        .eq('user_id', user.id);

      const votedIds = new Set(votes?.map(v => v.poll_id) || []);
      return polls.filter(p => !votedIds.has(p.id)).length;
    },
    staleTime: 1000 * 60 * 2,
  });

  // Fetch trending polls with results
  const { data: trendingPolls, isLoading: loadingTrending } = useQuery({
    queryKey: ['trending-polls-home', user?.id],
    queryFn: async () => {
      const { data: polls } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, category, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(30);

      if (!polls || polls.length === 0) return [];

      const pollIds = polls.map(p => p.id);
      const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: pollIds });

      const resultsMap = new Map(
        results?.map((r: any) => [r.poll_id, r]) || []
      );

      return polls
        .map(p => {
          const r = resultsMap.get(p.id);
          return {
            id: p.id,
            question: p.question,
            option_a: p.option_a,
            option_b: p.option_b,
            category: p.category,
            totalVotes: (r?.total_votes as number) || 0,
            percentA: (r?.percent_a as number) || 0,
            percentB: (r?.percent_b as number) || 0,
          };
        })
        .filter(p => p.totalVotes > 0)
        .sort((a, b) => b.totalVotes - a.totalVotes)
        .slice(0, 3);
    },
    staleTime: 1000 * 60 * 5,
  });

  // User stats
  const { data: userStats } = useQuery({
    queryKey: ['user-home-stats', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('users')
        .select('points, current_streak, total_days_active')
        .eq('id', user.id)
        .single();
      return data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const isLoading = loadingUnseen || loadingTrending;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const hasUnseen = (unseenCount || 0) > 0;

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col p-4 pb-24 gap-4">
        {/* Header */}
        <header>
          <h1 className="text-2xl font-display font-bold text-gradient">VERSA</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Your perspective matters</p>
        </header>

        {/* Continue Voting CTA */}
        {hasUnseen && (
          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => navigate('/vote')}
            className="relative w-full rounded-2xl bg-gradient-primary p-5 text-left overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-primary/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary-foreground" />
                  <span className="text-sm font-bold text-primary-foreground">
                    {unseenCount} new {unseenCount === 1 ? 'perspective' : 'perspectives'} waiting
                  </span>
                </div>
                <p className="text-xs text-primary-foreground/70">
                  Continue shaping your dimensions
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-primary-foreground shrink-0" />
            </div>
          </motion.button>
        )}

        {/* Quick stats row */}
        {userStats && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Points', value: userStats.points || 0 },
              { label: 'Streak', value: `${userStats.current_streak || 0}🔥` },
              { label: 'Days Active', value: userStats.total_days_active || 0 },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl bg-card border border-border p-3 text-center"
              >
                <p className="text-base font-bold text-foreground">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        )}

        {/* Trending Live Polls */}
        {trendingPolls && trendingPolls.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-destructive" />
              <h2 className="text-sm font-display font-bold text-foreground">Live Trends</h2>
            </div>

            <div className="space-y-2.5">
              {trendingPolls.map((poll, i) => {
                const winnerIsA = poll.percentA >= poll.percentB;
                return (
                  <motion.div
                    key={poll.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.06 }}
                    onClick={() => navigate('/vote')}
                    className="rounded-2xl bg-card border border-border p-4 space-y-2.5 cursor-pointer active:scale-[0.98] transition-transform"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold leading-snug text-foreground flex-1">
                        {poll.question}
                      </p>
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap shrink-0 pt-0.5">
                        <Users className="h-3 w-3" />
                        {poll.totalVotes.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex h-1.5 rounded-full overflow-hidden bg-muted/50">
                      <div
                        className="bg-option-a rounded-l-full transition-all duration-500"
                        style={{ width: `${poll.percentA}%` }}
                      />
                      <div
                        className="bg-option-b rounded-r-full transition-all duration-500"
                        style={{ width: `${poll.percentB}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-[11px]">
                      <span className={winnerIsA ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                        {poll.option_a} ({poll.percentA}%)
                      </span>
                      <span className={!winnerIsA ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                        {poll.option_b} ({poll.percentB}%)
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* Explore CTA at bottom */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          onClick={() => navigate('/vote')}
          className="w-full mt-2 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
        >
          <Zap className="h-4 w-4" />
          {hasUnseen ? 'Start Voting' : 'Explore Perspectives'}
        </motion.button>
      </div>
    </AppLayout>
  );
}
