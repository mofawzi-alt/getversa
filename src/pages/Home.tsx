import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowRight, Flame, Sparkles, TrendingUp, Users, Zap } from 'lucide-react';
import { Loader2 } from 'lucide-react';
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
  totalVotes: number;
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
        const r = resultsMap.get(p.id);
        return { ...p, totalVotes: (r?.total_votes as number) || 0 };
      });
      // Tag polls: top voted = trending, newest = fresh, rest with votes = popular
      const sorted = [...enriched].sort((a, b) => b.totalVotes - a.totalVotes);
      const trending = sorted.filter(p => p.totalVotes > 0).slice(0, 5).map(p => ({ ...p, tag: 'trending' as const }));
      const trendingIds = new Set(trending.map(p => p.id));
      const fresh = enriched.filter(p => !trendingIds.has(p.id)).slice(0, 4).map(p => ({ ...p, tag: 'fresh' as const }));
      const usedIds = new Set([...trendingIds, ...fresh.map(p => p.id)]);
      const popular = sorted.filter(p => p.totalVotes > 0 && !usedIds.has(p.id)).slice(0, 4).map(p => ({ ...p, tag: 'popular' as const }));
      // Show grouped: trending first, then fresh, then popular
      return [...trending, ...fresh, ...popular].slice(0, 12);
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
              const Tag = tagConfig[poll.tag];
              const TagIcon = Tag.icon;
              const hasVoted = votedPollIds?.has(poll.id);
              const imgA = poll.image_a_url || getFallbackImage(poll.id, 0);
              const imgB = poll.image_b_url || getFallbackImage(poll.id, 1);
              const isWide = i % 3 === 0;

              return (
                <motion.div
                  key={poll.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, type: 'spring', stiffness: 240, damping: 22 }}
                  onClick={() => handlePollTap(poll)}
                  className={`relative rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform ${isWide ? 'aspect-[16/10]' : 'aspect-[4/3]'}`}
                >
                  {/* Side-by-side images */}
                  <div className="absolute inset-0 flex">
                    <div className="w-1/2 h-full relative overflow-hidden">
                      <img src={imgA} alt={poll.option_a} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                      <span className="absolute bottom-3 left-3 right-1 text-[11px] font-bold text-white/90 leading-tight drop-shadow-lg">
                        {poll.option_a}
                      </span>
                    </div>
                    <div className="w-px bg-background/30 shrink-0 z-10" />
                    <div className="w-1/2 h-full relative overflow-hidden">
                      <img src={imgB} alt={poll.option_b} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                      <span className="absolute bottom-3 left-1 right-3 text-[11px] font-bold text-white/90 leading-tight text-right drop-shadow-lg">
                        {poll.option_b}
                      </span>
                    </div>
                  </div>

                  {/* Top overlay: badge + votes */}
                  <div className="absolute top-0 left-0 right-0 p-3 flex items-start justify-between z-10">
                    <motion.span
                      animate={Tag.pulse ? { scale: [1, 1.05, 1] } : {}}
                      transition={Tag.pulse ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : {}}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-extrabold tracking-[0.1em] backdrop-blur-md bg-black/40 ${Tag.color}`}
                    >
                      <TagIcon className="h-3 w-3" />
                      {Tag.label}
                    </motion.span>
                    <div className="flex items-center gap-1.5">
                      {hasVoted && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full backdrop-blur-md bg-black/40 text-accent font-bold">✓</span>
                      )}
                      <span className="text-[10px] text-white/80 flex items-center gap-1 backdrop-blur-md bg-black/40 px-2 py-0.5 rounded-full font-semibold">
                        <Users className="h-2.5 w-2.5" /> {poll.totalVotes.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Question overlay at bottom center */}
                  <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-4 pt-8 bg-gradient-to-t from-black/70 to-transparent">
                    <p className="text-sm font-display font-bold text-white text-center leading-snug drop-shadow-lg">
                      {poll.question}
                    </p>
                  </div>

                  {/* Subtle glow for trending */}
                  {poll.tag === 'trending' && (
                    <motion.div
                      animate={{ opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute inset-0 rounded-2xl ring-1 ring-destructive/30 pointer-events-none"
                    />
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
