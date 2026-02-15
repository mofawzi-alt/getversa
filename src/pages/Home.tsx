import { useState, useRef, useEffect } from 'react';
import HomeResultsModal from '@/components/home/HomeResultsModal';
import AppLayout from '@/components/layout/AppLayout';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowRight, Sparkles, Users, Zap, Flame, TrendingUp, Eye, ChevronRight, Utensils, Shirt, Monitor, Plane, Music, Palette, Heart, Dumbbell, BookOpen, type LucideIcon } from 'lucide-react';
import LiveIndicator from '@/components/poll/LiveIndicator';
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import WelcomeFlow, { isWelcomeDone } from '@/components/onboarding/WelcomeFlow';
import VoteProgressIndicator from '@/components/onboarding/VoteProgressIndicator';
import ExploreUnlockPopup, { isExploreUnlocked, markExploreUnlocked } from '@/components/onboarding/ExploreUnlockPopup';

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

const CATEGORY_ICONS: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
  food: { icon: Utensils, color: 'hsl(15, 80%, 50%)', bg: 'hsl(15, 80%, 93%)' },
  fashion: { icon: Shirt, color: 'hsl(280, 60%, 50%)', bg: 'hsl(280, 60%, 93%)' },
  tech: { icon: Monitor, color: 'hsl(210, 70%, 50%)', bg: 'hsl(210, 70%, 93%)' },
  travel: { icon: Plane, color: 'hsl(170, 60%, 40%)', bg: 'hsl(170, 60%, 92%)' },
  music: { icon: Music, color: 'hsl(340, 70%, 50%)', bg: 'hsl(340, 70%, 93%)' },
  culture: { icon: Palette, color: 'hsl(30, 80%, 50%)', bg: 'hsl(30, 80%, 93%)' },
  lifestyle: { icon: Heart, color: 'hsl(350, 65%, 55%)', bg: 'hsl(350, 65%, 93%)' },
  health: { icon: Dumbbell, color: 'hsl(145, 55%, 42%)', bg: 'hsl(145, 55%, 92%)' },
  education: { icon: BookOpen, color: 'hsl(225, 60%, 50%)', bg: 'hsl(225, 60%, 93%)' },
};

function getCategoryIcon(name: string): { icon: LucideIcon; color: string; bg: string } {
  const key = name.toLowerCase();
  return CATEGORY_ICONS[key] || { icon: TrendingUp, color: 'hsl(225, 73%, 45%)', bg: 'hsl(225, 73%, 93%)' };
}

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

