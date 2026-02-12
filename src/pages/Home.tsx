import { useState } from 'react';
import HomeResultsModal from '@/components/home/HomeResultsModal';
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

  const [modalPoll, setModalPoll] = useState<PollCard | null>(null);

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
      setModalPoll(poll);
    } else {
      navigate(`/vote?pollId=${poll.id}`);
    }
  };

  // New/unvoted polls first, then voted — newest first within each group
  const allPolls = [...(polls || [])].sort((a, b) => {
    const aVoted = votedPollIds?.has(a.id) ? 1 : 0;
    const bVoted = votedPollIds?.has(b.id) ? 1 : 0;
    if (aVoted !== bVoted) return aVoted - bVoted;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col pb-24">
        {/* Header */}
        <header className="px-4 pt-3 pb-1">
          <h1 className="text-2xl font-display font-bold text-gradient tracking-tight">VERSA</h1>
          <p className="text-[10px] text-muted-foreground tracking-widest uppercase">Where perspectives collide</p>
        </header>

        {/* Section label */}
        <div className="px-4 flex items-center gap-2 mt-2 mb-2">
          <Flame className="h-4 w-4 text-destructive" />
          <span className="text-xs font-display font-bold text-foreground uppercase tracking-wider">Trending</span>
        </div>

        {/* Visual Poll Feed — uniform cards, new polls on top */}
        <div className="px-3 space-y-3">
          {allPolls.length > 0 ? (
            allPolls.map((poll, i) => {
              const hasVoted = votedPollIds?.has(poll.id);
              const imgA = poll.image_a_url || getFallbackImage(poll.id, 0);
              const imgB = poll.image_b_url || getFallbackImage(poll.id, 1);
              const winnerIsA = poll.percentA >= poll.percentB;
              const Tag = tagConfig[poll.tag];
              const TagIcon = Tag.icon;
              const isNew = !hasVoted;

              return (
                <motion.div
                  key={poll.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, type: 'spring', stiffness: 260, damping: 24 }}
                  onClick={() => handlePollTap(poll)}
                  className="rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform bg-card border border-border/30"
                >
                  {/* Split images */}
                  <div className="flex h-40 relative">
                    <div className="w-1/2 h-full relative overflow-hidden">
                      <img src={imgA} alt={poll.option_a} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                      {winnerIsA && hasVoted && poll.totalVotes > 0 && (
                        <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/90 text-primary-foreground text-[9px] font-bold">
                          <TrendUp className="h-2.5 w-2.5" /> Winner
                        </div>
                      )}
                      <div className="absolute bottom-2 left-2 right-1">
                        <p className="text-white text-xs font-bold drop-shadow-lg truncate">{poll.option_a}</p>
                        <span className="text-base font-bold text-primary drop-shadow-lg">{poll.percentA}%</span>
                      </div>
                    </div>
                    <div className="absolute inset-y-0 left-1/2 w-px bg-background/15 z-10" />
                    <div className="w-1/2 h-full relative overflow-hidden">
                      <img src={imgB} alt={poll.option_b} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                      {!winnerIsA && hasVoted && poll.totalVotes > 0 && (
                        <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-accent/90 text-accent-foreground text-[9px] font-bold">
                          <TrendUp className="h-2.5 w-2.5" /> Winner
                        </div>
                      )}
                      <div className="absolute bottom-2 left-1 right-2 text-right">
                        <p className="text-white text-xs font-bold drop-shadow-lg truncate">{poll.option_b}</p>
                        <span className="text-base font-bold text-accent drop-shadow-lg">{poll.percentB}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Card footer */}
                  <div className="px-3 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <h3 className="text-xs font-bold text-foreground truncate">{poll.question}</h3>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {isNew && (
                        <span className="px-1.5 py-0.5 rounded-full text-[8px] font-extrabold tracking-wider bg-accent/15 text-accent">NEW</span>
                      )}
                      <motion.span
                        animate={Tag.pulse ? { scale: [1, 1.05, 1] } : {}}
                        transition={Tag.pulse ? { duration: 2, repeat: Infinity } : {}}
                        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-extrabold tracking-wider ${Tag.bg} ${Tag.color}`}
                      >
                        <TagIcon className="h-2.5 w-2.5" />
                        {Tag.label}
                      </motion.span>
                      {poll.category && (
                        <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-primary/10 text-primary">
                          {poll.category}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Users className="h-2.5 w-2.5" /> {poll.totalVotes}
                      </span>
                      {hasVoted && (
                        <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent font-bold">✓</span>
                      )}
                    </div>
                  </div>
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
        <div className="px-4 mt-5">
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/vote')}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-primary text-primary-foreground font-display font-bold text-sm tracking-wide"
          >
            <Zap className="h-4 w-4" />
            {hasUnseen ? 'Start Voting' : 'Explore Perspectives'}
          </motion.button>
        </div>
        <HomeResultsModal
          open={!!modalPoll}
          onOpenChange={(open) => !open && setModalPoll(null)}
          poll={modalPoll}
          imageA={modalPoll ? getFallbackImage(modalPoll.id, 0) : ''}
          imageB={modalPoll ? getFallbackImage(modalPoll.id, 1) : ''}
        />
      </div>
    </AppLayout>
  );
}
