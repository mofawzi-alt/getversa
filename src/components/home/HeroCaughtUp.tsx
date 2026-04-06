import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, Flame, Zap, Target, TrendingUp, Crown, Clock, Compass, ArrowRight, Swords } from 'lucide-react';
import { getPollDisplayImageSrc, handlePollImageError } from '@/lib/pollImages';
import PollOptionImage from '@/components/poll/PollOptionImage';
import { Button } from '@/components/ui/button';

interface HighlightPoll {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  image_a_url: string | null;
  image_b_url: string | null;
  totalVotes: number;
  percentA: number;
  percentB: number;
  winner: 'A' | 'B';
  label: string;
  emoji: string;
}

function HighlightCard({ poll, index }: { poll: HighlightPoll; index: number }) {
  const navigate = useNavigate();
  const winnerOption = poll.winner === 'A' ? poll.option_a : poll.option_b;
  const winnerPct = poll.winner === 'A' ? poll.percentA : poll.percentB;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 + index * 0.1 }}
      onClick={() => navigate('/browse')}
      className="rounded-2xl border border-border/60 bg-card overflow-hidden cursor-pointer hover:border-primary/30 transition-colors"
    >
      {/* Images */}
      <div className="flex h-28 relative">
        <div className="w-1/2 h-full relative overflow-hidden">
          <PollOptionImage
            imageUrl={poll.image_a_url}
            option={poll.option_a}
            question={poll.question}
            side="A"
            maxLogoSize="60%"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          {poll.winner === 'A' && (
            <div className="absolute inset-0 border-2 border-green-500/50 pointer-events-none" />
          )}
          <div className="absolute bottom-1.5 left-2 right-1">
            <span className="text-white text-[10px] font-bold truncate block">{poll.option_a}</span>
            <span className={`text-xs font-display font-bold ${poll.winner === 'A' ? 'text-green-400' : 'text-white/60'}`}>
              {poll.percentA}%
            </span>
          </div>
        </div>
        <div className="absolute inset-y-0 left-1/2 w-[1px] bg-white/20 z-10" />
        <div className="w-1/2 h-full relative overflow-hidden">
          <PollOptionImage
            imageUrl={poll.image_b_url}
            option={poll.option_b}
            question={poll.question}
            side="B"
            maxLogoSize="60%"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          {poll.winner === 'B' && (
            <div className="absolute inset-0 border-2 border-green-500/50 pointer-events-none" />
          )}
          <div className="absolute bottom-1.5 left-2 right-1">
            <span className="text-white text-[10px] font-bold truncate block">{poll.option_b}</span>
            <span className={`text-xs font-display font-bold ${poll.winner === 'B' ? 'text-green-400' : 'text-white/60'}`}>
              {poll.percentB}%
            </span>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-xs">{poll.emoji}</span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-primary">{poll.label}</span>
        </div>
        <p className="text-xs font-bold text-foreground leading-tight line-clamp-2">{poll.question}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {winnerOption} won with {winnerPct}% · {poll.totalVotes.toLocaleString()} votes
        </p>
      </div>
    </motion.div>
  );
}

