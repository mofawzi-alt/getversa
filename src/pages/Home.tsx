import { useState, useRef, useEffect, useMemo } from 'react';
import HomeResultsModal from '@/components/home/HomeResultsModal';
import AppLayout from '@/components/layout/AppLayout';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowRight, Sparkles, Users, Zap, Flame, TrendingUp, Eye, ChevronRight, Timer, Trophy, Target, BarChart3 } from 'lucide-react';
import LiveIndicator from '@/components/poll/LiveIndicator';
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import WelcomeFlow, { isWelcomeDone, markWelcomeDone } from '@/components/onboarding/WelcomeFlow';
import VoteProgressIndicator from '@/components/onboarding/VoteProgressIndicator';
import ExploreUnlockPopup, { isExploreUnlocked, markExploreUnlocked } from '@/components/onboarding/ExploreUnlockPopup';
import AppTutorial, { isTutorialDone, markTutorialDone } from '@/components/onboarding/AppTutorial';

import { getPollDisplayImageSrc, handlePollImageError } from '@/lib/pollImages';

// FIX 4: Conversational category name mapping
const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  'Platforms': 'Apps & Tech',
  'platforms': 'Apps & Tech',
  'Money': 'Spending & Money',
  'money': 'Spending & Money',
  'Food': 'Eat & Drink',
  'food': 'Eat & Drink',
  'Fashion': 'Style',
  'fashion': 'Style',
  'Lifestyle': 'Everyday Life',
  'lifestyle': 'Everyday Life',
  'Consumer': 'Shopping',
  'consumer': 'Shopping',
  'Brands': 'Brands',
  'brands': 'Brands',
};

function getDisplayCategoryName(name: string): string {
  return CATEGORY_DISPLAY_NAMES[name] || name;
}

const CATEGORY_META: Record<string, { emoji: string; color: string; bg: string }> = {
  money: { emoji: '💸', color: 'hsl(45, 80%, 45%)', bg: 'hsl(45, 80%, 93%)' },
  'spending & money': { emoji: '💸', color: 'hsl(45, 80%, 45%)', bg: 'hsl(45, 80%, 93%)' },
  business: { emoji: '🚀', color: 'hsl(210, 70%, 50%)', bg: 'hsl(210, 70%, 93%)' },
  market: { emoji: '🌍', color: 'hsl(170, 60%, 40%)', bg: 'hsl(170, 60%, 92%)' },
  platforms: { emoji: '📱', color: 'hsl(260, 60%, 55%)', bg: 'hsl(260, 60%, 93%)' },
  'apps & tech': { emoji: '📱', color: 'hsl(260, 60%, 55%)', bg: 'hsl(260, 60%, 93%)' },
  consumer: { emoji: '🛒', color: 'hsl(340, 70%, 50%)', bg: 'hsl(340, 70%, 93%)' },
  shopping: { emoji: '🛒', color: 'hsl(340, 70%, 50%)', bg: 'hsl(340, 70%, 93%)' },
  brands: { emoji: '🏷️', color: 'hsl(15, 80%, 50%)', bg: 'hsl(15, 80%, 93%)' },
  lifestyle: { emoji: '🧠', color: 'hsl(350, 65%, 55%)', bg: 'hsl(350, 65%, 93%)' },
  'everyday life': { emoji: '🧠', color: 'hsl(350, 65%, 55%)', bg: 'hsl(350, 65%, 93%)' },
  fashion: { emoji: '👗', color: 'hsl(280, 60%, 50%)', bg: 'hsl(280, 60%, 93%)' },
  style: { emoji: '👗', color: 'hsl(280, 60%, 50%)', bg: 'hsl(280, 60%, 93%)' },
  food: { emoji: '🍔', color: 'hsl(25, 80%, 50%)', bg: 'hsl(25, 80%, 93%)' },
  'eat & drink': { emoji: '🍔', color: 'hsl(25, 80%, 50%)', bg: 'hsl(25, 80%, 93%)' },
  tech: { emoji: '💻', color: 'hsl(210, 70%, 50%)', bg: 'hsl(210, 70%, 93%)' },
  travel: { emoji: '✈️', color: 'hsl(170, 60%, 40%)', bg: 'hsl(170, 60%, 92%)' },
  music: { emoji: '🎵', color: 'hsl(340, 70%, 50%)', bg: 'hsl(340, 70%, 93%)' },
  culture: { emoji: '🎨', color: 'hsl(30, 80%, 50%)', bg: 'hsl(30, 80%, 93%)' },
  health: { emoji: '💪', color: 'hsl(145, 55%, 42%)', bg: 'hsl(145, 55%, 92%)' },
  education: { emoji: '📚', color: 'hsl(225, 60%, 50%)', bg: 'hsl(225, 60%, 93%)' },
};

