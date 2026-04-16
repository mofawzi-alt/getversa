import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import HomeResultsModal from '@/components/home/HomeResultsModal';
import DailyPulseStrip from '@/components/home/DailyPulseStrip';
import AppLayout from '@/components/layout/AppLayout';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { applyAgeSequencing } from '@/lib/ageSequencing';
import { buildTasteProfile, blendedPollScore, TasteProfile } from '@/lib/tasteScoring';
import { ArrowRight, Sparkles, Users, Zap, Flame, TrendingUp, Eye, ChevronRight, Timer, Trophy, Target, BarChart3, Share2 } from 'lucide-react';
import LiveIndicator from '@/components/poll/LiveIndicator';
import PinButton from '@/components/poll/PinButton';
import PinnedPollBanner from '@/components/home/PinnedPollBanner';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import WelcomeFlow, { isWelcomeDone, markWelcomeDone } from '@/components/onboarding/WelcomeFlow';
import VoteProgressIndicator from '@/components/onboarding/VoteProgressIndicator';
import ExploreUnlockPopup, { isExploreUnlocked, markExploreUnlocked } from '@/components/onboarding/ExploreUnlockPopup';
import AppTutorial, { isTutorialDone, markTutorialDone } from '@/components/onboarding/AppTutorial';
import HeroVoteCard from '@/components/home/HeroVoteCard';
import PersonalWeeklySummary from '@/components/home/PersonalWeeklySummary';
import FriendsJoinedToday from '@/components/home/FriendsJoinedToday';
import FollowingFeedSection from '@/components/home/FollowingFeedSection';
import PersonalitySnapshot from '@/components/home/PersonalitySnapshot';
import DecisionHelper from '@/components/home/DecisionHelper';


import VoteMilestoneCelebration, { checkVoteMilestone } from '@/components/home/VoteMilestoneCelebration';
import DailyReturnBanner from '@/components/home/DailyReturnBanner';
import { WelcomeBanner, TimedFloatingNudge } from '@/components/onboarding/GuestNudges';
import SwipeOverlay, { isSwipeOverlayDone, markSwipeOverlayDone } from '@/components/onboarding/SwipeOverlay';
import NotificationPrompt, { hasSeenNotifPrompt } from '@/components/onboarding/NotificationPrompt';

import { getPollDisplayImageSrc, handlePollImageError } from '@/lib/pollImages';
import PollOptionImage from '@/components/poll/PollOptionImage';
import { useDailyQueue } from '@/hooks/useDailyQueue';
import { useCelebrityPresence } from '@/hooks/useCelebrityVotes';
import { useGenderSplitTeaser } from '@/hooks/useGenderSplitTeaser';
import VerifiedBadge from '@/components/VerifiedBadge';

// Category display name mapping (canonical 8 categories)
const CATEGORY_DISPLAY_NAMES: Record<string, string> = {};

function getDisplayCategoryName(name: string): string {
  return CATEGORY_DISPLAY_NAMES[name] || name;
}

const CATEGORY_META: Record<string, { emoji: string; color: string; bg: string }> = {
  'brands': { emoji: '🏷️', color: 'hsl(15, 80%, 50%)', bg: 'hsl(15, 80%, 93%)' },
  'business & startups': { emoji: '🚀', color: 'hsl(210, 70%, 50%)', bg: 'hsl(210, 70%, 93%)' },
  'fintech & money': { emoji: '💸', color: 'hsl(45, 80%, 45%)', bg: 'hsl(45, 80%, 93%)' },
  'style & design': { emoji: '👗', color: 'hsl(280, 60%, 50%)', bg: 'hsl(280, 60%, 93%)' },
  'style': { emoji: '👗', color: 'hsl(280, 60%, 50%)', bg: 'hsl(280, 60%, 93%)' },
  'entertainment': { emoji: '🎬', color: 'hsl(260, 60%, 55%)', bg: 'hsl(260, 60%, 93%)' },
  'sports': { emoji: '⚽', color: 'hsl(145, 55%, 42%)', bg: 'hsl(145, 55%, 92%)' },
  'wellness & habits': { emoji: '🧠', color: 'hsl(350, 65%, 55%)', bg: 'hsl(350, 65%, 93%)' },
  'the pulse': { emoji: '🔥', color: 'hsl(25, 80%, 50%)', bg: 'hsl(25, 80%, 93%)' },
  'beauty': { emoji: '💄', color: 'hsl(340, 70%, 55%)', bg: 'hsl(340, 70%, 93%)' },
  'food & drinks': { emoji: '🍔', color: 'hsl(20, 75%, 50%)', bg: 'hsl(20, 75%, 93%)' },
  'lifestyle': { emoji: '✨', color: 'hsl(270, 60%, 55%)', bg: 'hsl(270, 60%, 93%)' },
  'personality': { emoji: '🧬', color: 'hsl(230, 65%, 55%)', bg: 'hsl(230, 65%, 93%)' },
  'relationships': { emoji: '💕', color: 'hsl(0, 65%, 55%)', bg: 'hsl(0, 65%, 93%)' },
  'telecom': { emoji: '📱', color: 'hsl(200, 70%, 50%)', bg: 'hsl(200, 70%, 93%)' },
};

