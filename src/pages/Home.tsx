import { useState, useRef, useEffect } from 'react';
import HomeResultsModal from '@/components/home/HomeResultsModal';
import AppLayout from '@/components/layout/AppLayout';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowRight, Sparkles, Users, Zap, Flame, TrendingUp, Eye, ChevronRight, Timer, Trophy, Target, BarChart3, type LucideIcon, Utensils, Shirt, Monitor, Plane, Music, Palette, Heart, Dumbbell, BookOpen } from 'lucide-react';
import LiveIndicator from '@/components/poll/LiveIndicator';
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  recentVotes: number;
};

const EXPLORE_THRESHOLD = 3;

// Animated counter component
function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = value;
    if (from === value) return;
    const duration = 800;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);
  return <span className={className}>{display.toLocaleString()}</span>;
}

// Time remaining helper
function getTimeLeft(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) return `${Math.floor(hours / 24)}d left`;
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const storiesRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const [showWelcome, setShowWelcome] = useState(!isWelcomeDone());
  const [showUnlockPopup, setShowUnlockPopup] = useState(false);

  // Realtime subscription: invalidate vote-related queries on new votes
  useEffect(() => {
    const channel = supabase
      .channel('home-votes-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'votes' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['votes-24h'] });
          queryClient.invalidateQueries({ queryKey: ['visual-feed-home'] });
          queryClient.invalidateQueries({ queryKey: ['unseen-poll-count'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

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

  // Votes in last 24 hours — refreshes via realtime + refetchInterval fallback
  const { data: votes24h } = useQuery({
    queryKey: ['votes-24h'],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase.from('votes').select('id', { count: 'exact', head: true }).gte('created_at', since);
      return count || 0;
    },
    staleTime: 1000 * 10,
    refetchInterval: 1000 * 10,
  });

  // User weekly vote count
  const { data: weeklyVotes } = useQuery({
    queryKey: ['weekly-votes', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase.from('votes').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', weekAgo);
      return count || 0;
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!user,
  });

  // User streak
  const { data: userStreak } = useQuery({
    queryKey: ['user-streak', user?.id],
    queryFn: async () => {
      if (!user) return { current: 0, longest: 0 };
      const { data } = await supabase.from('users').select('current_streak, longest_streak').eq('id', user.id).single();
      return { current: data?.current_streak || 0, longest: data?.longest_streak || 0 };
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!user,
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

      // Get recent votes (last 5 minutes) per poll for "voting now" count
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: recentVotesData } = await supabase
        .from('votes')
        .select('poll_id')
        .in('poll_id', pollIds)
        .gte('created_at', fiveMinAgo);
      const recentVotesMap = new Map<string, number>();
      recentVotesData?.forEach(v => {
        recentVotesMap.set(v.poll_id, (recentVotesMap.get(v.poll_id) || 0) + 1);
      });

      return rawPolls.map(p => {
        const r = resultsMap.get(p.id) as any;
        const total = (r?.total_votes as number) || 0;
        const votesA = (r?.votes_a as number) || 0;
        const votesB = (r?.votes_b as number) || 0;
        const pctA = total > 0 ? Math.round((votesA / total) * 100) : 50;
        return { ...p, totalVotes: total, percentA: pctA, percentB: 100 - pctA, votesA, votesB, recentVotes: recentVotesMap.get(p.id) || 0 };
      });
    },
    staleTime: 1000 * 10,
    refetchInterval: 1000 * 10,
  });

  const [modalPoll, setModalPoll] = useState<PollCard | null>(null);

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

  // ── SIMPLIFIED HOME for new users (<3 votes) ──
  if (isNewUser) {
    const todaysPolls = newPolls.slice(0, 5);
    return (
      <AppLayout>
        <div className="min-h-screen flex flex-col pb-24 gap-1">
          <VoteProgressIndicator voteCount={voteCount} target={EXPLORE_THRESHOLD} />

          <div className="px-3 pt-3 flex items-center gap-2">
            <Flame className="h-4 w-4 text-destructive" />
            <h2 className="text-sm font-display font-bold text-foreground">Today's Polls</h2>
          </div>

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
                      <Users className="h-2.5 w-2.5" /> {poll.totalVotes} votes
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

  // ── FULL HOME (unlocked) ──
  const now = new Date();
  const livePolls = allPolls.filter(p => {
    const hasStarted = p.starts_at ? new Date(p.starts_at) <= now : true;
    const isExpired = p.ends_at ? new Date(p.ends_at) < now : false;
    return hasStarted && !isExpired;
  }).sort((a, b) => b.totalVotes - a.totalVotes);

  // (Featured poll removed — replaced by LIVE NOW carousel)

  // Trending: most voted today, most contested, fastest rising
  const mostVotedToday = [...allPolls].sort((a, b) => b.totalVotes - a.totalVotes).slice(0, 6);
  const mostContested = [...allPolls].filter(p => p.totalVotes > 0).sort((a, b) => {
    return Math.abs(a.percentA - 50) - Math.abs(b.percentA - 50);
  }).slice(0, 6);
  const fastestRising = [...allPolls].sort((a, b) => {
    const aAge = (Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60);
    const bAge = (Date.now() - new Date(b.created_at).getTime()) / (1000 * 60 * 60);
    const aRate = aAge > 0 ? a.totalVotes / aAge : a.totalVotes;
    const bRate = bAge > 0 ? b.totalVotes / bAge : b.totalVotes;
    return bRate - aRate;
  }).slice(0, 6);

  const totalLiveVoters = livePolls.reduce((sum, p) => sum + p.recentVotes, 0);

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col pb-24 gap-0">
        <ExploreUnlockPopup open={showUnlockPopup} onClose={() => setShowUnlockPopup(false)} />

        {/* ═══ HERO SECTION ═══ */}
        <section className="relative px-4 pt-4 pb-5">
          {/* Live glow background */}
          <motion.div
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 bg-gradient-to-b from-primary/5 via-primary/10 to-transparent pointer-events-none rounded-b-3xl"
          />

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-1">
              <LiveIndicator variant="badge" />
              <motion.span
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {totalLiveVoters > 0 ? <><AnimatedNumber value={totalLiveVoters} className="font-bold text-foreground" /> voting now</> : 'Live now'}
              </motion.span>
            </div>

            <h1 className="text-2xl font-display font-bold text-foreground leading-tight">
              🔥 The Pulse Is<br />
              <span className="text-gradient">Live</span>
            </h1>

            <p className="text-sm text-muted-foreground mt-1">
              Real-time opinions. Real-time shifts.
              {(votes24h || 0) > 0 && (
                <>
                  {' · '}<AnimatedNumber value={votes24h!} className="font-bold text-foreground" /> votes today
                </>
              )}
            </p>

            <motion.button
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => navigate('/vote')}
              className="mt-3 w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-primary text-primary-foreground font-display font-bold text-base tracking-wide shadow-glow"
            >
              <motion.div
                animate={{ x: [0, 4, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Zap className="h-5 w-5" />
              </motion.div>
              Start Swiping
              {hasUnseen && (
                <span className="ml-1 px-2 py-0.5 rounded-full bg-primary-foreground/20 text-[11px] font-bold">
                  {unseenCount} new
                </span>
              )}
            </motion.button>
          </div>
        </section>

        {/* ═══ 🔴 LIVE NOW ═══ */}
        <section className="mb-3">
          <div className="px-3 flex items-center gap-2 mb-2">
            <motion.div
              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="h-2.5 w-2.5 rounded-full bg-destructive"
            />
            <div className="flex flex-col">
              <span className="text-xs font-display font-bold text-foreground uppercase tracking-wider">LIVE DEBATES</span>
              <span className="text-[10px] text-muted-foreground -mt-0.5">Happening right now{livePolls.length > 0 ? ` · ${livePolls.length} active` : ''}</span>
            </div>
          </div>

          {livePolls.length > 0 ? (
            <Carousel opts={{ align: 'start', loop: false }} className="px-3">
              <CarouselContent className="-ml-2.5">
                {livePolls.map((poll, i) => {
                  const imgA = poll.image_a_url || getFallbackImage(poll.id, 0);
                  const imgB = poll.image_b_url || getFallbackImage(poll.id, 1);
                  const hasVoted = votedPollIds?.has(poll.id);
                  return (
                    <CarouselItem key={poll.id} className="pl-2.5 basis-[85%] sm:basis-[75%]">
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handlePollTap(poll)}
                        className="relative rounded-2xl overflow-hidden cursor-pointer group border border-border/60 shadow-card"
                      >
                        {/* Pulse glow ring */}
                        <motion.div
                          animate={{
                            boxShadow: [
                              '0 0 0px hsl(var(--destructive) / 0)',
                              '0 0 20px hsl(var(--destructive) / 0.2)',
                              '0 0 0px hsl(var(--destructive) / 0)',
                            ],
                          }}
                          transition={{ duration: 2.5, repeat: Infinity }}
                          className="absolute inset-0 rounded-2xl z-20 pointer-events-none"
                        />

                        {/* Images */}
                        <div className="flex h-52 relative">
                          <div className="w-1/2 h-full relative overflow-hidden">
                            <img src={imgA} alt={poll.option_a} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                            <div className="absolute bottom-3 left-3 right-1">
                              <p className="text-white text-sm font-bold drop-shadow-lg">{poll.option_a}</p>
                              <motion.div
                                key={poll.percentA}
                                initial={{ scale: 1.15 }}
                                animate={{ scale: 1 }}
                                transition={{ duration: 0.4 }}
                              >
                                <AnimatedNumber value={poll.percentA} className="text-xl font-bold text-option-a drop-shadow-lg" />
                                <span className="text-option-a text-xl font-bold drop-shadow-lg">%</span>
                              </motion.div>
                            </div>
                          </div>
                          <div className="absolute inset-y-0 left-1/2 w-[2px] bg-white/20 z-10" />
                          <div className="w-1/2 h-full relative overflow-hidden">
                            <img src={imgB} alt={poll.option_b} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                            <div className="absolute bottom-3 left-1 right-3 text-right">
                              <p className="text-white text-sm font-bold drop-shadow-lg">{poll.option_b}</p>
                              <motion.div
                                key={poll.percentB}
                                initial={{ scale: 1.15 }}
                                animate={{ scale: 1 }}
                                transition={{ duration: 0.4 }}
                              >
                                <AnimatedNumber value={poll.percentB} className="text-xl font-bold text-option-b drop-shadow-lg" />
                                <span className="text-option-b text-xl font-bold drop-shadow-lg">%</span>
                              </motion.div>
                            </div>
                          </div>
                        </div>

                        {/* Question overlay */}
                        <div className="absolute top-0 inset-x-0 px-3 pt-3 pb-6 bg-gradient-to-b from-black/70 to-transparent">
                          <h3 className="text-white text-sm font-bold drop-shadow-lg leading-tight">{poll.question}</h3>
                        </div>

                        {/* Animated percentage bar */}
                        <div className="absolute bottom-10 inset-x-3 h-1.5 bg-white/15 rounded-full overflow-hidden z-10">
                          <motion.div
                            className="h-full bg-option-a rounded-full"
                            initial={{ width: '50%' }}
                            animate={{ width: `${poll.percentA}%` }}
                            transition={{ duration: 0.7, ease: 'easeOut' }}
                          />
                        </div>

                        {/* Bottom bar */}
                        <div className="absolute bottom-2 inset-x-3 flex items-center justify-between z-10">
                          <div className="flex items-center gap-1.5">
                            <LiveIndicator variant="overlay" />
                            <span className="text-[10px] text-white/70 flex items-center gap-0.5 drop-shadow-lg font-medium">
                              <Users className="h-3 w-3" /> {poll.recentVotes > 0 ? <><AnimatedNumber value={poll.recentVotes} /> voting now</> : <><AnimatedNumber value={poll.totalVotes} /> votes</>}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {poll.ends_at && (
                              <span className="text-[9px] text-white/60 flex items-center gap-0.5 drop-shadow-lg">
                                <Timer className="h-2.5 w-2.5" /> {getTimeLeft(poll.ends_at)}
                              </span>
                            )}
                            {!hasVoted && (
                              <motion.span
                                animate={{ scale: [1, 1.05, 1] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                className="px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold"
                              >
                                Vote
                              </motion.span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    </CarouselItem>
                  );
                })}
              </CarouselContent>
            </Carousel>
          ) : (
            <div className="mx-3 rounded-2xl border border-border/60 bg-card px-4 py-8 text-center">
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Sparkles className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              </motion.div>
              <p className="text-sm font-display font-bold text-foreground">New live debates launching soon</p>
              <p className="text-xs text-muted-foreground mt-1">Stay tuned for real-time polls</p>
            </div>
          )}
        </section>

        {/* ═══ GAMIFICATION STRIP ═══ */}
        {user && (
          <section className="px-3 mb-3">
            <div className="grid grid-cols-3 gap-2">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-card rounded-xl px-3 py-2.5 border border-border/60 text-center"
              >
                <Trophy className="h-4 w-4 text-warning mx-auto mb-1" />
                <p className="text-lg font-display font-bold text-foreground">
                  <AnimatedNumber value={weeklyVotes || 0} />
                </p>
                <p className="text-[9px] text-muted-foreground font-medium">This Week</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-card rounded-xl px-3 py-2.5 border border-border/60 text-center"
              >
                <Flame className="h-4 w-4 text-destructive mx-auto mb-1" />
                <p className="text-lg font-display font-bold text-foreground">
                  <AnimatedNumber value={userStreak?.current || 0} />
                </p>
                <p className="text-[9px] text-muted-foreground font-medium">Day Streak</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/insights')}
                className="bg-card rounded-xl px-3 py-2.5 border border-border/60 text-center cursor-pointer"
              >
                <BarChart3 className="h-4 w-4 text-primary mx-auto mb-1" />
                <p className="text-[10px] font-display font-bold text-foreground">
                  {voteCount >= 10 ? '✓ Ready' : `${Math.min(voteCount, 10)}/10`}
                </p>
                <p className="text-[9px] text-muted-foreground font-medium">Your Report</p>
              </motion.div>
            </div>
          </section>
        )}

        {/* ═══ TRENDING NOW ═══ */}
        <section className="mb-3">
          <div className="px-3 flex items-center gap-1.5 mb-2">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wider">Trending Now</span>
          </div>

          {/* Most Voted Today */}
          <div className="mb-2">
            <div className="px-3 mb-1">
              <span className="text-[9px] font-bold text-foreground/70 uppercase tracking-wider">🔥 Most Voted</span>
            </div>
            <div className="flex gap-2.5 overflow-x-auto px-3 scrollbar-hide snap-x pb-1">
              {mostVotedToday.map((poll, i) => (
                <TrendingPollCard key={poll.id} poll={poll} index={i} hasVoted={!!votedPollIds?.has(poll.id)} onTap={handlePollTap} badge={`${poll.totalVotes} votes`} />
              ))}
            </div>
          </div>

          {/* Most Contested */}
          <div className="mb-2">
            <div className="px-3 mb-1">
              <span className="text-[9px] font-bold text-foreground/70 uppercase tracking-wider">⚡ Most Contested</span>
            </div>
            <div className="flex gap-2.5 overflow-x-auto px-3 scrollbar-hide snap-x pb-1">
              {mostContested.map((poll, i) => {
                const spread = Math.abs(poll.percentA - 50);
                return (
                  <TrendingPollCard key={poll.id} poll={poll} index={i} hasVoted={!!votedPollIds?.has(poll.id)} onTap={handlePollTap} badge={`${spread}% gap`} hot={spread <= 5} />
                );
              })}
            </div>
          </div>

          {/* Fastest Rising */}
          <div>
            <div className="px-3 mb-1">
              <span className="text-[9px] font-bold text-foreground/70 uppercase tracking-wider">🚀 Fastest Rising</span>
            </div>
            <div className="flex gap-2.5 overflow-x-auto px-3 scrollbar-hide snap-x pb-1">
              {fastestRising.map((poll, i) => {
                const ageHours = Math.max(1, (Date.now() - new Date(poll.created_at).getTime()) / (1000 * 60 * 60));
                const rate = Math.round(poll.totalVotes / ageHours);
                return (
                  <TrendingPollCard key={poll.id} poll={poll} index={i} hasVoted={!!votedPollIds?.has(poll.id)} onTap={handlePollTap} badge={`${rate}/hr`} />
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══ BROWSE BY CATEGORY LINK ═══ */}
        <section className="px-3 mb-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/explore')}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-card border border-border/60 cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-display font-bold text-foreground">Browse by Category</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </motion.button>
        </section>

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

// ── Trending Poll Card (compact horizontal scroll) ──
function TrendingPollCard({ poll, index, hasVoted, onTap, badge, hot }: {
  poll: PollCard; index: number; hasVoted: boolean; onTap: (p: PollCard) => void; badge: string; hot?: boolean;
}) {
  const imgA = poll.image_a_url || getFallbackImage(poll.id, 0);
  const imgB = poll.image_b_url || getFallbackImage(poll.id, 1);
  const isLive = (!poll.ends_at || new Date(poll.ends_at) >= new Date()) && (!poll.starts_at || new Date(poll.starts_at) <= new Date());

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      whileTap={{ scale: 0.96 }}
      onClick={() => onTap(poll)}
      className="shrink-0 w-44 rounded-xl overflow-hidden cursor-pointer snap-start group shadow-card"
    >
      <div className="flex h-24 relative">
        <div className="w-1/2 h-full relative overflow-hidden">
          <img src={imgA} alt={poll.option_a} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-1.5 left-1.5">
            <p className="text-white text-[8px] font-bold drop-shadow-lg truncate max-w-[70px]">{poll.option_a}</p>
            {hasVoted && <span className="text-[10px] font-bold text-option-a drop-shadow-lg">{poll.percentA}%</span>}
          </div>
        </div>
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/15 z-10" />
        <div className="w-1/2 h-full relative overflow-hidden">
          <img src={imgB} alt={poll.option_b} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-1.5 right-1.5 text-right">
            <p className="text-white text-[8px] font-bold drop-shadow-lg truncate max-w-[70px]">{poll.option_b}</p>
            {hasVoted && <span className="text-[10px] font-bold text-option-b drop-shadow-lg">{poll.percentB}%</span>}
          </div>
        </div>
        {/* Live glow overlay */}
        {isLive && (
          <motion.div
            animate={{ opacity: [0, 0.15, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 bg-primary/20 pointer-events-none z-10"
          />
        )}
      </div>
      <div className="px-2 py-1.5 bg-card flex items-center gap-1">
        {isLive && <LiveIndicator variant="inline" />}
        <p className="text-[9px] font-bold text-foreground truncate flex-1">{poll.question}</p>
      </div>
      <div className="px-2 pb-1.5 bg-card flex items-center justify-between">
        <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold ${hot ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground'}`}>
          {badge}
        </span>
        {!hasVoted && (
          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold">Vote</span>
        )}
      </div>
    </motion.div>
  );
}
