import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Flame, Crown, TrendingUp, Clock, Compass, Zap, ArrowRight } from 'lucide-react';
import { getPollDisplayImageSrc, handlePollImageError } from '@/lib/pollImages';
import { Button } from '@/components/ui/button';

export default function HeroCaughtUp() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  // Today's vote count
  const { data: todayVotes } = useQuery({
    queryKey: ['today-votes', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count } = await supabase.from('votes').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).gte('created_at', todayStart.toISOString());
      return count || 0;
    },
    staleTime: 1000 * 60,
    enabled: !!user,
  });

  // User streak
  const { data: streak } = useQuery({
    queryKey: ['caught-up-streak', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data } = await supabase.from('users').select('current_streak').eq('id', user.id).single();
      return data?.current_streak || 0;
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!user,
  });

  // Minority votes today
  const { data: minorityCount } = useQuery({
    queryKey: ['minority-votes', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data: myVotes } = await supabase.from('votes').select('poll_id, choice')
        .eq('user_id', user.id).gte('created_at', todayStart.toISOString()).limit(100);
      if (!myVotes || myVotes.length === 0) return 0;
      const pollIds = myVotes.map(v => v.poll_id);
      const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: pollIds });
      if (!results) return 0;
      const resultsMap = new Map(results.map((r: any) => [r.poll_id, r]));
      let count = 0;
      myVotes.forEach(v => {
        const r = resultsMap.get(v.poll_id) as any;
        if (!r) return;
        const myPct = v.choice === 'A' ? r.percent_a : r.percent_b;
        if (myPct < 50) count++;
      });
      return count;
    },
    staleTime: 1000 * 60 * 2,
    enabled: !!user,
  });

  // Trending polls user already voted on
  const { data: trendingVoted } = useQuery({
    queryKey: ['trending-voted', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const fiveMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: recentVotes } = await supabase.from('votes').select('poll_id')
        .gte('created_at', fiveMinAgo).limit(500);
      if (!recentVotes) return [];
      // Count votes per poll
      const pollCounts = new Map<string, number>();
      recentVotes.forEach(v => pollCounts.set(v.poll_id, (pollCounts.get(v.poll_id) || 0) + 1));
      // Get user's voted polls
      const { data: userVotes } = await supabase.from('votes').select('poll_id')
        .eq('user_id', user.id).limit(500);
      const userVotedSet = new Set(userVotes?.map(v => v.poll_id) || []);
      // Intersection: trending + user voted
      const trending = Array.from(pollCounts.entries())
        .filter(([pid]) => userVotedSet.has(pid))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([pid, count]) => ({ poll_id: pid, recentVotes: count }));
      if (trending.length === 0) return [];
      const pollIds = trending.map(t => t.poll_id);
      const { data: polls } = await supabase.from('polls')
        .select('id, question, option_a, option_b, image_a_url, image_b_url')
        .in('id', pollIds);
      const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: pollIds });
      const resultsMap = new Map((results || []).map((r: any) => [r.poll_id, r]));
      return trending.map(t => {
        const p = polls?.find(p => p.id === t.poll_id);
        const r = resultsMap.get(t.poll_id) as any;
        if (!p) return null;
        return {
          ...p,
          recentVotes: t.recentVotes,
          percentA: r?.percent_a || 50,
          percentB: r?.percent_b || 50,
          totalVotes: Number(r?.total_votes || 0),
        };
      }).filter(Boolean) as any[];
    },
    staleTime: 1000 * 60,
    enabled: !!user,
  });

  // Countdown to tomorrow 9am
  const [countdown, setCountdown] = useState('');
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const tomorrow9am = new Date(now);
      tomorrow9am.setDate(tomorrow9am.getDate() + (now.getHours() >= 9 ? 1 : 0));
      tomorrow9am.setHours(9, 0, 0, 0);
      const diff = tomorrow9am.getTime() - now.getTime();
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setCountdown(`${h}h ${m}m`);
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, []);

  const votes = todayVotes || 0;
  const isTop = votes >= 100;

  return (
    <section className="px-3 pt-4 pb-2 space-y-3">
      {/* 1. CELEBRATION */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl bg-gradient-to-br from-primary/15 via-accent/10 to-primary/5 border border-primary/25 p-5 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.1 }}
          className="text-4xl mb-2"
        >
          {isTop ? '👑' : '🔥'}
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-lg font-display font-bold text-foreground"
        >
          {isTop
            ? "Top 1% voter on Versa today"
            : "You're one of Versa's most active voters today"}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="text-xs text-muted-foreground mt-1"
        >
          All polls completed — you're ahead of the crowd
        </motion.p>
      </motion.div>

      {/* 2. LIVE STATS */}
      {user && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-3 gap-2"
        >
          <div className="bg-card rounded-xl border border-border/60 px-3 py-2.5 text-center">
            <Flame className="h-4 w-4 text-destructive mx-auto mb-1" />
            <p className="text-lg font-display font-bold text-foreground">{streak || 0}</p>
            <p className="text-[9px] text-muted-foreground font-medium">Day Streak</p>
          </div>
          <div className="bg-card rounded-xl border border-border/60 px-3 py-2.5 text-center">
            <Zap className="h-4 w-4 text-primary mx-auto mb-1" />
            <p className="text-lg font-display font-bold text-foreground">{votes}</p>
            <p className="text-[9px] text-muted-foreground font-medium">Voted Today</p>
          </div>
          <div className="bg-card rounded-xl border border-border/60 px-3 py-2.5 text-center">
            <Crown className="h-4 w-4 text-warning mx-auto mb-1" />
            <p className="text-lg font-display font-bold text-foreground">{minorityCount || 0}</p>
            <p className="text-[9px] text-muted-foreground font-medium">Against Majority</p>
          </div>
        </motion.div>
      )}

      {/* 3. TRENDING RIGHT NOW */}
      {trendingVoted && trendingVoted.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wider">
              Trending now — see how results shifted
            </span>
          </div>
          <div className="space-y-2">
            {trendingVoted.map((poll: any, i: number) => {
              const imgA = getPollDisplayImageSrc({ imageUrl: poll.image_a_url, option: poll.option_a, question: poll.question, side: 'A' });
              const winner = poll.percentA >= poll.percentB ? 'A' : 'B';
              return (
                <motion.div
                  key={poll.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.08 }}
                  onClick={() => navigate(`/browse`)}
                  className="flex items-center gap-3 bg-card rounded-xl border border-border/60 p-2.5 cursor-pointer hover:bg-accent/5 transition-colors"
                >
                  <img
                    src={imgA}
                    alt={poll.option_a}
                    className="w-10 h-10 rounded-lg object-cover bg-muted shrink-0"
                    onError={(e) => handlePollImageError(e, { option: poll.option_a, question: poll.question, side: 'A' })}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{poll.question}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {winner === 'A' ? poll.option_a : poll.option_b} leads {Math.max(poll.percentA, poll.percentB)}% · {poll.recentVotes} new votes
                    </p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* 4. WHAT'S COMING */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        className="rounded-xl bg-card border border-border/60 p-3 flex items-center gap-3"
      >
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Clock className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-display font-bold text-foreground">New battles drop tomorrow at 9am 👀</p>
          <p className="text-[10px] text-muted-foreground">Countdown: {countdown}</p>
        </div>
      </motion.div>

      {/* 5. BROWSE PROMPT */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65 }}
      >
        <Button
          onClick={() => navigate('/browse')}
          className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-display font-bold rounded-xl"
        >
          <Compass className="mr-2 h-4 w-4" />
          Explore all results in Browse
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </motion.div>
    </section>
  );
}