function getCategoryMeta(name: string): { emoji: string; color: string; bg: string } {
  const key = name.toLowerCase();
  return CATEGORY_META[key] || { emoji: '🔥', color: 'hsl(225, 73%, 45%)', bg: 'hsl(225, 73%, 93%)' };
}

type PollCard = {
  id: string;
  question: string;
  subtitle?: string | null;
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

const EXPLORE_THRESHOLD = 5;

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

function HomeLiveDebateCard({
  poll,
  index,
  hasVoted,
  chosenOptionLabel,
  celebrityVoters,
  onCardClick,
}: {
  poll: PollCard;
  index: number;
  hasVoted: boolean;
  chosenOptionLabel: string | null;
  celebrityVoters: Array<{ username: string }>;
  onCardClick: () => void;
}) {
  const { data: genderTeaser } = useGenderSplitTeaser(
    hasVoted && poll.totalVotes >= 10 ? poll.id : '',
    poll.option_a,
    poll.option_b,
    poll.percentA,
    poll.percentB
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.3) }}
      whileTap={{ scale: 0.985 }}
      onClick={onCardClick}
      className="rounded-2xl overflow-hidden cursor-pointer border border-border/60 bg-card shadow-md"
    >
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-1.5">
          <LiveIndicator variant="badge" />
          <span className="text-xs text-muted-foreground font-semibold">{poll.totalVotes.toLocaleString()} votes</span>
          {poll.ends_at && (
            <span className="text-[10px] text-muted-foreground ml-auto">{getTimeLeft(poll.ends_at)}</span>
          )}
        </div>
        {celebrityVoters.length > 0 && (
          <div className="flex items-center gap-1.5 mt-1.5">
            {celebrityVoters.slice(0, 2).map((celeb, ci) => (
              <span key={ci} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10">
                <VerifiedBadge size="sm" />
                <span className="text-[10px] font-semibold text-foreground/80">{celeb.username} voted</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex relative mx-2 rounded-xl overflow-hidden" style={{ aspectRatio: '4/5' }}>
        <div className="absolute inset-0 z-20 flex items-center justify-center px-5 pointer-events-none">
          <div className="max-w-[82%] px-2 py-1">
            <p className="text-lg font-bold text-white leading-snug text-center drop-shadow-lg">{poll.question}</p>
            {'subtitle' in poll && poll.subtitle && (
              <p className="text-sm text-white/80 text-center mt-0.5 drop-shadow-md">{poll.subtitle}</p>
            )}
          </div>
        </div>
        <div className="w-1/2 h-full relative overflow-hidden">
          <PollOptionImage imageUrl={poll.image_a_url} option={poll.option_a} question={poll.question} side="A" maxLogoSize="65%" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <p className="text-white text-base font-extrabold drop-shadow-lg truncate">{poll.option_a}</p>
          </div>
          {hasVoted && (
            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1">
              <span className="text-lg font-bold text-option-a">{poll.percentA}%</span>
            </div>
          )}
          {hasVoted && chosenOptionLabel === poll.option_a && (
            <div className="absolute inset-0 border-2 border-option-a rounded-l-xl pointer-events-none" />
          )}
        </div>
        <div className="absolute inset-y-0 left-1/2 w-[1px] bg-white/30 z-10" />
        <div className="w-1/2 h-full relative overflow-hidden">
          <PollOptionImage imageUrl={poll.image_b_url} option={poll.option_b} question={poll.question} side="B" maxLogoSize="65%" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <p className="text-white text-base font-extrabold drop-shadow-lg truncate text-right">{poll.option_b}</p>
          </div>
          {hasVoted && (
            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1">
              <span className="text-lg font-bold text-option-b">{poll.percentB}%</span>
            </div>
          )}
          {hasVoted && chosenOptionLabel === poll.option_b && (
            <div className="absolute inset-0 border-2 border-option-b rounded-r-xl pointer-events-none" />
          )}
        </div>
      </div>

      <div className="px-4 pt-3 pb-4 space-y-2">
        <div className="h-2.5 bg-muted rounded-full overflow-hidden flex">
          <motion.div className="h-full bg-option-a rounded-l-full" initial={{ width: '50%' }} animate={{ width: hasVoted ? `${poll.percentA}%` : '50%' }} transition={{ duration: 0.8, ease: 'easeOut' }} />
          <motion.div className="h-full bg-option-b rounded-r-full" initial={{ width: '50%' }} animate={{ width: hasVoted ? `${poll.percentB}%` : '50%' }} transition={{ duration: 0.8, ease: 'easeOut' }} />
        </div>
        {hasVoted && (
          <div className="flex justify-between">
            <span className="text-sm font-bold text-option-a">{poll.percentA}%</span>
            <span className="text-sm font-bold text-option-b">{poll.percentB}%</span>
          </div>
        )}
        {hasVoted && genderTeaser && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[11px] text-muted-foreground"
          >
            {genderTeaser.text}
          </motion.p>
        )}
        {hasVoted ? (
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-semibold text-primary">
              You voted {chosenOptionLabel && chosenOptionLabel.length > 20 ? chosenOptionLabel.slice(0, 20) + '…' : chosenOptionLabel}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const pollUrl = `${window.location.origin}/poll/${poll.id}`;
                if (navigator.share) {
                  navigator.share({ title: 'VERSA Poll', text: `📊 ${poll.question}`, url: pollUrl });
                } else {
                  navigator.clipboard.writeText(pollUrl);
                  import('sonner').then(m => m.toast.success('Link copied!'));
                }
              }}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Share2 className="h-3 w-3" /> Share
            </button>
          </div>
        ) : (
          <button className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-1.5">
            Vote on this <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  );
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
  
  const [voteMilestone, setVoteMilestone] = useState<{ count: number; message: string } | null>(null);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const prevVoteCountRef = useRef<number | null>(null);

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

  // Realtime subscription: invalidate vote-related queries on new votes AND new polls
  useEffect(() => {
    const invalidateHomePollQueries = () => {
      queryClient.invalidateQueries({ queryKey: ['visual-feed-home'] });
      queryClient.invalidateQueries({ queryKey: ['daily-queue'] });
      queryClient.invalidateQueries({ queryKey: ['daily-queue-voted'] });
      queryClient.invalidateQueries({ queryKey: ['unseen-poll-count'] });
    };

    const channel = supabase
      .channel('home-votes-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'votes' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['votes-24h'] });
          invalidateHomePollQueries();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'polls' },
        invalidateHomePollQueries
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'polls' },
        invalidateHomePollQueries
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

  // Track which hero poll index to show for infinite voting
  const [heroPollIndex, setHeroPollIndex] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);

  // (carousel API removed — static scroll now)
  
  // Category filter for hero card
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const savedHeroIndex = useRef<number>(0);

  useEffect(() => {
    if (hasUnlockedExplore && !isExploreUnlocked()) {
      markExploreUnlocked();
      setShowUnlockPopup(true);
    }
  }, [hasUnlockedExplore]);

  const { data: votedPollIds } = useQuery({
    queryKey: ['user-voted-ids', user?.id],
    queryFn: async () => {
      if (!user) {
        // For guests, track voted polls in localStorage
        try {
          const stored = localStorage.getItem('versa_guest_voted_polls');
          return new Set<string>(stored ? JSON.parse(stored) : []);
        } catch { return new Set<string>(); }
      }
      const [{ data: votes }, { data: skipped }] = await Promise.all([
        supabase.from('votes').select('poll_id').eq('user_id', user.id),
        supabase.from('skipped_polls').select('poll_id').eq('user_id', user.id),
      ]);
      const ids = new Set(votes?.map(v => v.poll_id) || []);
      skipped?.forEach(s => ids.add(s.poll_id));
      return ids;
    },
    staleTime: 1000 * 15,
  });

  // Fetch user vote choices for showing "You voted X" on live debate cards
  const { data: userVoteChoices } = useQuery({
    queryKey: ['user-vote-choices', user?.id],
    queryFn: async () => {
      if (!user) return new Map<string, { choice: string }>();
      const { data } = await supabase.from('votes').select('poll_id, choice').eq('user_id', user.id);
      const map = new Map<string, { choice: string }>();
      data?.forEach(v => map.set(v.poll_id, { choice: v.choice }));
      return map;
    },
    staleTime: 1000 * 30,
    enabled: !!user,
  });

  // Daily queue system
  const { queuePollIds, remainingToday, allDone, invalidateQueue, isQueueLoading, totalToday } = useDailyQueue();

  const { data: unseenCount } = useQuery({
    queryKey: ['unseen-poll-count', user?.id, queuePollIds],
    queryFn: async () => {
      // For authenticated users, unseen = remaining daily queue polls
      if (user && queuePollIds.length > 0) {
        return remainingToday;
      }
      // For guests, show total active polls
      const now = new Date().toISOString();
      const { data: polls } = await supabase.from('polls').select('id').eq('is_active', true)
        .or(`starts_at.is.null,starts_at.lte.${now}`);
      return polls?.length || 0;
    },
    staleTime: 1000 * 30,
  });

  // Votes in last 24 hours — refreshes via realtime + refetchInterval fallback
  const { data: votes24h } = useQuery({
    queryKey: ['votes-24h'],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase.from('votes').select('id', { count: 'exact', head: true }).gte('created_at', since);
      return count || 0;
    },
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 60,
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


  // Taste profile for personalized feed
  const { data: userTasteProfile } = useQuery({
    queryKey: ['user-taste-profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data: votes } = await supabase
        .from('votes')
        .select('category')
        .eq('user_id', user.id)
        .not('category', 'is', null);
      const catMap = new Map<string, number>();
      votes?.forEach(v => {
        if (v.category) catMap.set(v.category, (catMap.get(v.category) || 0) + 1);
      });
      const categoryVotes = Array.from(catMap.entries()).map(([category, count]) => ({ category, count }));
      const { data: traits } = await supabase.rpc('get_user_voting_traits', { p_user_id: user.id });
      const traitTags = (traits || []).map((t: any) => ({ tag: t.tag, vote_count: Number(t.vote_count) }));
      return buildTasteProfile(categoryVotes, traitTags);
    },
    staleTime: 1000 * 60 * 10,
    enabled: !!user,
  });


  useEffect(() => {
    if (voteCount > 0) {
      const m = checkVoteMilestone(voteCount);
      if (m) setVoteMilestone(m);
    }
  }, [voteCount]);

  // Show notification prompt after first real vote OR on session start for existing unsubscribed users
  useEffect(() => {
    if (!user) return;
    const prev = prevVoteCountRef.current;
    prevVoteCountRef.current = voteCount;
    // Trigger when vote count transitions from 0 to 1 (first vote just happened)
    if (prev === 0 && voteCount === 1 && !hasSeenNotifPrompt()) {
      const timer = setTimeout(() => setShowNotifPrompt(true), 1800);
      return () => clearTimeout(timer);
    }
  }, [voteCount, user]);

  // Re-trigger for existing users who haven't enabled push yet (once per session)
  useEffect(() => {
    if (!user || !('Notification' in window)) return;
    if (Notification.permission === 'granted') return;
    if (hasSeenNotifPrompt()) return;
    // Delay so home screen loads first
    const timer = setTimeout(() => setShowNotifPrompt(true), 3000);
    return () => clearTimeout(timer);
  }, [user]);

  const { data: polls, isLoading } = useQuery({
    queryKey: ['visual-feed-home', user?.id, profile?.gender, profile?.age_range, profile?.country, queuePollIds.join('|')],
    queryFn: async () => {
      const now = new Date().toISOString();
      const pollSelect = 'id, question, subtitle, option_a, option_b, image_a_url, image_b_url, category, created_at, starts_at, ends_at, weight_score, target_gender, target_age_range, target_country, target_countries, option_a_tag, option_b_tag, tags, is_hot_take';

      const { data: rawPolls, error: rawPollsError } = await supabase
        .from('polls')
        .select(pollSelect)
        .eq('is_active', true)
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .order('weight_score', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(200);

      if (rawPollsError) throw rawPollsError;
      if (!rawPolls || rawPolls.length === 0) return [];

      const fetchedIds = new Set(rawPolls.map(p => p.id));
      const missingQueuePollIds = queuePollIds.filter(id => !fetchedIds.has(id));
      let mergedPolls = rawPolls;

      if (missingQueuePollIds.length > 0) {
        const { data: queuedPolls, error: queuedPollsError } = await supabase
          .from('polls')
          .select(pollSelect)
          .in('id', missingQueuePollIds)
          .eq('is_active', true);

        if (queuedPollsError) throw queuedPollsError;

        if (queuedPolls?.length) {
          mergedPolls = [...rawPolls, ...queuedPolls.filter(p => !fetchedIds.has(p.id))];
        }
      }

      // Filter by user demographics
      // Move explicitly targeted polls that match this user to the front,
      // but keep all other polls visible in their original weight order.
      let prioritized = mergedPolls;
      if (profile) {
        const matched: typeof mergedPolls = [];
        const others: typeof mergedPolls = [];

        mergedPolls.forEach(p => {
          const countries = (p as any).target_countries as string[] | null;
          const hasExplicitTargeting = Boolean(
            (p.target_gender && p.target_gender !== 'All') ||
            (p.target_age_range && p.target_age_range !== 'All') ||
            (countries && countries.length > 0) ||
            (p.target_country && p.target_country !== 'All')
          );

          if (!hasExplicitTargeting) {
            others.push(p);
            return;
          }

          let isMatch = true;
          if (p.target_gender && p.target_gender !== 'All' && profile.gender) {
            const genders = p.target_gender.split(',').map((g: string) => g.trim());
            if (!genders.includes(profile.gender)) isMatch = false;
          }
          if (p.target_age_range && p.target_age_range !== 'All' && profile.age_range) {
            const ages = p.target_age_range.split(',').map((a: string) => a.trim());
            if (!ages.includes(profile.age_range)) isMatch = false;
          }
          if (countries && countries.length > 0) {
            if (profile.country && !countries.includes(profile.country)) isMatch = false;
          } else if (p.target_country && p.target_country !== 'All' && profile.country && p.target_country !== profile.country) {
            isMatch = false;
          }

          if (isMatch) matched.push(p);
          // Exclude non-matching targeted polls entirely
        });

        prioritized = [...matched, ...others];
      }

      const queueSet = new Set(queuePollIds);
      const selectedPolls = prioritized.filter((p, index) => index < 100 || queueSet.has(p.id));
      const pollIds = selectedPolls.map(p => p.id);
      if (pollIds.length === 0) return [];

      const { data: results, error: resultsError } = await supabase.rpc('get_poll_results', { poll_ids: pollIds });
      if (resultsError) throw resultsError;
      const resultsMap = new Map(results?.map((r: any) => [r.poll_id, r]) || []);

      // Get recent votes (last 5 minutes) — only for top 20 polls to keep it fast
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const recentPollIds = pollIds.slice(0, 20);
      const { data: recentVotesData, error: recentVotesError } = await supabase
        .from('votes')
        .select('poll_id, user_id')
        .in('poll_id', recentPollIds)
        .gte('created_at', fiveMinAgo)
        .limit(200);

      if (recentVotesError) throw recentVotesError;

      const recentVotesMap = new Map<string, Set<string>>();
      recentVotesData?.forEach(v => {
        if (!recentVotesMap.has(v.poll_id)) recentVotesMap.set(v.poll_id, new Set());
        recentVotesMap.get(v.poll_id)!.add(v.user_id);
      });

      return selectedPolls.map(p => {
        const r = resultsMap.get(p.id) as any;
        const total = (r?.total_votes as number) || 0;
        const votesA = (r?.votes_a as number) || 0;
        const votesB = (r?.votes_b as number) || 0;
        const pctA = total > 0 ? Math.round((votesA / total) * 100) : 50;
        return { ...p, totalVotes: total, percentA: pctA, percentB: 100 - pctA, votesA, votesB, recentVotes: recentVotesMap.get(p.id)?.size || 0, _recentVoterIds: Array.from(recentVotesMap.get(p.id) || []) };
      });
    },
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });

  const [modalPoll, setModalPoll] = useState<PollCard | null>(null);

  const allPolls = polls || [];
  const hasUnseen = (unseenCount || 0) > 0;
  const allNewPolls = useMemo(() => {
    const unvoted = allPolls.filter(p => !votedPollIds?.has(p.id));
    // For authenticated users with daily queue, show queue polls + any polls not yet in the queue
    if (user && queuePollIds.length > 0) {
      const queueSet = new Set(queuePollIds);
      const nonQueuePolls = unvoted.filter(p => !queueSet.has(p.id));
      const queuePolls = unvoted.filter(p => queueSet.has(p.id));
      // Sort queue polls by queue order
      queuePolls.sort((a, b) => {
        const aIdx = queuePollIds.indexOf(a.id);
        const bIdx = queuePollIds.indexOf(b.id);
        return aIdx - bIdx;
      });
      // Prepend non-queue polls (new/manual) before queue polls so they appear first
      // Sort non-queue by weight_score desc then created_at desc
      nonQueuePolls.sort((a, b) => (b.weight_score || 1) - (a.weight_score || 1) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return [...nonQueuePolls, ...queuePolls];
    }
    return applyAgeSequencing(unvoted, profile?.age_range, votedPollIds);
  }, [allPolls, votedPollIds, profile?.age_range, user, queuePollIds]);
  const newPolls = useMemo(() => {
    if (!categoryFilter) return allNewPolls;
    return allNewPolls.filter(p => getDisplayCategoryName(p.category || 'Other') === categoryFilter);
  }, [allNewPolls, categoryFilter]);

  // Reset hero index when category filter changes
  useEffect(() => {
    if (categoryFilter) {
      setHeroPollIndex(0);
    }
  }, [categoryFilter]);

  // Keep heroPollIndex in bounds — if new polls appear or list shrinks, reset to 0
  useEffect(() => {
    if (newPolls.length > 0 && heroPollIndex >= newPolls.length) {
      setHeroPollIndex(0);
    }
  }, [newPolls.length, heroPollIndex]);

  // Auto-clear category filter when all category polls are voted
  useEffect(() => {
    if (categoryFilter && newPolls.length === 0) {
      setCategoryFilter(null);
      setHeroPollIndex(savedHeroIndex.current);
    }
  }, [categoryFilter, newPolls.length]);


  // ── Memoized expensive computations ──
  const { livePolls, trendingPolls, totalLiveVoters } = useMemo(() => {
    const now = new Date();
    const nowMs = now.getTime();

    // Time-decay scoring: newer polls score higher even with fewer votes
    // score = totalVotes / (ageInHours + 2)^0.6  — gentle decay
    const decayScore = (p: PollCard) => {
      const ageHours = Math.max(0, (nowMs - new Date(p.created_at).getTime()) / (1000 * 60 * 60));
      return p.totalVotes / Math.pow(ageHours + 2, 0.6);
    };

    const h24Ago = nowMs - 24 * 60 * 60 * 1000;
    const livePollsRaw = allPolls.filter(p => {
      const hasStarted = p.starts_at ? new Date(p.starts_at) <= now : true;
      const isExpired = p.ends_at ? new Date(p.ends_at) < now : false;
      return hasStarted && !isExpired;
    }).sort((a, b) => {
      // Polls created in last 24h always appear first
      const aNew = new Date(a.created_at).getTime() > h24Ago ? 1 : 0;
      const bNew = new Date(b.created_at).getTime() > h24Ago ? 1 : 0;
      if (aNew !== bNew) return bNew - aNew;

      // If user has a taste profile, use blended scoring (taste + trending + admin weight)
      if (userTasteProfile && userTasteProfile.totalVotes >= 3) {
        return blendedPollScore(b as any, userTasteProfile, nowMs) - blendedPollScore(a as any, userTasteProfile, nowMs);
      }
      // Fallback for new users / guests: weight_score → time-decay
      const wA = (a as any).weight_score || 1;
      const wB = (b as any).weight_score || 1;
      if (wA !== wB) return wB - wA;
      return decayScore(b) - decayScore(a);
    });

    const prioritizeLiveBucket = (items: PollCard[]) => {
      const unvoted = items.filter((p) => !votedPollIds?.has(p.id));
      const voted = items.filter((p) => votedPollIds?.has(p.id));
      return [...unvoted, ...voted];
    };

    const diversifyLiveBucket = (items: PollCard[]) => {
      const byCategory = new Map<string, PollCard[]>();
      items.forEach((p) => {
        const cat = p.category || 'Other';
        if (!byCategory.has(cat)) byCategory.set(cat, []);
        byCategory.get(cat)!.push(p);
      });
      const cats = Array.from(byCategory.values());
      const result: PollCard[] = [];
      const usedIds = new Set<string>();
      let round = 0;
      while (result.length < items.length) {
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
    };

    const freshLivePolls = livePollsRaw.filter((p) => new Date(p.created_at).getTime() > h24Ago);
    const olderLivePolls = livePollsRaw.filter((p) => new Date(p.created_at).getTime() <= h24Ago);
    const diversifiedLive = [
      ...diversifyLiveBucket(prioritizeLiveBucket(freshLivePolls)),
      ...diversifyLiveBucket(prioritizeLiveBucket(olderLivePolls)),
    ];

    // Trending — use decay score as primary ranking
    const trending: (PollCard & { trendBadge: string; trendHot?: boolean })[] = [];
    const seenIds = new Set<string>();
    const seenTrendingCategories = new Set<string>();

    const tryAddTrending = (p: PollCard, badge: string, hot?: boolean) => {
      if (seenIds.has(p.id)) return;
      const cat = p.category || 'Other';
      if (seenTrendingCategories.has(cat) && trending.length < 9) return;
      seenIds.add(p.id);
      seenTrendingCategories.add(cat);
      trending.push({ ...p, trendBadge: badge, trendHot: hot });
    };

    // 1. Top by decay score (replaces raw totalVotes)
    [...allPolls].sort((a, b) => decayScore(b) - decayScore(a)).forEach(p => {
      if (trending.length >= 9) return;
      tryAddTrending(p, `🔥 ${p.totalVotes} votes`);
    });

    // 2. Tightest margins
    [...allPolls].filter(p => p.totalVotes > 0).sort((a, b) => Math.abs(a.percentA - 50) - Math.abs(b.percentA - 50)).forEach(p => {
      if (trending.length >= 9) return;
      const spread = Math.abs(p.percentA - 50);
      tryAddTrending(p, `⚡ ${spread}% gap`, spread <= 5);
    });

    // 3. Fastest vote rate
    [...allPolls].sort((a, b) => {
      const aAge = (nowMs - new Date(a.created_at).getTime()) / (1000 * 60 * 60);
      const bAge = (nowMs - new Date(b.created_at).getTime()) / (1000 * 60 * 60);
      return (bAge > 0 ? b.totalVotes / bAge : b.totalVotes) - (aAge > 0 ? a.totalVotes / aAge : a.totalVotes);
    }).forEach(p => {
      if (trending.length >= 9) return;
      const ageHours = Math.max(1, (nowMs - new Date(p.created_at).getTime()) / (1000 * 60 * 60));
      const rate = Math.round(p.totalVotes / ageHours);
      tryAddTrending(p, `🚀 ${rate}/hr`);
    });

    // 4. Fallback fill
    if (trending.length < 9) {
      [...allPolls].sort((a, b) => decayScore(b) - decayScore(a)).forEach(p => {
        if (trending.length >= 9 || seenIds.has(p.id)) return;
        seenIds.add(p.id);
        trending.push({ ...p, trendBadge: `🔥 ${p.totalVotes} votes` });
      });
    }

    const totalVoters = (() => {
      if (!diversifiedLive.length) return 0;
      const uniqueIds = new Set<string>();
      diversifiedLive.forEach((p: any) => p._recentVoterIds?.forEach((id: string) => uniqueIds.add(id)));
      return uniqueIds.size;
    })();

    return { livePolls: diversifiedLive, trendingPolls: trending, totalLiveVoters: totalVoters };
  }, [allPolls, votedPollIds, userTasteProfile]);

  // Celebrity presence on live debate polls
  const livePollIds = useMemo(() => livePolls.map(p => p.id), [livePolls]);
  const { data: celebrityPresence = {} } = useCelebrityPresence(livePollIds);

  // (auto-rotate removed — static horizontal scroll)

  if (showWelcome) {
    return <WelcomeFlow onComplete={() => { markWelcomeDone(); setShowWelcome(false); }} />;
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

  // Smart category tap: unvoted → filter hero, all voted → explore with results
  const handleCategoryTap = (catName: string) => {
    const catPolls = allPolls.filter(p => getDisplayCategoryName(p.category || 'Other') === catName);
    const hasUnvoted = catPolls.some(p => !votedPollIds?.has(p.id));
    if (hasUnvoted) {
      // Save current position before filtering
      if (!categoryFilter) {
        savedHeroIndex.current = heroPollIndex;
      }
      setCategoryFilter(catName);
      setHeroPollIndex(0);
      heroRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate(`/explore?category=${encodeURIComponent(catName)}`);
    }
  };

  const handlePollTap = (poll: PollCard) => {
    const hasVoted = votedPollIds?.has(poll.id);
    const hasStarted = poll.starts_at ? new Date(poll.starts_at) <= new Date() : true;
    const isExpired = poll.ends_at ? new Date(poll.ends_at) < new Date() : false;
    if (!hasStarted) return;
    if (isExpired || hasVoted) {
      setModalPoll(poll);
    } else {
      // Find the poll index in newPolls and jump to it in the hero card
      const idx = newPolls.findIndex(p => p.id === poll.id);
      if (idx >= 0) {
        setHeroPollIndex(idx);
        heroRef.current?.scrollIntoView({ behavior: 'smooth' });
      } else {
        // Poll not in current filtered list — show results modal as fallback
        setModalPoll(poll);
      }
    }
  };

  const handleLivePollTap = (poll: PollCard) => {
    navigate(`/browse?filter=live&pollId=${poll.id}`);
  };

  return (
    <AppLayout>
      {/* App Tutorial for new visitors */}
      {showTutorial && (
        <AppTutorial onComplete={() => setShowTutorial(false)} />
        )}

        {/* Notification prompt after first vote */}
        <NotificationPrompt
          open={showNotifPrompt}
          onClose={() => setShowNotifPrompt(false)}
        />
      <div className="min-h-screen flex flex-col pb-28 gap-0">
        <ExploreUnlockPopup open={showUnlockPopup} onClose={() => setShowUnlockPopup(false)} />


        {/* Vote milestone celebration */}
        {voteMilestone && (
          <VoteMilestoneCelebration
            milestone={voteMilestone}
            open={!!voteMilestone}
            onClose={() => setVoteMilestone(null)}
          />
        )}

        {/* Daily return welcome banner */}
        {user && (
          <DailyReturnBanner currentStreak={userStreak?.current || 0} remainingToday={remainingToday} />
        )}

        {/* NUDGE 1: Welcome banner for guests */}
        {!user && <WelcomeBanner />}

        {/* Category filter banner */}
        {categoryFilter && (
          <div className="px-3 mb-1">
            <div className="flex items-center gap-2 bg-primary/10 rounded-xl px-3 py-2">
              <span className="text-xs font-bold text-primary flex-1">
                {getCategoryMeta(categoryFilter).emoji} Showing: {getDisplayCategoryName(categoryFilter)}
              </span>
              <button
                onClick={() => { setCategoryFilter(null); setHeroPollIndex(savedHeroIndex.current); }}
                className="text-[10px] font-bold text-primary/70 hover:text-primary px-2 py-0.5 rounded-full bg-primary/10"
              >
                ✕ Clear
              </button>
            </div>
          </div>
        )}

        {/* ═══ PINNED POLL BANNER ═══ */}
        <PinnedPollBanner />

        {/* Social proof counter */}
        <FriendsJoinedToday />

        {/* ═══ DAILY PULSE STRIP ═══ */}
        <DailyPulseStrip />

        {/* ═══ INFINITE HERO VOTE CARD ═══ */}
        <div ref={heroRef}>
          <HeroVoteCard
            poll={newPolls[heroPollIndex] || null}
            unseenCount={newPolls.length}
            onVoteComplete={() => {
              queryClient.invalidateQueries({ queryKey: ['user-voted-ids'] });
              queryClient.invalidateQueries({ queryKey: ['unseen-poll-count'] });
              queryClient.invalidateQueries({ queryKey: ['user-vote-count'] });
              queryClient.invalidateQueries({ queryKey: ['visual-feed-home'] });
              queryClient.invalidateQueries({ queryKey: ['daily-queue-voted'] });
            }}
            onPollTap={(poll) => setModalPoll(poll)}
          />
        </div>

        {/* NUDGE 4: Floating timed nudge for guests */}
        {!user && <TimedFloatingNudge />}

        {/* Live activity strip */}
        <div className="flex items-center justify-center gap-3 px-3 mb-1 mt-1">
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


        {/* Personality & Decision Helper — compact, above categories */}
        <div className="flex gap-2 px-3 mb-2">
          {user && <div className="flex-1"><PersonalitySnapshot /></div>}
          <div className={user ? "flex-1" : "flex-1"}><DecisionHelper /></div>
        </div>

        {/* ═══ Categories strip (Instagram Stories style) ═══ */}
        {(() => {
          const categoryMap = new Map<string, { count: number; unseen: number; thumbnail: string | null }>();
          for (const p of allPolls) {
            const rawCat = p.category || 'Other';
            const displayCat = getDisplayCategoryName(rawCat);
            const existing = categoryMap.get(displayCat) || { count: 0, unseen: 0, thumbnail: null };
            existing.count++;
            if (!votedPollIds?.has(p.id)) existing.unseen++;
            if (!existing.thumbnail) {
              existing.thumbnail = getPollDisplayImageSrc({ imageUrl: p.image_a_url, option: p.option_a, question: p.question, side: 'A' });
            }
            categoryMap.set(displayCat, existing);
          }
          const categories = Array.from(categoryMap.entries()).sort((a, b) => b[1].count - a[1].count);
          if (categories.length === 0) return null;

          return (
            <div className="flex gap-3 overflow-x-auto px-3 scrollbar-hide pb-2 mb-1">
              {/* Trending entry */}
              {trendingPolls.length > 0 && (
                <div
                  className="flex flex-col items-center gap-1 shrink-0 cursor-pointer"
                  onClick={() => navigate('/explore?tab=trending')}
                >
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500/25 to-red-500/15 border-2 border-orange-400 flex items-center justify-center">
                    <Flame className="h-6 w-6 text-orange-500" />
                  </div>
                  <span className="text-[10px] font-bold text-foreground">Trending</span>
                </div>
              )}
              {categories.map(([catName, info]) => {
                const displayName = getDisplayCategoryName(catName);
                const meta = getCategoryMeta(displayName.toLowerCase());
                const hasUnseen = info.unseen > 0;
                return (
                  <div
                    key={catName}
                    className="flex flex-col items-center gap-1 shrink-0 cursor-pointer"
                    onClick={() => handleCategoryTap(catName)}
                  >
                    <div className={`w-16 h-16 rounded-full overflow-hidden border-2 ${hasUnseen ? 'border-primary' : 'border-border/60'}`}>
                      {info.thumbnail ? (
                        <img src={info.thumbnail} alt={displayName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ background: meta.bg }}>
                          <span className="text-xl">{meta.emoji}</span>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] font-medium text-foreground truncate max-w-[64px] text-center">{displayName}</span>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* ═══ 🔴 LIVE DEBATES ═══ */}
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
            <div className="flex flex-col gap-4 px-3">
              {livePolls.map((poll, i) => {
                const hasVoted = Boolean(votedPollIds?.has(poll.id));
                const voteData = userVoteChoices?.get(poll.id);
                const userChoice = voteData?.choice;
                const chosenOptionLabel = userChoice === 'A' ? poll.option_a : userChoice === 'B' ? poll.option_b : null;

                return (
                  <HomeLiveDebateCard
                    key={poll.id}
                    poll={poll}
                    index={i}
                    hasVoted={hasVoted}
                    chosenOptionLabel={chosenOptionLabel}
                    celebrityVoters={celebrityPresence[poll.id] ?? []}
                    onCardClick={() => {
                      if (hasVoted) {
                        setModalPoll(poll);
                        return;
                      }

                      const idx = newPolls.findIndex(p => p.id === poll.id);
                      if (idx >= 0) {
                        setHeroPollIndex(idx);
                        heroRef.current?.scrollIntoView({ behavior: 'smooth' });
                      } else {
                        navigate(`/browse?filter=live&pollId=${poll.id}`);
                      }
                    }}
                  />
                );
              })}
            </div>
          ) : (
            <div className="mx-3 rounded-2xl border border-border/60 bg-card px-4 py-8 text-center">
              <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }}>
                <Sparkles className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              </motion.div>
              <p className="text-sm font-display font-bold text-foreground">New live debates launching soon</p>
              <p className="text-xs text-muted-foreground mt-1">Stay tuned for real-time polls</p>
            </div>
          )}
        </section>

        {/* ═══ FOLLOWING FEED ═══ */}
        <FollowingFeedSection />



        {/* Weekly Top Results Banner — show on Sundays */}
        {new Date().getDay() === 0 && (
          <div className="px-3 mb-2">
            <motion.button
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => navigate('/weekly-results')}
              className="w-full rounded-2xl bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-500/30 p-3 flex items-center gap-3 text-left"
            >
              <Trophy className="h-6 w-6 text-amber-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-sm">This Week on Versa</p>
                <p className="text-[10px] text-muted-foreground">Top results, biggest debates & surprises</p>
              </div>
              <ArrowRight className="h-4 w-4 text-amber-500 shrink-0" />
            </motion.button>
          </div>
        )}

        {/* Personal Weekly Summary */}
        <div className="px-3 mb-2">
          <PersonalWeeklySummary />
        </div>




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
                    onClick={() => navigate(`/explore?search=${encodeURIComponent(opt.name)}`)}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer active:bg-muted/50 transition-colors ${i < topOptions.length - 1 ? 'border-b border-border/40' : ''}`}
                  >
                    <span className="text-xs font-bold text-muted-foreground/60 w-4 text-center shrink-0">{i + 1}</span>
                    {(() => {
                      const resolvedImg = getPollDisplayImageSrc({ imageUrl: opt.imageUrl, option: opt.name, side: 'A' });
                      return resolvedImg ? (
                        <img src={resolvedImg} alt={opt.name} className="w-7 h-7 rounded-lg object-cover shrink-0" onError={(e) => handlePollImageError(e, { option: opt.name, side: 'A' })} />
                      ) : null;
                    })()}
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

        {/* Personality & Decision Helper */}
        {user && <PersonalitySnapshot />}
        <div className="mt-3">
          <DecisionHelper />
        </div>

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
      className="shrink-0 rounded-xl overflow-hidden cursor-pointer snap-start group shadow-card"
      style={{ width: 'calc((100vw - 36px) / 1.8)' }}
    >
      <div className="flex relative" style={{ aspectRatio: '4/5' }}>
        <div className="w-1/2 h-full relative overflow-hidden">
          <img src={imgA} alt={poll.option_a} className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105" onError={(e) => handlePollImageError(e, { option: poll.option_a, question: poll.question, side: 'A' })} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-1.5 left-1.5">
            <p className="text-white text-[8px] font-bold drop-shadow-lg truncate max-w-[70px]">{poll.option_a}</p>
            {(hasVoted || isExpired) && <span className="text-[10px] font-bold text-option-a drop-shadow-lg">{poll.percentA}%</span>}
          </div>
        </div>
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/15 z-10" />
        <div className="w-1/2 h-full relative overflow-hidden">
          <img src={imgB} alt={poll.option_b} className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105" onError={(e) => handlePollImageError(e, { option: poll.option_b, question: poll.question, side: 'B' })} />
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