export default function HeroCaughtUp({ onPollTap }: { onPollTap?: (poll: any) => void }) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  // User stats
  const { data: userStats } = useQuery({
    queryKey: ['caught-up-stats', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from('users').select('current_streak, points').eq('id', user.id).single();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count } = await supabase.from('votes').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).gte('created_at', todayStart.toISOString());
      return {
        streak: data?.current_streak || 0,
        points: data?.points || 0,
        todayVotes: count || 0,
      };
    },
    staleTime: 1000 * 60,
    enabled: !!user,
  });

  // Highlight polls: yesterday's top, this week's most voted, closest battle
  const { data: highlights } = useQuery({
    queryKey: ['caught-up-highlights'],
    queryFn: async () => {
      const now = new Date();

      // Yesterday range
      const yesterdayEnd = new Date(now);
      yesterdayEnd.setHours(0, 0, 0, 0);
      const yesterdayStart = new Date(yesterdayEnd);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);

      // This week range
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - 7);

      // Get recent polls
      const { data: polls } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, image_a_url, image_b_url, created_at')
        .eq('is_active', true)
        .gte('created_at', weekStart.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      if (!polls || polls.length === 0) return [];

      const pollIds = polls.map(p => p.id);
      const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: pollIds });
      const resultsMap = new Map((results || []).map((r: any) => [r.poll_id, r]));

      const enriched = polls.map(p => {
        const r = resultsMap.get(p.id) as any;
        const total = Number(r?.total_votes || 0);
        const pctA = r?.percent_a || 50;
        const pctB = r?.percent_b || 50;
        return {
          ...p,
          totalVotes: total,
          percentA: pctA,
          percentB: pctB,
          winner: (pctA >= pctB ? 'A' : 'B') as 'A' | 'B',
        };
      }).filter(p => p.totalVotes >= 3);

      const highlights: HighlightPoll[] = [];
      const usedIds = new Set<string>();

      // 1. Yesterday's Top Battle (most votes from yesterday)
      const yesterdayPolls = enriched.filter(p => {
        const t = new Date(p.created_at).getTime();
        return t >= yesterdayStart.getTime() && t < yesterdayEnd.getTime();
      });
      const yesterdayTop = yesterdayPolls.sort((a, b) => b.totalVotes - a.totalVotes)[0];
      if (yesterdayTop) {
        usedIds.add(yesterdayTop.id);
        highlights.push({ ...yesterdayTop, label: "Yesterday's Top Battle", emoji: '🏆' });
      }

      // 2. This Week's Most Voted
      const weeklyTop = enriched
        .filter(p => !usedIds.has(p.id))
        .sort((a, b) => b.totalVotes - a.totalVotes)[0];
      if (weeklyTop) {
        usedIds.add(weeklyTop.id);
        highlights.push({ ...weeklyTop, label: 'Most Voted This Week', emoji: '🔥' });
      }

      // 3. Closest Battle (nearest to 50/50)
      const closest = enriched
        .filter(p => !usedIds.has(p.id) && p.totalVotes >= 5)
        .sort((a, b) => Math.abs(a.percentA - 50) - Math.abs(b.percentA - 50))[0];
      if (closest) {
        usedIds.add(closest.id);
        highlights.push({ ...closest, label: 'Closest Battle', emoji: '⚔️' });
      }

      // 4. Biggest Landslide
      const landslide = enriched
        .filter(p => !usedIds.has(p.id) && p.totalVotes >= 5)
        .sort((a, b) => Math.abs(b.percentA - 50) - Math.abs(a.percentA - 50))[0];
      if (landslide) {
        usedIds.add(landslide.id);
        highlights.push({ ...landslide, label: 'Biggest Landslide', emoji: '💥' });
      }

      return highlights;
    },
    staleTime: 1000 * 60 * 5,
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

  return (
    <section className="px-3 pt-4 pb-2 space-y-3">
      {/* Caught up banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl bg-gradient-to-br from-primary/15 via-accent/10 to-primary/5 border border-primary/25 p-4 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.1 }}
          className="text-3xl mb-1.5"
        >
          🔥
        </motion.div>
        <h2 className="text-base font-display font-bold text-foreground">All battles conquered 🔥</h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          New battles drop in {countdown} — here's what happened
        </p>
      </motion.div>

      {/* User stats row */}
      {user && userStats && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-3 gap-2"
        >
          <div className="bg-card rounded-xl border border-border/60 px-3 py-2.5 text-center">
            <Flame className="h-4 w-4 text-destructive mx-auto mb-1" />
            <p className="text-lg font-display font-bold text-foreground">{userStats.streak}</p>
            <p className="text-[9px] text-muted-foreground font-medium">Day Streak</p>
          </div>
          <div className="bg-card rounded-xl border border-border/60 px-3 py-2.5 text-center">
            <Zap className="h-4 w-4 text-primary mx-auto mb-1" />
            <p className="text-lg font-display font-bold text-foreground">{userStats.todayVotes}</p>
            <p className="text-[9px] text-muted-foreground font-medium">Voted Today</p>
          </div>
          <div className="bg-card rounded-xl border border-border/60 px-3 py-2.5 text-center">
            <Crown className="h-4 w-4 text-amber-500 mx-auto mb-1" />
            <p className="text-lg font-display font-bold text-foreground">{userStats.points.toLocaleString()}</p>
            <p className="text-[9px] text-muted-foreground font-medium">Total Points</p>
          </div>
        </motion.div>
      )}

      {/* Highlight polls */}
      {highlights && highlights.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wider">
              Battle Highlights
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {highlights.map((poll, i) => (
              <HighlightCard key={poll.id} poll={poll} index={i} />
            ))}
          </div>
        </motion.div>
      )}

      {/* Browse prompt */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Button
          onClick={() => navigate('/browse')}
          className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-display font-bold rounded-xl"
        >
          <Compass className="mr-2 h-4 w-4" />
          Explore all results
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </motion.div>
    </section>
  );
}
