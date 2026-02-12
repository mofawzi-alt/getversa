import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowRight, Flame, Sparkles, TrendingUp, Users, Zap, Clock, TrendingUp as TrendUp } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

import beachImg from '@/assets/polls/beach.jpg';
import cityImg from '@/assets/polls/city.jpg';
import mountainsImg from '@/assets/polls/mountains.jpg';
import natureImg from '@/assets/polls/nature.jpg';
import sunsetImg from '@/assets/polls/sunset.jpg';
import sunriseImg from '@/assets/polls/sunrise.jpg';
import coffeeImg from '@/assets/polls/coffee.jpg';
import teaImg from '@/assets/polls/tea.jpg';
import pizzaImg from '@/assets/polls/pizza.jpg';
import sushiImg from '@/assets/polls/sushi.jpg';
import catsImg from '@/assets/polls/cats.jpg';
import dogsImg from '@/assets/polls/dogs.jpg';
import summerImg from '@/assets/polls/summer.jpg';
import winterImg from '@/assets/polls/winter.jpg';
import sneakersImg from '@/assets/polls/sneakers.jpg';
import bootsImg from '@/assets/polls/boots.jpg';
import booksImg from '@/assets/polls/books.jpg';
import moviesImg from '@/assets/polls/movies.jpg';
import daySkyImg from '@/assets/polls/day-sky.jpg';
import nightSkyImg from '@/assets/polls/night-sky.jpg';

const FALLBACK_IMAGES = [
  beachImg, cityImg, mountainsImg, natureImg, sunsetImg, sunriseImg,
  coffeeImg, teaImg, pizzaImg, sushiImg, catsImg, dogsImg,
  summerImg, winterImg, sneakersImg, bootsImg, booksImg, moviesImg,
  daySkyImg, nightSkyImg,
];

function getFallbackImage(seed: string, index: number): string {
  const hash = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return FALLBACK_IMAGES[(hash + index) % FALLBACK_IMAGES.length];
}

type PollCard = {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  image_a_url: string | null;
  image_b_url: string | null;
  category: string | null;
  created_at: string;
  totalVotes: number;
  percentA: number;
  percentB: number;
  votesA: number;
  votesB: number;
  tag: 'trending' | 'fresh' | 'popular';
};

