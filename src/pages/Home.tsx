import { useState } from 'react';
import HomeResultsModal from '@/components/home/HomeResultsModal';
import AppLayout from '@/components/layout/AppLayout';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowRight, Sparkles, Users, Zap } from 'lucide-react';
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
  created_at: string;
  totalVotes: number;
  percentA: number;
  percentB: number;
  votesA: number;
  votesB: number;
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
      return rawPolls.map(p => {
        const r = resultsMap.get(p.id) as any;
        const total = (r?.total_votes as number) || 0;
        const votesA = (r?.votes_a as number) || 0;
        const votesB = (r?.votes_b as number) || 0;
        const pctA = total > 0 ? Math.round((votesA / total) * 100) : 50;
        return { ...p, totalVotes: total, percentA: pctA, percentB: 100 - pctA, votesA, votesB };
      });
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

  // Unvoted first, then voted — newest first within each group
  const allPolls = [...(polls || [])].sort((a, b) => {
    const aVoted = votedPollIds?.has(a.id) ? 1 : 0;
    const bVoted = votedPollIds?.has(b.id) ? 1 : 0;
    if (aVoted !== bVoted) return aVoted - bVoted;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  }).slice(0, 12);

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col pb-24">
        {/* Hero Banner — only when new polls exist */}
        {hasUnseen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-2 mt-1 mb-2 relative rounded-2xl overflow-hidden cursor-pointer"
            onClick={() => navigate('/vote')}
          >
            {/* Use first unvoted poll's image as hero bg */}
            {(() => {
              const firstUnvoted = allPolls.find(p => !votedPollIds?.has(p.id));
              const heroImg = firstUnvoted?.image_a_url || getFallbackImage(firstUnvoted?.id || 'hero', 0);
              return <img src={heroImg} alt="" className="w-full h-36 object-cover" />;
            })()}
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
            <div className="absolute inset-0 flex items-center px-4">
              <div className="flex-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Sparkles className="h-4 w-4 text-accent" />
                  </motion.div>
                  <span className="text-accent text-xs font-bold uppercase tracking-wider">{unseenCount} new</span>
                </div>
                <p className="text-white text-sm font-display font-bold">Fresh perspectives waiting</p>
                <p className="text-white/60 text-[10px] mt-0.5">Swipe to share your take</p>
              </div>
              <div className="shrink-0 w-10 h-10 rounded-full bg-accent/20 backdrop-blur-sm flex items-center justify-center border border-accent/30">
                <ArrowRight className="h-4 w-4 text-accent" />
              </div>
            </div>
            {/* Glow border */}
            <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-accent/20 pointer-events-none" />
          </motion.div>
        )}

        {/* Poll Grid — image-dominant cards */}
        <div className="px-2 space-y-2">
          {allPolls.length > 0 ? (
            allPolls.map((poll, i) => {
              const hasVoted = votedPollIds?.has(poll.id);
              const imgA = poll.image_a_url || getFallbackImage(poll.id, 0);
              const imgB = poll.image_b_url || getFallbackImage(poll.id, 1);
              const isNew = !hasVoted;

              return (
                <motion.div
                  key={poll.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, type: 'spring', stiffness: 300, damping: 26 }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handlePollTap(poll)}
                  className="relative rounded-2xl overflow-hidden cursor-pointer group"
                >
                  {/* Full-bleed split images */}
                  <div className="flex h-52 relative">
                    <div className="w-1/2 h-full relative overflow-hidden">
                      <img src={imgA} alt={poll.option_a} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <div className="absolute bottom-3 left-3 right-1">
                        <p className="text-white text-sm font-bold drop-shadow-lg leading-tight">{poll.option_a}</p>
                        {hasVoted && (
                          <span className="text-lg font-bold text-primary drop-shadow-lg">{poll.percentA}%</span>
                        )}
                      </div>
                    </div>
                    {/* Thin divider */}
                    <div className="absolute inset-y-0 left-1/2 w-[2px] bg-background/20 z-10" />
                    <div className="w-1/2 h-full relative overflow-hidden">
                      <img src={imgB} alt={poll.option_b} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <div className="absolute bottom-3 left-1 right-3 text-right">
                        <p className="text-white text-sm font-bold drop-shadow-lg leading-tight">{poll.option_b}</p>
                        {hasVoted && (
                          <span className="text-lg font-bold text-accent drop-shadow-lg">{poll.percentB}%</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Question overlay at top */}
                  <div className="absolute top-0 inset-x-0 px-3 pt-2.5 pb-6 bg-gradient-to-b from-black/70 to-transparent">
                    <h3 className="text-white text-xs font-bold drop-shadow-lg leading-tight">{poll.question}</h3>
                  </div>

                  {/* Minimal metadata overlay bottom-right */}
                  <div className="absolute bottom-2.5 right-3 flex items-center gap-1.5 z-10">
                    {isNew && (
                      <motion.span
                        animate={{ boxShadow: ['0 0 0px hsl(75 100% 55% / 0)', '0 0 12px hsl(75 100% 55% / 0.5)', '0 0 0px hsl(75 100% 55% / 0)'] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-accent/90 text-accent-foreground"
                      >
                        NEW
                      </motion.span>
                    )}
                    <span className="text-[10px] text-white/70 flex items-center gap-0.5 drop-shadow-lg">
                      <Users className="h-2.5 w-2.5" /> {poll.totalVotes}
                    </span>
                    {hasVoted && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/20 text-white font-bold backdrop-blur-sm">✓</span>
                    )}
                  </div>

                  {/* Glow ring on new polls */}
                  {isNew && (
                    <motion.div
                      animate={{ opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 3, repeat: Infinity }}
                      className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-accent/30 pointer-events-none"
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
        <div className="px-3 mt-3">
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
          imageA={modalPoll ? (modalPoll.image_a_url || getFallbackImage(modalPoll.id, 0)) : ''}
          imageB={modalPoll ? (modalPoll.image_b_url || getFallbackImage(modalPoll.id, 1)) : ''}
        />
      </div>
    </AppLayout>
  );
}
