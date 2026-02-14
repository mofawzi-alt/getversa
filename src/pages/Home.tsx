import { useState, useRef } from 'react';
import HomeResultsModal from '@/components/home/HomeResultsModal';
import AppLayout from '@/components/layout/AppLayout';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowRight, Sparkles, Users, Zap, Flame, TrendingUp, Eye, ChevronRight } from 'lucide-react';
import LiveIndicator from '@/components/poll/LiveIndicator';
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
  starts_at: string | null;
  ends_at: string | null;
  totalVotes: number;
  percentA: number;
  percentB: number;
  votesA: number;
  votesB: number;
};

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const storiesRef = useRef<HTMLDivElement>(null);

  const { data: votedPollIds } = useQuery({
    queryKey: ['user-voted-ids', user?.id],
    queryFn: async () => {
      if (!user) return new Set<string>();
      const { data: votes } = await supabase.from('votes').select('poll_id').eq('user_id', user.id);
      return new Set(votes?.map(v => v.poll_id) || []);
    },
    staleTime: 1000 * 60 * 2,
  });

  const { data: unseenCount } = useQuery({
    queryKey: ['unseen-poll-count', user?.id],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data: polls } = await supabase.from('polls').select('id').eq('is_active', true)
        .or(`starts_at.is.null,starts_at.lte.${now}`);
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
      const now = new Date().toISOString();
      const { data: rawPolls } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, image_a_url, image_b_url, category, created_at, starts_at, ends_at')
        .eq('is_active', true)
        .or(`starts_at.is.null,starts_at.lte.${now}`)
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

  const allPolls = polls || [];
  const hasUnseen = (unseenCount || 0) > 0;
  const newPolls = allPolls.filter(p => !votedPollIds?.has(p.id));
  const trendingPolls = [...allPolls].sort((a, b) => b.totalVotes - a.totalVotes).slice(0, 6);
  const popularPolls = [...allPolls].filter(p => p.totalVotes > 0).sort((a, b) => {
    const aSpread = Math.abs(a.percentA - 50);
    const bSpread = Math.abs(b.percentA - 50);
    return aSpread - bSpread; // Most contested first
  }).slice(0, 6);
  // Stories: top voted polls as highlights
  const storyPolls = [...allPolls].sort((a, b) => b.totalVotes - a.totalVotes).slice(0, 10);

  const handlePollTap = (poll: PollCard) => {
    const hasVoted = votedPollIds?.has(poll.id);
    const hasStarted = poll.starts_at ? new Date(poll.starts_at) <= new Date() : true;
    const isExpired = poll.ends_at ? new Date(poll.ends_at) < new Date() : false;
    if (!hasStarted || isExpired) return; // Don't navigate for scheduled/expired polls
    if (hasVoted) {
      setModalPoll(poll);
    } else {
      navigate(`/vote?pollId=${poll.id}`);
    }
  };

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col pb-24 gap-1">

        {/* ── New Polls Hero Banner ── */}
        {hasUnseen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-3 mt-1 mb-1 relative rounded-2xl overflow-hidden cursor-pointer group"
            onClick={() => navigate('/vote')}
          >
            {(() => {
              const firstUnvoted = newPolls[0];
              const heroImg = firstUnvoted?.image_a_url || getFallbackImage(firstUnvoted?.id || 'hero', 0);
              return <img src={heroImg} alt="" className="w-full h-32 object-cover transition-transform duration-500 group-hover:scale-105" />;
            })()}
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-transparent" />
            <div className="absolute inset-0 flex items-center px-4">
              <div className="flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                    <Sparkles className="h-3.5 w-3.5 text-accent" />
                  </motion.div>
                  <span className="text-accent text-[11px] font-bold uppercase tracking-wider">{unseenCount} New Polls</span>
                </div>
                <p className="text-white text-sm font-display font-bold">Fresh perspectives waiting</p>
                <p className="text-white/50 text-[10px]">Tap to start voting</p>
              </div>
              <motion.div
                animate={{ x: [0, 6, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                className="shrink-0 w-9 h-9 rounded-full bg-accent flex items-center justify-center"
              >
                <ArrowRight className="h-4 w-4 text-accent-foreground" />
              </motion.div>
            </div>
            {/* Animated glow ring */}
            <motion.div
              animate={{
                boxShadow: [
                  '0 0 0px hsl(75 100% 55% / 0)',
                  '0 0 20px hsl(75 100% 55% / 0.3)',
                  '0 0 0px hsl(75 100% 55% / 0)',
                ],
              }}
              transition={{ duration: 2.5, repeat: Infinity }}
              className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-accent/40 pointer-events-none"
            />
          </motion.div>
        )}

        {/* ── Stories / Highlights Row ── */}
        {storyPolls.length > 0 && (
          <div className="mb-1">
            <div className="px-3 flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wider">Highlights</span>
              </div>
              <button onClick={() => navigate('/history')} className="text-[10px] text-primary font-semibold flex items-center gap-0.5">
                See All <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <div
              ref={storiesRef}
              className="flex gap-2.5 overflow-x-auto px-3 scrollbar-hide snap-x snap-mandatory"
            >
              {storyPolls.map((poll, i) => {
                const img = poll.image_a_url || getFallbackImage(poll.id, 0);
                const hasVoted = votedPollIds?.has(poll.id);
                const isNew = !hasVoted;
                return (
                  <motion.div
                    key={poll.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => handlePollTap(poll)}
                    className="shrink-0 snap-start cursor-pointer group"
                  >
                    <div className={`w-16 h-16 rounded-full overflow-hidden relative ${isNew ? 'ring-[2.5px] ring-accent ring-offset-[3px] ring-offset-background' : 'ring-1 ring-border/50 ring-offset-1 ring-offset-background'}`}>
                      <img src={img} alt={poll.question} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/30" />
                      {hasVoted && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[10px] font-bold text-white drop-shadow-lg">{poll.percentA}%</span>
                        </div>
                      )}
                    </div>
                    <p className="text-[9px] text-center text-muted-foreground mt-1 max-w-16 truncate font-medium">
                      {poll.category || poll.question.slice(0, 8) + '…'}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Trending Section ── */}
        {trendingPolls.length > 0 && (
          <section className="mb-1">
            <div className="px-3 flex items-center gap-1.5 mb-1.5">
              <Flame className="h-3.5 w-3.5 text-destructive" />
              <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wider">Trending Now</span>
              <span className="text-[9px] text-muted-foreground ml-auto">{trendingPolls.reduce((s, p) => s + p.totalVotes, 0)} total votes</span>
            </div>
            <div className="flex gap-2 overflow-x-auto px-3 scrollbar-hide snap-x">
              {trendingPolls.map((poll, i) => (
                <TrendingCard key={poll.id} poll={poll} index={i} hasVoted={!!votedPollIds?.has(poll.id)} onTap={handlePollTap} />
              ))}
            </div>
          </section>
        )}

        {/* ── Most Contested (Close Results) ── */}
        {popularPolls.length > 0 && (
          <section className="mb-1">
            <div className="px-3 flex items-center gap-1.5 mb-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wider">Most Contested</span>
            </div>
            <div className="px-2 space-y-2">
              {popularPolls.slice(0, 4).map((poll, i) => {
                const hasVoted = !!votedPollIds?.has(poll.id);
                const imgA = poll.image_a_url || getFallbackImage(poll.id, 0);
                const imgB = poll.image_b_url || getFallbackImage(poll.id, 1);
                const isNew = !hasVoted;
                const spread = Math.abs(poll.percentA - 50);

                return (
                  <motion.div
                    key={poll.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handlePollTap(poll)}
                    className="relative rounded-xl overflow-hidden cursor-pointer group"
                  >
                    <div className="flex h-36 relative">
                      <div className="w-1/2 h-full relative overflow-hidden">
                        <img src={imgA} alt={poll.option_a} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                        <div className="absolute bottom-2 left-2 right-1">
                          <p className="text-white text-[11px] font-bold drop-shadow-lg leading-tight truncate">{poll.option_a}</p>
                          {hasVoted && <span className="text-sm font-bold text-option-a drop-shadow-lg">{poll.percentA}%</span>}
                        </div>
                      </div>
                      <div className="absolute inset-y-0 left-1/2 w-[2px] bg-background/20 z-10" />
                      <div className="w-1/2 h-full relative overflow-hidden">
                        <img src={imgB} alt={poll.option_b} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                        <div className="absolute bottom-2 left-1 right-2 text-right">
                          <p className="text-white text-[11px] font-bold drop-shadow-lg leading-tight truncate">{poll.option_b}</p>
                          {hasVoted && <span className="text-sm font-bold text-option-b drop-shadow-lg">{poll.percentB}%</span>}
                        </div>
                      </div>
                    </div>
                    {/* Question & meta overlay */}
                    <div className="absolute top-0 inset-x-0 px-2.5 pt-2 pb-5 bg-gradient-to-b from-black/65 to-transparent">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-white text-[11px] font-bold drop-shadow-lg leading-tight truncate flex-1">{poll.question}</h3>
                        {spread <= 10 && <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-destructive/80 text-white font-bold shrink-0">🔥 Close</span>}
                      </div>
                    </div>
                    <div className="absolute bottom-1.5 right-2 flex items-center gap-1 z-10">
                      {(!poll.ends_at || new Date(poll.ends_at) >= new Date()) && (!poll.starts_at || new Date(poll.starts_at) <= new Date()) && <LiveIndicator variant="overlay" />}
                      {isNew && (
                        <motion.span
                          animate={{ boxShadow: ['0 0 0px hsl(75 100% 55% / 0)', '0 0 10px hsl(75 100% 55% / 0.4)', '0 0 0px hsl(75 100% 55% / 0)'] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className="px-1.5 py-0.5 rounded-full text-[8px] font-extrabold bg-accent/90 text-accent-foreground"
                        >
                          NEW
                        </motion.span>
                      )}
                      <span className="text-[9px] text-white/60 flex items-center gap-0.5 drop-shadow-lg">
                        <Users className="h-2.5 w-2.5" /> {poll.totalVotes}
                      </span>
                      {hasVoted && <span className="text-[8px] px-1 py-0.5 rounded-full bg-white/20 text-white font-bold">✓</span>}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── All Active Polls ── */}
        <section>
          <div className="px-3 flex items-center gap-1.5 mb-1.5">
            <Zap className="h-3.5 w-3.5 text-accent" />
            <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wider">All Active</span>
            <span className="text-[9px] text-muted-foreground ml-auto">{allPolls.length} polls</span>
          </div>
          <div className="px-2 space-y-2">
            {allPolls.slice(0, 8).map((poll, i) => {
              const hasVoted = votedPollIds?.has(poll.id);
              const imgA = poll.image_a_url || getFallbackImage(poll.id, 0);
              const imgB = poll.image_b_url || getFallbackImage(poll.id, 1);
              const isNew = !hasVoted;

              return (
                <motion.div
                  key={poll.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handlePollTap(poll)}
                  className="relative rounded-xl overflow-hidden cursor-pointer group"
                >
                  <div className="flex h-36 relative">
                    <div className="w-1/2 h-full relative overflow-hidden">
                      <img src={imgA} alt={poll.option_a} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                      <div className="absolute bottom-2 left-2 right-1">
                        <p className="text-white text-[11px] font-bold drop-shadow-lg leading-tight truncate">{poll.option_a}</p>
                        {hasVoted && <span className="text-sm font-bold text-primary drop-shadow-lg">{poll.percentA}%</span>}
                      </div>
                    </div>
                    <div className="absolute inset-y-0 left-1/2 w-[2px] bg-background/20 z-10" />
                    <div className="w-1/2 h-full relative overflow-hidden">
                      <img src={imgB} alt={poll.option_b} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                      <div className="absolute bottom-2 left-1 right-2 text-right">
                        <p className="text-white text-[11px] font-bold drop-shadow-lg leading-tight truncate">{poll.option_b}</p>
                        {hasVoted && <span className="text-sm font-bold text-accent drop-shadow-lg">{poll.percentB}%</span>}
                      </div>
                    </div>
                  </div>
                  {/* Question & meta overlay */}
                  <div className="absolute top-0 inset-x-0 px-2.5 pt-2 pb-5 bg-gradient-to-b from-black/65 to-transparent">
                    <h3 className="text-white text-[11px] font-bold drop-shadow-lg leading-tight truncate">{poll.question}</h3>
                  </div>
                   <div className="absolute bottom-1.5 right-2 flex items-center gap-1 z-10">
                    {(!poll.ends_at || new Date(poll.ends_at) >= new Date()) && (!poll.starts_at || new Date(poll.starts_at) <= new Date()) && <LiveIndicator variant="overlay" />}
                    {isNew && (
                      <motion.span
                        animate={{ boxShadow: ['0 0 0px hsl(75 100% 55% / 0)', '0 0 10px hsl(75 100% 55% / 0.4)', '0 0 0px hsl(75 100% 55% / 0)'] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="px-1.5 py-0.5 rounded-full text-[8px] font-extrabold bg-accent/90 text-accent-foreground"
                      >
                        NEW
                      </motion.span>
                    )}
                    <span className="text-[9px] text-white/60 flex items-center gap-0.5 drop-shadow-lg">
                      <Users className="h-2.5 w-2.5" /> {poll.totalVotes}
                    </span>
                    {hasVoted && <span className="text-[8px] px-1 py-0.5 rounded-full bg-white/20 text-white font-bold">✓</span>}
                  </div>
                  {isNew && (
                    <motion.div
                      animate={{ opacity: [0.2, 0.5, 0.2] }}
                      transition={{ duration: 3, repeat: Infinity }}
                      className="absolute inset-0 rounded-xl ring-1 ring-inset ring-accent/25 pointer-events-none"
                    />
                  )}
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* Bottom CTA */}
        <div className="px-3 mt-4">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/vote')}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-primary text-primary-foreground font-display font-bold text-sm tracking-wide"
          >
            <Zap className="h-4 w-4" />
            {hasUnseen ? `Vote on ${unseenCount} New` : 'Explore Perspectives'}
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

// ── Trending Card (horizontal scroll) ──
function TrendingCard({ poll, index, hasVoted, onTap }: { poll: PollCard; index: number; hasVoted: boolean; onTap: (p: PollCard) => void }) {
  const imgA = poll.image_a_url || getFallbackImage(poll.id, 0);
  const imgB = poll.image_b_url || getFallbackImage(poll.id, 1);
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onTap(poll)}
      className="shrink-0 w-40 rounded-xl overflow-hidden cursor-pointer snap-start group"
    >
      <div className="flex h-20 relative">
        <div className="w-1/2 h-full relative overflow-hidden">
          <img src={imgA} alt={poll.option_a} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-1.5 left-1.5">
            <p className="text-white text-[9px] font-bold drop-shadow-lg truncate max-w-20">{poll.option_a}</p>
            {hasVoted && <span className="text-xs font-bold text-primary drop-shadow-lg">{poll.percentA}%</span>}
          </div>
        </div>
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/15 z-10" />
        <div className="w-1/2 h-full relative overflow-hidden">
          <img src={imgB} alt={poll.option_b} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-1.5 right-1.5 text-right">
            <p className="text-white text-[9px] font-bold drop-shadow-lg truncate max-w-20">{poll.option_b}</p>
            {hasVoted && <span className="text-xs font-bold text-accent drop-shadow-lg">{poll.percentB}%</span>}
          </div>
        </div>
      </div>
      <div className="px-2 py-1.5 bg-card/90 backdrop-blur-sm flex items-center gap-1.5">
        {(!poll.ends_at || new Date(poll.ends_at) >= new Date()) && (!poll.starts_at || new Date(poll.starts_at) <= new Date()) && <LiveIndicator variant="inline" />}
        <p className="text-[10px] font-bold text-foreground truncate flex-1">{poll.question}</p>
        <span className="text-[9px] text-muted-foreground flex items-center gap-0.5 shrink-0">
          <Users className="h-2 w-2" /> {poll.totalVotes}
        </span>
      </div>
    </motion.div>
  );
}

// ── Contested Card (list-style) ──
function ContestedCard({ poll, index, hasVoted, onTap }: { poll: PollCard; index: number; hasVoted: boolean; onTap: (p: PollCard) => void }) {
  const imgA = poll.image_a_url || getFallbackImage(poll.id, 0);
  const imgB = poll.image_b_url || getFallbackImage(poll.id, 1);
  const spread = Math.abs(poll.percentA - 50);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onTap(poll)}
      className="relative rounded-xl overflow-hidden cursor-pointer group"
    >
      <div className="flex h-28 relative">
        <div className="w-1/2 h-full relative overflow-hidden">
          <img src={imgA} alt={poll.option_a} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
          <div className="absolute bottom-2 left-2">
            <p className="text-white text-[10px] font-bold drop-shadow-lg truncate max-w-24">{poll.option_a}</p>
            {hasVoted && <span className="text-sm font-bold text-primary drop-shadow-lg">{poll.percentA}%</span>}
          </div>
        </div>
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/15 z-10" />
        <div className="w-1/2 h-full relative overflow-hidden">
          <img src={imgB} alt={poll.option_b} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
          <div className="absolute bottom-2 right-2 text-right">
            <p className="text-white text-[10px] font-bold drop-shadow-lg truncate max-w-24">{poll.option_b}</p>
            {hasVoted && <span className="text-sm font-bold text-accent drop-shadow-lg">{poll.percentB}%</span>}
          </div>
        </div>
      </div>
      {/* Question & closeness bar */}
      <div className="absolute top-0 inset-x-0 px-2.5 pt-2 pb-4 bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center gap-1.5">
          <h3 className="text-white text-[10px] font-bold drop-shadow-lg leading-tight truncate flex-1">{poll.question}</h3>
          {spread <= 10 && <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-destructive/80 text-white font-bold shrink-0">🔥 Close</span>}
        </div>
      </div>
      <div className="absolute bottom-1.5 right-2 flex items-center gap-1 z-10">
        {(!poll.ends_at || new Date(poll.ends_at) >= new Date()) && (!poll.starts_at || new Date(poll.starts_at) <= new Date()) && <LiveIndicator variant="overlay" />}
        <span className="text-[9px] text-white/60 flex items-center gap-0.5 drop-shadow-lg">
          <Users className="h-2.5 w-2.5" /> {poll.totalVotes}
        </span>
        {!hasVoted && <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-accent/90 text-accent-foreground font-bold">Vote</span>}
      </div>
    </motion.div>
  );
}