function getCategoryMeta(name: string): { emoji: string; color: string; bg: string } {
  const key = name.toLowerCase();
  return CATEGORY_META[key] || { emoji: '🔥', color: 'hsl(225, 73%, 45%)', bg: 'hsl(225, 73%, 93%)' };
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
  const { user, profile, loading } = useAuth();
  const storiesRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Authenticated users with completed profiles should never see the welcome flow
  const profileComplete = !!(profile?.username && profile?.age_range && profile?.gender && profile?.country && profile?.city);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showUnlockPopup, setShowUnlockPopup] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  // Show tutorial for new visitors who completed welcome but haven't seen tutorial
  useEffect(() => {
    if (loading) return;
    if (!user && isWelcomeDone() && !isTutorialDone()) {
      setShowTutorial(true);
    }
  }, [loading, user]);

  // Only show welcome after auth loading finishes and we know the user's state
  useEffect(() => {
    if (loading) return;
    if (profileComplete || user) {
      markWelcomeDone();
      setShowWelcome(false);
    } else if (!isWelcomeDone()) {
      setShowWelcome(true);
    }
  }, [loading, profileComplete, user]);

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
    queryKey: ['visual-feed-home', profile?.gender, profile?.age_range, profile?.country],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data: rawPolls } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, image_a_url, image_b_url, category, created_at, starts_at, ends_at, weight_score, target_gender, target_age_range, target_country, target_countries')
        .eq('is_active', true)
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .order('weight_score', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(200);
      if (!rawPolls || rawPolls.length === 0) return [];

      // Filter by user demographics
      let filteredPolls = rawPolls;
      if (profile) {
        filteredPolls = rawPolls.filter(p => {
          if (p.target_gender && p.target_gender !== 'All' && profile.gender && p.target_gender !== profile.gender) return false;
          if (p.target_age_range && p.target_age_range !== 'All' && profile.age_range && p.target_age_range !== profile.age_range) return false;
          // Multi-country targeting
          const countries = (p as any).target_countries as string[] | null;
          if (countries && countries.length > 0) {
            if (profile.country && !countries.includes(profile.country)) return false;
          } else if (p.target_country && p.target_country !== 'All' && profile.country && p.target_country !== profile.country) {
            return false;
          }
          return true;
        });
      }

      const pollIds = filteredPolls.map(p => p.id);
      if (pollIds.length === 0) return [];
      const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: pollIds });
      const resultsMap = new Map(results?.map((r: any) => [r.poll_id, r]) || []);

      // Get recent votes (last 5 minutes) per poll for "voting now" count
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: recentVotesData } = await supabase
        .from('votes')
        .select('poll_id, user_id')
        .in('poll_id', pollIds)
        .gte('created_at', fiveMinAgo);
      // Count unique users per poll
      const recentVotesMap = new Map<string, Set<string>>();
      recentVotesData?.forEach(v => {
        if (!recentVotesMap.has(v.poll_id)) recentVotesMap.set(v.poll_id, new Set());
        recentVotesMap.get(v.poll_id)!.add(v.user_id);
      });
      // Count total unique voters across all polls
      const allRecentVoters = new Set<string>();
      recentVotesData?.forEach(v => allRecentVoters.add(v.user_id));

      return filteredPolls.map(p => {
        const r = resultsMap.get(p.id) as any;
        const total = (r?.total_votes as number) || 0;
        const votesA = (r?.votes_a as number) || 0;
        const votesB = (r?.votes_b as number) || 0;
        const pctA = total > 0 ? Math.round((votesA / total) * 100) : 50;
        return { ...p, totalVotes: total, percentA: pctA, percentB: 100 - pctA, votesA, votesB, recentVotes: recentVotesMap.get(p.id)?.size || 0, _recentVoterIds: Array.from(recentVotesMap.get(p.id) || []) };
      });
    },
    staleTime: 1000 * 10,
    refetchInterval: 1000 * 10,
  });

  const [modalPoll, setModalPoll] = useState<PollCard | null>(null);

  if (showWelcome) {
    return <WelcomeFlow onComplete={() => { markWelcomeDone(); setShowWelcome(false); setShowTutorial(true); }} />;
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
    if (!hasStarted) return;
    if (isExpired || hasVoted) {
      setModalPoll(poll);
    } else {
      navigate(`/vote?pollId=${poll.id}`);
    }
  };

  const handleLivePollTap = (poll: PollCard) => {
    navigate(`/live-debate?pollId=${poll.id}`);
  };

   // ── FULL HOME ──
  const now = new Date();
  const livePollsRaw = allPolls.filter(p => {
    const hasStarted = p.starts_at ? new Date(p.starts_at) <= now : true;
    const isExpired = p.ends_at ? new Date(p.ends_at) < now : false;
    return hasStarted && !isExpired;
  }).sort((a, b) => ((b as any).weight_score || 1) - ((a as any).weight_score || 1) || b.totalVotes - a.totalVotes);

  // Diversify live polls by category (round-robin pick)
  const livePolls = (() => {
    const byCategory = new Map<string, PollCard[]>();
    livePollsRaw.forEach(p => {
      const cat = p.category || 'Other';
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(p);
    });
    const cats = Array.from(byCategory.values());
    const result: PollCard[] = [];
    const usedIds = new Set<string>();
    let round = 0;
    while (result.length < livePollsRaw.length) {
      let added = false;
      for (const catPolls of cats) {
        if (round < catPolls.length && !usedIds.has(catPolls[round].id)) {
          usedIds.add(catPolls[round].id);
          result.push(catPolls[round]);
          added = true;
        }
      }
      if (!added) break;
      round++;
    }
    return result;
  })();

  // (Featured poll removed — replaced by LIVE NOW carousel)

  // Trending: build unified list with badges, diversified by category
  const trendingPolls: (PollCard & { trendBadge: string; trendHot?: boolean })[] = [];
  const seenIds = new Set<string>();
  const seenTrendingCategories = new Set<string>();

  const tryAddTrending = (p: PollCard, badge: string, hot?: boolean) => {
    if (seenIds.has(p.id)) return;
    const cat = p.category || 'Other';
    // Prefer unseen categories first, but allow repeats if we have <6 unique cats
    if (seenTrendingCategories.has(cat) && trendingPolls.length < 9) return;
    seenIds.add(p.id);
    seenTrendingCategories.add(cat);
    trendingPolls.push({ ...p, trendBadge: badge, trendHot: hot });
  };

  // Pass 1: one per category from each ranking
  // Most Voted
  [...allPolls].sort((a, b) => b.totalVotes - a.totalVotes).forEach(p => {
    if (trendingPolls.length >= 9) return;
    tryAddTrending(p, `🔥 ${p.totalVotes} votes`);
  });

  // Most Contested
  [...allPolls].filter(p => p.totalVotes > 0).sort((a, b) => Math.abs(a.percentA - 50) - Math.abs(b.percentA - 50)).forEach(p => {
    if (trendingPolls.length >= 9) return;
    const spread = Math.abs(p.percentA - 50);
    tryAddTrending(p, `⚡ ${spread}% gap`, spread <= 5);
  });

  // Fastest Rising
  [...allPolls].sort((a, b) => {
    const aAge = (Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60);
    const bAge = (Date.now() - new Date(b.created_at).getTime()) / (1000 * 60 * 60);
    return (bAge > 0 ? b.totalVotes / bAge : b.totalVotes) - (aAge > 0 ? a.totalVotes / aAge : a.totalVotes);
  }).forEach(p => {
    if (trendingPolls.length >= 9) return;
    const ageHours = Math.max(1, (Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60));
    const rate = Math.round(p.totalVotes / ageHours);
    tryAddTrending(p, `🚀 ${rate}/hr`);
  });

  // Pass 2: fill remaining slots allowing category repeats
  if (trendingPolls.length < 9) {
    [...allPolls].sort((a, b) => b.totalVotes - a.totalVotes).forEach(p => {
      if (trendingPolls.length >= 9 || seenIds.has(p.id)) return;
      seenIds.add(p.id);
      trendingPolls.push({ ...p, trendBadge: `🔥 ${p.totalVotes} votes` });
    });
  }

  const totalLiveVoters = (() => {
    if (!livePolls.length) return 0;
    const uniqueIds = new Set<string>();
    livePolls.forEach((p: any) => p._recentVoterIds?.forEach((id: string) => uniqueIds.add(id)));
    return uniqueIds.size;
  })();

  return (
    <AppLayout>
      {/* App Tutorial for new visitors */}
      {showTutorial && (
        <AppTutorial onComplete={() => setShowTutorial(false)} />
      )}
      <div className="min-h-screen flex flex-col pb-28 gap-0">
        <ExploreUnlockPopup open={showUnlockPopup} onClose={() => setShowUnlockPopup(false)} />

        {/* ═══ FIX 1: INLINE VOTE CARD — first thing users see ═══ */}
        {(() => {
          const firstUnvoted = newPolls[0];
          if (!firstUnvoted) return null;
          const imgA = getPollDisplayImageSrc({ imageUrl: firstUnvoted.image_a_url, option: firstUnvoted.option_a, question: firstUnvoted.question, side: 'A' });
          const imgB = getPollDisplayImageSrc({ imageUrl: firstUnvoted.image_b_url, option: firstUnvoted.option_b, question: firstUnvoted.question, side: 'B' });
          return (
            <section className="px-3 pt-4 pb-2">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(`/vote?pollId=${firstUnvoted.id}`)}
                className="relative rounded-2xl overflow-hidden cursor-pointer border border-border/60 shadow-xl"
              >
                {/* Images */}
                <div className="flex h-[55vh] max-h-[420px] relative">
                  <div className="w-1/2 h-full relative overflow-hidden">
                    <img src={imgA} alt={firstUnvoted.option_a} className="w-full h-full object-contain bg-muted" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute bottom-3 left-3">
                      <p className="text-white text-lg font-extrabold drop-shadow-lg">{firstUnvoted.option_a}</p>
                    </div>
                  </div>
                  <div className="absolute inset-y-0 left-1/2 w-[2px] bg-white/20 z-10" />
                  <div className="w-1/2 h-full relative overflow-hidden">
                    <img src={imgB} alt={firstUnvoted.option_b} className="w-full h-full object-contain bg-muted" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute bottom-3 right-3 text-right">
                      <p className="text-white text-lg font-extrabold drop-shadow-lg">{firstUnvoted.option_b}</p>
                    </div>
                  </div>
                </div>

                {/* Question overlay */}
                <div className="absolute top-0 inset-x-0 px-4 pt-4 pb-10 bg-gradient-to-b from-black/70 to-transparent z-10">
                  <h2 className="text-white text-xl font-display font-bold drop-shadow-lg text-center leading-snug">{firstUnvoted.question}</h2>
                </div>

                {/* Bottom gradient */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent pt-10 pb-4 px-4 z-10 flex items-end justify-between">
                  <p className="text-white text-lg font-extrabold drop-shadow-lg">{firstUnvoted.option_a}</p>
                  <p className="text-white text-lg font-extrabold drop-shadow-lg">{firstUnvoted.option_b}</p>
                </div>
              </motion.div>

              {/* Live activity strip */}
              <div className="flex items-center justify-center gap-3 mt-2">
                <LiveIndicator variant="badge" />
                {totalLiveVoters > 0 && (
                  <span className="text-xs text-muted-foreground">
                    <AnimatedNumber value={totalLiveVoters} className="font-bold text-foreground" /> voting now
                  </span>
                )}
                {(votes24h || 0) > 0 && (
                  <span className="text-xs text-muted-foreground">
                    <AnimatedNumber value={votes24h!} className="font-bold text-foreground" /> today
                  </span>
                )}
              </div>
            </section>
          );
        })()}


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
                  const imgA = getPollDisplayImageSrc({ imageUrl: poll.image_a_url, option: poll.option_a, question: poll.question, side: 'A' });
                  const imgB = getPollDisplayImageSrc({ imageUrl: poll.image_b_url, option: poll.option_b, question: poll.question, side: 'B' });
                  const hasVoted = votedPollIds?.has(poll.id);
                  return (
                    <CarouselItem key={poll.id} className="pl-2.5 basis-[92%]">
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleLivePollTap(poll)}
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
                        <div className="flex h-[55vh] max-h-[420px] relative">
                          <div className="w-1/2 h-full relative overflow-hidden">
                            <img src={imgA} alt={poll.option_a} className="w-full h-full object-contain bg-muted transition-transform duration-500 group-hover:scale-105" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.classList.add('bg-gradient-to-br', 'from-primary/30', 'to-primary/10'); }} />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                          </div>
                          <div className="absolute inset-y-0 left-1/2 w-[2px] bg-white/20 z-10" />
                          <div className="w-1/2 h-full relative overflow-hidden">
                            <img src={imgB} alt={poll.option_b} className="w-full h-full object-contain bg-muted transition-transform duration-500 group-hover:scale-105" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.classList.add('bg-gradient-to-br', 'from-primary/30', 'to-primary/10'); }} />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                          </div>
                        </div>

                        {/* Question overlay */}
                        <div className="absolute top-0 inset-x-0 px-4 pt-4 pb-8 bg-gradient-to-b from-black/70 to-transparent z-10">
                          <h3 className="text-white text-base font-bold drop-shadow-lg leading-tight text-center">{poll.question}</h3>
                        </div>

                        {/* Bottom info bar */}
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent pt-8 pb-3 px-4 z-10">
                          {/* Option labels + percentages or tap to vote */}
                          <div className="flex items-end justify-between mb-2">
                            <div className="flex-1 text-center">
                              <p className="text-white text-sm font-bold drop-shadow-lg truncate">{poll.option_a}</p>
                              {hasVoted ? (
                                <span className="text-2xl font-bold text-option-a drop-shadow-lg">
                                  <AnimatedNumber value={poll.percentA} />%
                                </span>
                              ) : null}
                            </div>
                            <div className="flex-1 text-center">
                              <p className="text-white text-sm font-bold drop-shadow-lg truncate">{poll.option_b}</p>
                              {hasVoted ? (
                                <span className="text-2xl font-bold text-option-b drop-shadow-lg">
                                  <AnimatedNumber value={poll.percentB} />%
                                </span>
                              ) : null}
                            </div>
                          </div>
                          {/* Percentage bar - split colors */}
                          <div className="h-1.5 bg-white/15 rounded-full overflow-hidden mb-2 flex">
                            <motion.div
                              className="h-full bg-option-a"
                              initial={{ width: '50%' }}
                              animate={{ width: hasVoted ? `${poll.percentA}%` : '50%' }}
                              transition={{ duration: 0.7, ease: 'easeOut' }}
                            />
                            <motion.div
                              className="h-full bg-option-b"
                              initial={{ width: '50%' }}
                              animate={{ width: hasVoted ? `${poll.percentB}%` : '50%' }}
                              transition={{ duration: 0.7, ease: 'easeOut' }}
                            />
                          </div>
                          {/* Meta row */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <LiveIndicator variant="overlay" />
                              {poll.category && (
                                <span
                                  onClick={(e) => { e.stopPropagation(); navigate(`/vote?category=${encodeURIComponent(poll.category!)}`); }}
                                  className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-white/20 text-white backdrop-blur-sm cursor-pointer hover:bg-white/30 transition-colors drop-shadow-lg"
                                >
                                  {getCategoryMeta(poll.category).emoji} {poll.category}
                                </span>
                              )}
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
                                  className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold"
                                >
                                  Swipe to Vote
                                </motion.span>
                              )}
                            </div>
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

        

        {/* ═══ POLLS WAITING NUDGE ═══ */}
        {user && (unseenCount || 0) > 0 && (
          <section className="px-3 mb-3">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/vote')}
              className="rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 px-4 py-3 flex items-center gap-3 cursor-pointer"
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Target className="h-5 w-5 text-primary" />
              </motion.div>
              <div className="flex-1">
                <p className="text-xs font-display font-bold text-foreground">
                  {unseenCount} poll{unseenCount !== 1 ? 's' : ''} waiting for your vote
                </p>
                <p className="text-[10px] text-muted-foreground">Every vote shapes the insights</p>
              </div>
              <ArrowRight className="h-4 w-4 text-primary" />
            </motion.div>
          </section>
        )}

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

        {/* ═══ 🔥 TRENDING NOW ═══ */}
        {trendingPolls.length > 0 && (
          <section className="mb-3">
            <div className="px-3 flex items-center gap-1.5 mb-2">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wider">🔥 Trending Now</span>
            </div>
            <div className="flex gap-2.5 overflow-x-auto px-3 scrollbar-hide snap-x pb-1">
              {trendingPolls.map((poll, i) => (
                <TrendingPollCard key={poll.id} poll={poll} index={i} hasVoted={!!votedPollIds?.has(poll.id)} onTap={handlePollTap} badge={poll.trendBadge} hot={poll.trendHot} onCategoryTap={(cat) => navigate(`/vote?category=${encodeURIComponent(cat)}`)} />
              ))}
            </div>
          </section>
        )}

        {/* ═══ BROWSE BY CATEGORY (FIX 3 & 4) ═══ */}
        {(() => {
          const categoryMap = new Map<string, { count: number; unseen: number; thumbnail: string | null }>();
          for (const p of allPolls) {
            const cat = p.category || 'Other';
            const existing = categoryMap.get(cat) || { count: 0, unseen: 0, thumbnail: null };
            existing.count++;
            if (!votedPollIds?.has(p.id)) existing.unseen++;
            if (!existing.thumbnail && p.image_a_url) existing.thumbnail = p.image_a_url;
            categoryMap.set(cat, existing);
          }
          const categories = Array.from(categoryMap.entries())
            .sort((a, b) => b[1].count - a[1].count);

          if (categories.length === 0) return null;

          return (
            <section className="px-3 mb-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Eye className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wider">Browse by Category</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {categories.map(([catName, info], i) => {
                  const displayName = getDisplayCategoryName(catName);
                  const meta = getCategoryMeta(displayName.toLowerCase());
                  return (
                    <motion.div
                      key={catName}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => navigate(`/vote?category=${encodeURIComponent(catName)}`)}
                      className="relative rounded-xl overflow-hidden cursor-pointer group border border-border/60 shadow-card h-24"
                    >
                      {info.thumbnail ? (
                        <img src={info.thumbnail} alt={displayName} className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-40 transition-opacity" />
                      ) : (
                        <div className="absolute inset-0" style={{ background: meta.bg }} />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-card via-card/80 to-card/40" />
                      <div className="relative h-full flex flex-col justify-end p-3">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-lg">{meta.emoji}</span>
                          <span className="text-xs font-display font-bold text-foreground">{displayName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">{info.count} polls</span>
                          {info.unseen > 0 ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-bold">
                              {info.unseen} new today
                            </span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                              Updated daily
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          );
        })()}

        {/* ═══ 🔥 WHAT PEOPLE ARE CHOOSING RIGHT NOW ═══ */}
        {(() => {
          const allP = polls || [];
          if (allP.length === 0) return null;

          // Aggregate votes per unique option name, weighted by recency
          const optionMap = new Map<string, { name: string; totalVotes: number; recentVotes: number; imageUrl: string | null }>();
          const ensure = (name: string, img: string | null) => {
            if (!optionMap.has(name)) optionMap.set(name, { name, totalVotes: 0, recentVotes: 0, imageUrl: img });
          };
          for (const p of allP) {
            if (p.totalVotes === 0) continue;
            ensure(p.option_a, p.image_a_url);
            ensure(p.option_b, p.image_b_url);
            const entryA = optionMap.get(p.option_a)!;
            entryA.totalVotes += p.votesA;
            entryA.recentVotes += p.recentVotes > 0 ? Math.round(p.recentVotes * (p.votesA / p.totalVotes)) : 0;
            const entryB = optionMap.get(p.option_b)!;
            entryB.totalVotes += p.votesB;
            entryB.recentVotes += p.recentVotes > 0 ? Math.round(p.recentVotes * (p.votesB / p.totalVotes)) : 0;
          }

          // Score = total votes + recent activity boost (recent votes × 5)
          const topOptions = Array.from(optionMap.values())
            .sort((a, b) => (b.totalVotes + b.recentVotes * 5) - (a.totalVotes + a.recentVotes * 5))
            .slice(0, 5);

          if (topOptions.length === 0) return null;
          return (
            <section className="px-3 mb-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Flame className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wider">What People Are Choosing Right Now</span>
              </div>
              <div className="bg-card rounded-xl border border-border/60 overflow-hidden shadow-card">
                {topOptions.map((opt, i) => (
                  <motion.div
                    key={opt.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => navigate(`/vote?search=${encodeURIComponent(opt.name)}`)}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer active:bg-muted/50 transition-colors ${i < topOptions.length - 1 ? 'border-b border-border/40' : ''}`}
                  >
                    <span className="text-xs font-bold text-muted-foreground/60 w-4 text-center shrink-0">{i + 1}</span>
                    {opt.imageUrl ? (
                      <img src={opt.imageUrl} alt={opt.name} className="w-7 h-7 rounded-lg object-cover shrink-0" />
                    ) : null}
                    <span className="text-xs font-bold text-foreground line-clamp-1 flex-1">
                      {opt.name}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-muted-foreground">{opt.totalVotes.toLocaleString()} votes</span>
                      {opt.recentVotes > 0 && (
                        <span className="text-[9px] font-bold text-primary px-1.5 py-0.5 rounded-full bg-primary/10">active</span>
                      )}
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          );
        })()}

        <HomeResultsModal
          open={!!modalPoll}
          onOpenChange={(open) => !open && setModalPoll(null)}
          poll={modalPoll}
          imageA={modalPoll ? getPollDisplayImageSrc({ imageUrl: modalPoll.image_a_url, option: modalPoll.option_a, question: modalPoll.question, side: 'A' }) : ''}
          imageB={modalPoll ? getPollDisplayImageSrc({ imageUrl: modalPoll.image_b_url, option: modalPoll.option_b, question: modalPoll.question, side: 'B' }) : ''}
        />
      </div>
    </AppLayout>
  );
}

// ── Trending Poll Card (compact horizontal scroll) ──
function TrendingPollCard({ poll, index, hasVoted, onTap, badge, hot, onCategoryTap }: {
  poll: PollCard; index: number; hasVoted: boolean; onTap: (p: PollCard) => void; badge: string; hot?: boolean; onCategoryTap?: (cat: string) => void;
}) {
  const imgA = getPollDisplayImageSrc({ imageUrl: poll.image_a_url, option: poll.option_a, question: poll.question, side: 'A' });
  const imgB = getPollDisplayImageSrc({ imageUrl: poll.image_b_url, option: poll.option_b, question: poll.question, side: 'B' });
  const isLive = (!poll.ends_at || new Date(poll.ends_at) >= new Date()) && (!poll.starts_at || new Date(poll.starts_at) <= new Date());
  const isExpired = poll.ends_at ? new Date(poll.ends_at) < new Date() : false;

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
          <img src={imgA} alt={poll.option_a} className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.classList.add('bg-gradient-to-br', 'from-primary/30', 'to-primary/10'); }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-1.5 left-1.5">
            <p className="text-white text-[8px] font-bold drop-shadow-lg truncate max-w-[70px]">{poll.option_a}</p>
            {(hasVoted || isExpired) && <span className="text-[10px] font-bold text-option-a drop-shadow-lg">{poll.percentA}%</span>}
          </div>
        </div>
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/15 z-10" />
        <div className="w-1/2 h-full relative overflow-hidden">
          <img src={imgB} alt={poll.option_b} className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.classList.add('bg-gradient-to-br', 'from-primary/30', 'to-primary/10'); }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-1.5 right-1.5 text-right">
            <p className="text-white text-[8px] font-bold drop-shadow-lg truncate max-w-[70px]">{poll.option_b}</p>
            {(hasVoted || isExpired) && <span className="text-[10px] font-bold text-option-b drop-shadow-lg">{poll.percentB}%</span>}
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
        {isExpired ? (
          <span className="text-[8px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full shrink-0">Ended</span>
        ) : isLive ? (
          <LiveIndicator variant="inline" />
        ) : null}
        <p className="text-[9px] font-bold text-foreground truncate flex-1">{poll.question}</p>
      </div>
      <div className="px-2 pb-1.5 bg-card flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold ${hot ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground'}`}>
            {badge}
          </span>
          {poll.category && (
            <span
              onClick={(e) => { e.stopPropagation(); onCategoryTap?.(poll.category!); }}
              className="text-[8px] px-1.5 py-0.5 rounded-full font-bold bg-primary/10 text-primary cursor-pointer hover:bg-primary/20 transition-colors"
            >
              {getCategoryMeta(poll.category).emoji} {poll.category}
            </span>
          )}
        </div>
        {!hasVoted && !isExpired && (
          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold">Vote</span>
        )}
        {isExpired && (
          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-bold">Results</span>
        )}
      </div>
    </motion.div>
  );
}
