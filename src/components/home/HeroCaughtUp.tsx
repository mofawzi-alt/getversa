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

function HighlightCard({ poll, index, onTap }: { poll: HighlightPoll; index: number; onTap?: (poll: HighlightPoll) => void }) {
  const winnerOption = poll.winner === 'A' ? poll.option_a : poll.option_b;
  const winnerPct = poll.winner === 'A' ? poll.percentA : poll.percentB;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 + index * 0.1 }}
      onClick={() => onTap?.(poll)}
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

  // Countdown to next batch drop (Cairo time: 9 AM, 1 PM, 5 PM)
  const BATCH_HOURS = [9, 14, 19];
  const [countdown, setCountdown] = useState('');
  useEffect(() => {
    const update = () => {
      const now = new Date();
      // Current time in Cairo
      const cairoNow = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
      const offset = now.getTime() - cairoNow.getTime();

      // Find next batch hour today, else first batch tomorrow
      const next = new Date(cairoNow);
      const nextHour = BATCH_HOURS.find(h => h > cairoNow.getHours() || (h === cairoNow.getHours() && cairoNow.getMinutes() === 0));
      if (nextHour !== undefined) {
        next.setHours(nextHour, 0, 0, 0);
      } else {
        next.setDate(next.getDate() + 1);
        next.setHours(BATCH_HOURS[0], 0, 0, 0);
      }
      // Convert back to local clock for diff
      const diff = (next.getTime() + offset) - now.getTime();
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setCountdown(h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, []);

  const streak = userStats?.streak ?? 0;
  const todayVotes = userStats?.todayVotes ?? 0;
  const earnedToday = todayVotes * 10;

  // Celebration message based on today's volume
  const celebration =
    todayVotes >= 20 ? { emoji: '🏆', title: 'Legendary day!' } :
    todayVotes >= 10 ? { emoji: '🔥', title: 'On fire today!' } :
    todayVotes >= 5  ? { emoji: '⚡', title: 'Solid run!' } :
                       { emoji: '✨', title: 'All caught up!' };

  return (
    <section className="px-3 pt-2 pb-1">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18 }}
        className="rounded-2xl bg-gradient-to-br from-primary/15 via-accent/10 to-primary/5 border border-primary/30 px-3 py-3 text-center shadow-sm"
      >
        <div className="flex items-center justify-center gap-2">
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1, rotate: [0, -10, 10, 0] }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 14 }}
            className="text-2xl"
          >
            {celebration.emoji}
          </motion.span>
          <h2 className="text-base font-display font-bold text-foreground leading-tight">
            {celebration.title}
          </h2>
        </div>

        {user && (
          <div className="flex items-center justify-center gap-3 mt-2 text-[11px] text-foreground/80 font-semibold">
            <span>🔥 {streak}</span>
            <span className="text-muted-foreground/40">·</span>
            <span>⚡ {todayVotes} today</span>
            <span className="text-muted-foreground/40">·</span>
            <span>+{earnedToday} pts</span>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground mt-1.5">
          Next drop in <span className="font-bold text-foreground">{countdown}</span>
        </p>
      </motion.div>
    </section>
  );
}