const tagConfig = {
  trending: { icon: Flame, label: 'TRENDING', color: 'text-destructive', bg: 'bg-destructive/15', pulse: true },
  fresh: { icon: Sparkles, label: 'NEW', color: 'text-accent', bg: 'bg-accent/15', pulse: false },
  popular: { icon: TrendingUp, label: 'POPULAR', color: 'text-primary', bg: 'bg-primary/15', pulse: false },
};

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: votedPollIds } = useQuery({
    queryKey: ['user-voted-ids', user?.id],
    queryFn: async () => {
      if (!user) return new Set<string>();
      const { data: votes } = await supabase
        .from('votes')
        .select('poll_id')
        .eq('user_id', user.id);
      return new Set(votes?.map(v => v.poll_id) || []);
    },
    staleTime: 1000 * 60 * 2,
  });

  const { data: unseenCount } = useQuery({
    queryKey: ['unseen-poll-count', user?.id],
    queryFn: async () => {
      const { data: polls } = await supabase.from('polls').select('id').eq('is_active', true);
      if (!polls || !user) return polls?.length || 0;
      const { data: votes } = await supabase.from('votes').select('poll_id').eq('user_id', user.id);
      const voted = new Set(votes?.map(v => v.poll_id) || []);
      return polls.filter(p => !voted.has(p.id)).length;
    },
    staleTime: 1000 * 60 * 2,
  });

  const { data: polls, isLoading } = useQuery({
    queryKey: ['visual-feed-home'],
    queryFn: async () => {
      const { data: rawPolls } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, image_a_url, image_b_url, category, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!rawPolls || rawPolls.length === 0) return [];
      const pollIds = rawPolls.map(p => p.id);
      const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: pollIds });
      const resultsMap = new Map(results?.map((r: any) => [r.poll_id, r]) || []);
      const enriched = rawPolls.map(p => {
        const r = resultsMap.get(p.id) as any;
        const total = (r?.total_votes as number) || 0;
        const votesA = (r?.votes_a as number) || 0;
        const votesB = (r?.votes_b as number) || 0;
        const pctA = total > 0 ? Math.round((votesA / total) * 100) : 50;
        return { ...p, totalVotes: total, percentA: pctA, percentB: 100 - pctA, votesA, votesB };
      });
      // Distribute tags evenly by thirds: top third = trending, middle = popular, newest = fresh
      const byVotes = [...enriched].sort((a, b) => b.totalVotes - a.totalVotes);
      const third = Math.max(1, Math.ceil(byVotes.length / 3));
      const tagged: PollCard[] = byVotes.map((p, i) => ({
        ...p,
        tag: i < third ? 'trending' as const : i < third * 2 ? 'popular' as const : 'fresh' as const,
      }));
      // Interleave for visual variety
      const trending = tagged.filter(p => p.tag === 'trending');
      const popular = tagged.filter(p => p.tag === 'popular');
      const fresh = tagged.filter(p => p.tag === 'fresh');
      const result: PollCard[] = [];
      const maxLen = Math.max(trending.length, popular.length, fresh.length);
      for (let i = 0; i < maxLen; i++) {
        if (trending[i]) result.push(trending[i]);
        if (popular[i]) result.push(popular[i]);
        if (fresh[i]) result.push(fresh[i]);
      }
      return result.slice(0, 12);
    },
    staleTime: 1000 * 60 * 5,
  });

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

  const handlePollTap = (poll: PollCard) => {
    const hasVoted = votedPollIds?.has(poll.id);
    if (hasVoted) {
      navigate(`/vote?pollId=${poll.id}`);
    } else {
      navigate(`/vote?pollId=${poll.id}`);
    }
  };

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col pb-24">
        {/* Header */}
        <header className="px-5 pt-4 pb-2">
          <h1 className="text-3xl font-display font-bold text-gradient tracking-tight">VERSA</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5 tracking-widest uppercase">Where perspectives collide</p>
        </header>

        {/* Hero */}
        {hasUnseen ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-4 mt-2 mb-5 relative rounded-2xl bg-gradient-primary p-5 overflow-hidden"
          >
            <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-accent/10 blur-2xl" />
            <div className="relative space-y-3">
              <p className="text-xl font-display font-bold text-primary-foreground leading-tight">
                🔥 {unseenCount} hot {unseenCount === 1 ? 'debate' : 'debates'} waiting
              </p>
              <p className="text-xs text-primary-foreground/60">Your perspective matters.</p>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => navigate('/vote')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-foreground/15 backdrop-blur-sm text-primary-foreground font-display font-bold text-sm border border-primary-foreground/20"
              >
                <Zap className="h-4 w-4" /> Jump In <ArrowRight className="h-3.5 w-3.5" />
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mx-4 mt-2 mb-5 rounded-2xl bg-card border border-border/50 p-5 text-center"
          >
            <p className="text-base font-display font-bold text-foreground">✨ You're all caught up</p>
            <p className="text-xs text-muted-foreground mt-1">New debates drop regularly — check back soon.</p>
          </motion.div>
        )}

        {/* Visual Poll Feed */}
        <div className="px-4 space-y-4">
          {polls && polls.length > 0 ? (
            polls.map((poll, i) => {
              const hasVoted = votedPollIds?.has(poll.id);
              const imgA = poll.image_a_url || getFallbackImage(poll.id, 0);
              const imgB = poll.image_b_url || getFallbackImage(poll.id, 1);
              const winnerIsA = poll.percentA >= poll.percentB;
              const margin = Math.abs(poll.percentA - poll.percentB);
              const dateStr = poll.created_at ? format(new Date(poll.created_at), 'MMM d, yyyy') : '';
              const isActive = true; // all shown polls are active

              return (
                <motion.div
                  key={poll.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, type: 'spring', stiffness: 240, damping: 22 }}
                  onClick={() => handlePollTap(poll)}
                  className="relative rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform bg-card border border-border/40 p-4 space-y-3"
                >
                  {/* Title + Date */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-display font-bold text-foreground leading-snug">{poll.question}</h3>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0 mt-0.5">
                      <Clock className="h-3 w-3" />
                      {dateStr}
                    </span>
                  </div>

                  {/* Category + Status badges */}
                  <div className="flex items-center gap-2">
                    {poll.category && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/15 text-primary">
                        {poll.category}
                      </span>
                    )}
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-accent/15 text-accent">
                      Active
                    </span>
                  </div>

                  {/* Side-by-side images with results */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Option A */}
                    <div className={`relative rounded-xl overflow-hidden aspect-square ${winnerIsA ? 'ring-2 ring-primary/50' : ''}`}>
                      <img src={imgA} alt={poll.option_a} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      {winnerIsA && poll.totalVotes > 0 && (
                        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/90 text-primary-foreground text-[10px] font-bold">
                          <TrendUp className="h-3 w-3" /> Winner
                        </div>
                      )}
                      <div className="absolute bottom-2 left-2 right-2">
                        <p className="text-white text-xs font-bold drop-shadow-lg">{poll.option_a}</p>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-lg font-bold text-primary drop-shadow-lg">{poll.percentA}%</span>
                          <span className="text-[10px] text-white/70">({poll.votesA} votes)</span>
                        </div>
                      </div>
                    </div>

                    {/* Option B */}
                    <div className={`relative rounded-xl overflow-hidden aspect-square ${!winnerIsA ? 'ring-2 ring-accent/50' : ''}`}>
                      <img src={imgB} alt={poll.option_b} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      {!winnerIsA && poll.totalVotes > 0 && (
                        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/90 text-accent-foreground text-[10px] font-bold">
                          <TrendUp className="h-3 w-3" /> Winner
                        </div>
                      )}
                      <div className="absolute bottom-2 left-2 right-2">
                        <p className="text-white text-xs font-bold drop-shadow-lg">{poll.option_b}</p>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-lg font-bold text-accent drop-shadow-lg">{poll.percentB}%</span>
                          <span className="text-[10px] text-white/70">({poll.votesB} votes)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 text-center pt-1">
                    <div>
                      <p className="text-lg font-bold text-primary">{poll.totalVotes}</p>
                      <p className="text-[10px] text-muted-foreground font-medium">Total Votes</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-foreground">{margin}%</p>
                      <p className="text-[10px] text-muted-foreground font-medium">Margin</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-primary">1</p>
                      <p className="text-[10px] text-muted-foreground font-medium">Countries</p>
                    </div>
                  </div>

                  {hasVoted && (
                    <span className="absolute top-3 right-3 text-[9px] px-2 py-0.5 rounded-full bg-accent/20 text-accent font-bold z-10">✓ Voted</span>
                  )}
                </motion.div>
              );
            })
          ) : (
            <div className="text-center py-16 text-sm text-muted-foreground">
              No perspectives yet — check back soon.
            </div>
          )}
        </div>

        {/* Bottom CTA */}
        <div className="px-4 mt-6">
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            onClick={() => navigate('/vote')}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-primary text-primary-foreground font-display font-bold text-sm tracking-wide hover:bg-primary/90 transition-colors"
          >
            <Zap className="h-4 w-4" />
            {hasUnseen ? 'Start Voting' : 'Explore Perspectives'}
          </motion.button>
        </div>
      </div>
    </AppLayout>
  );
}