const EXPLORE_THRESHOLD = 3;

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const storiesRef = useRef<HTMLDivElement>(null);


  const [showWelcome, setShowWelcome] = useState(!isWelcomeDone());
  const [showUnlockPopup, setShowUnlockPopup] = useState(false);

  // Count user's total votes
  const { data: userVoteCount } = useQuery({
    queryKey: ['user-vote-count', user?.id],
    queryFn: async () => {
      if (!user) {
        try { return parseInt(localStorage.getItem('versa_guest_votes') || '0', 10); } catch { return 0; }
      }
      const { count } = await supabase.from('votes').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
      return count || 0;
    },
    staleTime: 1000 * 30,
  });

  const voteCount = userVoteCount ?? 0;
  const isNewUser = voteCount < EXPLORE_THRESHOLD;
  const hasUnlockedExplore = !isNewUser;

  // Check if we should show unlock popup (just crossed threshold)
  useEffect(() => {
    if (hasUnlockedExplore && !isExploreUnlocked()) {
      markExploreUnlocked();
      setShowUnlockPopup(true);
    }
  }, [hasUnlockedExplore]);

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

  // Show welcome flow for first-time users
  if (showWelcome) {
    return <WelcomeFlow onComplete={() => { setShowWelcome(false); navigate('/auth'); }} />;
  }

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

  const handlePollTap = (poll: PollCard) => {
    const hasVoted = votedPollIds?.has(poll.id);
    const hasStarted = poll.starts_at ? new Date(poll.starts_at) <= new Date() : true;
    const isExpired = poll.ends_at ? new Date(poll.ends_at) < new Date() : false;
    if (!hasStarted || isExpired) return;
    if (hasVoted) {
      setModalPoll(poll);
    } else {
      navigate(`/vote?pollId=${poll.id}`);
    }
  };

  // ── SIMPLIFIED HOME for new users (<5 votes) ──
  if (isNewUser) {
    const todaysPolls = newPolls.slice(0, 5);
    return (
      <AppLayout>
        <div className="min-h-screen flex flex-col pb-24 gap-1">
          {/* Progress indicator */}
          <VoteProgressIndicator voteCount={voteCount} target={EXPLORE_THRESHOLD} />

          {/* Today's Polls header */}
          <div className="px-3 pt-3 flex items-center gap-2">
            <Flame className="h-4 w-4 text-destructive" />
            <h2 className="text-sm font-display font-bold text-foreground">Today's Polls</h2>
          </div>

          {/* Simple vertical poll list */}
          <div className="px-2 space-y-3 mt-2">
            {todaysPolls.length > 0 ? todaysPolls.map((poll, i) => {
              const imgA = poll.image_a_url || getFallbackImage(poll.id, 0);
              const imgB = poll.image_b_url || getFallbackImage(poll.id, 1);
              return (
                <motion.div
                  key={poll.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handlePollTap(poll)}
                  className="relative rounded-2xl overflow-hidden cursor-pointer group shadow-card"
                >
                  <div className="flex h-44 relative">
                    <div className="w-1/2 h-full relative overflow-hidden">
                      <img src={imgA} alt={poll.option_a} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                      <div className="absolute bottom-3 left-3">
                        <p className="text-white text-sm font-bold drop-shadow-lg">{poll.option_a}</p>
                      </div>
                    </div>
                    <div className="absolute inset-y-0 left-1/2 w-[2px] bg-white/20 z-10" />
                    <div className="w-1/2 h-full relative overflow-hidden">
                      <img src={imgB} alt={poll.option_b} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                      <div className="absolute bottom-3 right-3 text-right">
                        <p className="text-white text-sm font-bold drop-shadow-lg">{poll.option_b}</p>
                      </div>
                    </div>
                  </div>
                  <div className="absolute top-0 inset-x-0 px-3 pt-2.5 pb-5 bg-gradient-to-b from-black/65 to-transparent">
                    <h3 className="text-white text-xs font-bold drop-shadow-lg leading-tight">{poll.question}</h3>
                  </div>
                  <div className="absolute bottom-2 right-3 flex items-center gap-1.5 z-10">
                    <LiveIndicator variant="overlay" />
                    <span className="text-[9px] text-white/60 flex items-center gap-0.5 drop-shadow-lg">
                      <Users className="h-2.5 w-2.5" /> {poll.totalVotes}
                    </span>
                  </div>
                </motion.div>
              );
            }) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-sm">No polls available right now</p>
              </div>
            )}
          </div>

          {/* ── Live Polls Carousel (also for new users) ── */}
          {(() => {
            const now = new Date();
            const livePollsNew = allPolls.filter(p => {
              const hasStarted = p.starts_at ? new Date(p.starts_at) <= now : true;
              const isExpired = p.ends_at ? new Date(p.ends_at) < now : false;
              return hasStarted && !isExpired;
            }).sort((a, b) => b.totalVotes - a.totalVotes).slice(0, 6);
            if (livePollsNew.length === 0) return null;
            return (
              <section className="mb-1">
                <div className="px-3 flex items-center gap-1.5 mb-1.5">
                  <LiveIndicator variant="inline" />
                  <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wider">Live Polls</span>
                </div>
                <Carousel opts={{ align: 'start', loop: true }} className="px-2">
                  <CarouselContent className="-ml-2">
                    {livePollsNew.map((poll, i) => {
                      const hasVoted = !!votedPollIds?.has(poll.id);
                      const imgA = poll.image_a_url || getFallbackImage(poll.id, 0);
                      const imgB = poll.image_b_url || getFallbackImage(poll.id, 1);
                      const isNew = !hasVoted;
                      return (
                        <CarouselItem key={poll.id} className="pl-2 basis-full">
                          <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.03 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handlePollTap(poll)}
                            className="relative rounded-xl overflow-hidden cursor-pointer group"
                          >
                            <div className="flex h-52 relative">
                              <div className="w-1/2 h-full relative overflow-hidden">
                                <img src={imgA} alt={poll.option_a} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                                <div className="absolute bottom-2 left-2 right-1">
                                  <p className="text-white text-xs font-bold drop-shadow-lg leading-tight truncate">{poll.option_a}</p>
                                  {hasVoted && <span className="text-base font-bold text-option-a drop-shadow-lg">{poll.percentA}%</span>}
                                </div>
                              </div>
                              <div className="absolute inset-y-0 left-1/2 w-[2px] bg-background/20 z-10" />
                              <div className="w-1/2 h-full relative overflow-hidden">
                                <img src={imgB} alt={poll.option_b} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                                <div className="absolute bottom-2 left-1 right-2 text-right">
                                  <p className="text-white text-xs font-bold drop-shadow-lg leading-tight truncate">{poll.option_b}</p>
                                  {hasVoted && <span className="text-base font-bold text-option-b drop-shadow-lg">{poll.percentB}%</span>}
                                </div>
                              </div>
                            </div>
                            <div className="absolute top-0 inset-x-0 px-2.5 pt-2 pb-5 bg-gradient-to-b from-black/65 to-transparent">
                              <h3 className="text-white text-xs font-bold drop-shadow-lg leading-tight truncate">{poll.question}</h3>
                            </div>
                            <div className="absolute bottom-1.5 right-2 flex items-center gap-1 z-10">
                              <LiveIndicator variant="overlay" />
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
                        </CarouselItem>
                      );
                    })}
                  </CarouselContent>
                </Carousel>
              </section>
            );
          })()}

          {/* Simple CTA */}
          {todaysPolls.length > 0 && (
            <div className="px-3 mt-4">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/vote')}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-primary text-primary-foreground font-display font-bold text-sm tracking-wide"
              >
                <Zap className="h-4 w-4" />
                Start Voting
              </motion.button>
            </div>
          )}
        </div>
      </AppLayout>
    );
  }

  // ── FULL HOME (unlocked after 5+ votes) ──

  // Trending categories
  const categoryMap = new Map<string, { name: string; pollCount: number; totalVotes: number }>();
  allPolls.forEach(p => {
    const cat = p.category || 'Uncategorized';
    const existing = categoryMap.get(cat) || { name: cat, pollCount: 0, totalVotes: 0 };
    existing.pollCount++;
    existing.totalVotes += p.totalVotes;
    categoryMap.set(cat, existing);
  });
  const trendingCategories = [...categoryMap.values()].sort((a, b) => b.totalVotes - a.totalVotes).slice(0, 8);
  const now = new Date();
  const livePolls = allPolls.filter(p => {
    const hasStarted = p.starts_at ? new Date(p.starts_at) <= now : true;
    const isExpired = p.ends_at ? new Date(p.ends_at) < now : false;
    return hasStarted && !isExpired;
  }).sort((a, b) => b.totalVotes - a.totalVotes).slice(0, 6);
  const popularPolls = [...allPolls].filter(p => p.totalVotes > 0).sort((a, b) => {
    const aSpread = Math.abs(a.percentA - 50);
    const bSpread = Math.abs(b.percentA - 50);
    return aSpread - bSpread;
  }).slice(0, 4);
  const storyPolls = [...allPolls].sort((a, b) => b.totalVotes - a.totalVotes).slice(0, 10);

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col pb-24 gap-1">

        {/* Explore unlock popup */}
        <ExploreUnlockPopup open={showUnlockPopup} onClose={() => setShowUnlockPopup(false)} />

        {/* ── Active Polls Count (top) ── */}
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/vote')}
          className="mx-3 mt-1 mb-1 rounded-xl bg-primary/5 border border-primary/20 px-3 py-2 cursor-pointer hover:bg-primary/10 transition-colors flex items-center gap-2.5"
        >
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-foreground">{allPolls.length} Active Polls</p>
            <p className="text-[10px] text-muted-foreground">Tap to explore and vote</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </motion.div>

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

        {/* ── Trending Categories ── */}
        {trendingCategories.length > 0 && (
          <section className="mb-1">
            <div className="px-3 flex items-center gap-1.5 mb-1.5">
              <Flame className="h-3.5 w-3.5 text-destructive" />
              <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wider">Trending Categories</span>
            </div>
            <div className="flex gap-2 overflow-x-auto px-3 scrollbar-hide snap-x">
              {trendingCategories.map((cat, i) => {
                const iconConfig = getCategoryIcon(cat.name);
                const IconComp = iconConfig.icon;
                return (
                  <motion.div
                    key={cat.name}
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate(`/vote?category=${encodeURIComponent(cat.name)}`)}
                    className="shrink-0 snap-start cursor-pointer flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5 hover:border-primary/40 hover:shadow-sm transition-all"
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0`} style={{ backgroundColor: iconConfig.bg }}>
                      <IconComp className="h-2.5 w-2.5" style={{ color: iconConfig.color }} />
                    </div>
                    <div className="flex flex-col">
                      <p className="text-[10px] font-bold text-foreground whitespace-nowrap">{cat.name}</p>
                      <p className="text-[8px] text-muted-foreground whitespace-nowrap">{cat.pollCount} polls · {cat.totalVotes} votes</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Live Polls ── */}
        {livePolls.length > 0 && (
          <section className="mb-1">
            <div className="px-3 flex items-center gap-1.5 mb-1.5">
              <LiveIndicator variant="inline" />
              <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wider">Live Polls</span>
            </div>
            <Carousel opts={{ align: 'start', loop: true }} className="px-2">
              <CarouselContent className="-ml-2">
                {livePolls.map((poll, i) => {
                  const hasVoted = !!votedPollIds?.has(poll.id);
                  const imgA = poll.image_a_url || getFallbackImage(poll.id, 0);
                  const imgB = poll.image_b_url || getFallbackImage(poll.id, 1);
                  const isNew = !hasVoted;

                  return (
                    <CarouselItem key={poll.id} className="pl-2 basis-full">
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handlePollTap(poll)}
                        className="relative rounded-xl overflow-hidden cursor-pointer group"
                      >
                        <div className="flex h-52 relative">
                          <div className="w-1/2 h-full relative overflow-hidden">
                            <img src={imgA} alt={poll.option_a} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                            <div className="absolute bottom-2 left-2 right-1">
                              <p className="text-white text-xs font-bold drop-shadow-lg leading-tight truncate">{poll.option_a}</p>
                              {hasVoted && <span className="text-base font-bold text-option-a drop-shadow-lg">{poll.percentA}%</span>}
                            </div>
                          </div>
                          <div className="absolute inset-y-0 left-1/2 w-[2px] bg-background/20 z-10" />
                          <div className="w-1/2 h-full relative overflow-hidden">
                            <img src={imgB} alt={poll.option_b} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                            <div className="absolute bottom-2 left-1 right-2 text-right">
                              <p className="text-white text-xs font-bold drop-shadow-lg leading-tight truncate">{poll.option_b}</p>
                              {hasVoted && <span className="text-base font-bold text-option-b drop-shadow-lg">{poll.percentB}%</span>}
                            </div>
                          </div>
                        </div>
                        <div className="absolute top-0 inset-x-0 px-2.5 pt-2 pb-5 bg-gradient-to-b from-black/65 to-transparent">
                          <h3 className="text-white text-xs font-bold drop-shadow-lg leading-tight truncate">{poll.question}</h3>
                        </div>
                        <div className="absolute bottom-1.5 right-2 flex items-center gap-1 z-10">
                          <LiveIndicator variant="overlay" />
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
                    </CarouselItem>
                  );
                })}
              </CarouselContent>
            </Carousel>
          </section>
        )}

        {/* ── Most Contested (Close Results) ── */}
        {popularPolls.length > 0 && (
          <section className="mb-1">
            <div className="px-3 flex items-center gap-1.5 mb-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wider">Most Contested</span>
            </div>
            <Carousel opts={{ align: 'start', loop: true }} className="px-2">
              <CarouselContent className="-ml-2">
                {popularPolls.slice(0, 4).map((poll, i) => {
                  const hasVoted = !!votedPollIds?.has(poll.id);
                  const imgA = poll.image_a_url || getFallbackImage(poll.id, 0);
                  const imgB = poll.image_b_url || getFallbackImage(poll.id, 1);
                  const isNew = !hasVoted;
                  const spread = Math.abs(poll.percentA - 50);

                  return (
                    <CarouselItem key={poll.id} className="pl-2 basis-full">
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handlePollTap(poll)}
                        className="relative rounded-xl overflow-hidden cursor-pointer group"
                      >
                        <div className="flex h-52 relative">
                          <div className="w-1/2 h-full relative overflow-hidden">
                            <img src={imgA} alt={poll.option_a} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                            <div className="absolute bottom-2 left-2 right-1">
                              <p className="text-white text-xs font-bold drop-shadow-lg leading-tight truncate">{poll.option_a}</p>
                              {hasVoted && <span className="text-base font-bold text-option-a drop-shadow-lg">{poll.percentA}%</span>}
                            </div>
                          </div>
                          <div className="absolute inset-y-0 left-1/2 w-[2px] bg-background/20 z-10" />
                          <div className="w-1/2 h-full relative overflow-hidden">
                            <img src={imgB} alt={poll.option_b} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                            <div className="absolute bottom-2 left-1 right-2 text-right">
                              <p className="text-white text-xs font-bold drop-shadow-lg leading-tight truncate">{poll.option_b}</p>
                              {hasVoted && <span className="text-base font-bold text-option-b drop-shadow-lg">{poll.percentB}%</span>}
                            </div>
                          </div>
                        </div>
                        <div className="absolute top-0 inset-x-0 px-2.5 pt-2 pb-5 bg-gradient-to-b from-black/65 to-transparent">
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-white text-xs font-bold drop-shadow-lg leading-tight truncate flex-1">{poll.question}</h3>
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
                    </CarouselItem>
                  );
                })}
              </CarouselContent>
            </Carousel>
          </section>
        )}

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
