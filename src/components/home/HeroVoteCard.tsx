import { useState, useRef, useCallback, useEffect } from 'react';
import HotTakeBadge from './HotTakeBadge';
import ControversialBadge from './ControversialBadge';
import CountdownTimer from '@/components/poll/CountdownTimer';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { playSwipeSound, playResultSound } from '@/lib/sounds';
import { hapticVote, hapticSuccess } from '@/lib/haptics';
import PollOptionImage from '@/components/poll/PollOptionImage';
import CategoryBadge from '@/components/category/CategoryBadge';
import { mapToVersaCategory } from '@/lib/categoryMeta';
import { toast } from 'sonner';
import { Check, Send, ArrowUp, Equal } from 'lucide-react';
import SharePollToFriendSheet from '@/components/messages/SharePollToFriendSheet';
import HeroCaughtUp from './HeroCaughtUp';

import { useGenderSplitTeaser } from '@/hooks/useGenderSplitTeaser';
import { usePeopleLikeYou } from '@/hooks/usePeopleLikeYou';
import { getInsightTier } from '@/lib/streakGating';
import HookMoment from '@/components/onboarding/HookMoment';
import CampaignFeedbackModal from '@/components/poll/CampaignFeedbackModal';
import { useCampaignFeedbackConfig } from '@/hooks/useCampaignFeedbackConfig';

interface HeroPoll {
  id: string;
  question: string;
  subtitle?: string | null;
  option_a: string;
  option_b: string;
  image_a_url: string | null;
  image_b_url: string | null;
  category: string | null;
  totalVotes: number;
  percentA: number;
  percentB: number;
  is_hot_take?: boolean;
  ends_at?: string | null;
}

interface HeroVoteCardProps {
  poll: HeroPoll | null;
  unseenCount: number;
  onVoteComplete?: () => void;
  onPollTap?: (poll: any) => void;
}

const SWIPE_THRESHOLD = 50;
// Skip-by-swipe-up requires a long, deliberate upward flick. Previously 50px
// was firing accidentally during normal scroll/tap interactions, causing the
// first polls in a session to be silently logged as skips and disappear from
// the deck. Raised so only an obvious upward gesture counts.
const SWIPE_UP_THRESHOLD = 140;
const SWIPE_UP_HORIZONTAL_LOCK = 40;
const FLASH_RESULT_MS = 1500;
const RESULT_MS = 1500;
const TAP_MOVE_TOLERANCE = 12;
const DRAG_DEAD_ZONE = 15;

export default function HeroVoteCard({ poll, unseenCount, onVoteComplete, onPollTap }: HeroVoteCardProps) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<{
    choice: 'A' | 'B';
    percentA: number;
    percentB: number;
    total: number;
  } | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [isMinority, setIsMinority] = useState(false);
  const [isFirstVoteOfDay, setIsFirstVoteOfDay] = useState(false);
  const [revealMode, setRevealMode] = useState<'flash' | 'full' | null>(null);
  const [cinematicData, setCinematicData] = useState<{
    choice: 'A' | 'B';
    percentA: number;
    percentB: number;
    totalVotes: number;
  } | null>(null);
  const sessionShownRef = useRef(new Set<string>());
  const [showHookMoment, setShowHookMoment] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [feedbackPrompt, setFeedbackPrompt] = useState<{ pollId: string; choice: 'A' | 'B'; optionLabel: string } | null>(null);
  const { data: feedbackConfig } = useCampaignFeedbackConfig(poll?.id);

  // Gate gender teaser behind streak (Day 3+)
  const streak: number = (profile as any)?.current_streak ?? 0;
  const insightTier = getInsightTier(streak);
  
  const { data: genderTeaser } = useGenderSplitTeaser(
    poll?.id || '',
    poll?.option_a || '',
    poll?.option_b || '',
    result?.percentA ?? poll?.percentA ?? 0,
    result?.percentB ?? poll?.percentB ?? 0
  );

  // "People Like You" age comparison
  const { data: peopleLikeYou } = usePeopleLikeYou(
    poll?.id || '',
    result?.choice || 'A',
    poll?.option_a || '',
    poll?.option_b || ''
  );

  // Live count of votes in last 5 minutes — header strip
  const { data: liveVotes5m = 0 } = useQuery({
    queryKey: ['live-votes-5m'],
    queryFn: async () => {
      const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('votes')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', since);
      return count || 0;
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  // Recent voter avatars on this poll for the avatar stack
  const { data: recentVoters } = useQuery({
    queryKey: ['hero-recent-voters', poll?.id],
    enabled: !!poll?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('votes')
        .select('user_id')
        .eq('poll_id', poll!.id)
        .order('created_at', { ascending: false })
        .limit(20);
      const ids = Array.from(new Set((data || []).map((v: any) => v.user_id).filter(Boolean))).slice(0, 3);
      if (ids.length === 0) return { avatars: [] as string[], extra: 0 };
      const { data: profs } = await (supabase as any)
        .from('profiles')
        .select('id, avatar_url')
        .in('id', ids);
      const avatars = (profs || []).map((p: any) => p.avatar_url).filter(Boolean) as string[];
      const extra = Math.max((poll?.totalVotes || 0) - 3, 0);
      return { avatars, extra };
    },
    staleTime: 60_000,
  });

  const startX = useRef(0);
  const startY = useRef(0);
  const currentDragX = useRef(0);
  const currentDragY = useRef(0);
  const hasMoved = useRef(false);
  const isDraggingRef = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showHint) return;
    const timer = setTimeout(() => setShowHint(false), 4000);
    return () => clearTimeout(timer);
  }, [showHint]);

  // Reset hint when poll changes
  useEffect(() => {
    setShowHint(true);
  }, [poll?.id]);

  const submitVote = useCallback(async (choice: 'A' | 'B') => {
    if (!poll || result || isVoting) return;

    // Native haptic feedback the moment a vote is committed
    hapticVote();

    // Guest gate: allow 5 free votes, then require signup
    if (!user) {
      const guestVotes = parseInt(localStorage.getItem('versa_guest_votes') || '0', 10);
      if (guestVotes >= 5) {
        try { sessionStorage.setItem('versa_vote_intent', poll.id); } catch {}
        window.location.href = '/auth?mode=signup&reason=vote';
        return;
      }
      setIsVoting(true);
      setDragX(0);
      setDragY(0);
      playSwipeSound();

      setResult({
        choice,
        percentA: poll.percentA,
        percentB: poll.percentB,
        total: poll.totalVotes,
      });

      localStorage.setItem('versa_guest_votes', String(guestVotes + 1));
      try {
        const stored = localStorage.getItem('versa_guest_voted_polls');
        const ids: string[] = stored ? JSON.parse(stored) : [];
        ids.push(poll.id);
        localStorage.setItem('versa_guest_voted_polls', JSON.stringify(ids));
      } catch {}
      playResultSound();

      // Guests always get flash mode
      setRevealMode('flash');
      const newGuestCount = guestVotes + 1;
      setTimeout(() => {
        setResult(null);
        setIsVoting(false);
        setRevealMode(null);
        setShowHint(true);
        // After 5th vote, show hook moment
        if (newGuestCount >= 5) {
          setShowHookMoment(true);
          return;
        }
        onVoteComplete?.();
      }, FLASH_RESULT_MS);

      queryClient.invalidateQueries({ queryKey: ['user-vote-count'] });
      return;
    }
    
    setIsVoting(true);
    setDragX(0);
    setDragY(0);
    setIsMinority(false);
    setIsFirstVoteOfDay(false);
    setRevealMode(null);

    playSwipeSound();

    // Show initial result immediately
    setResult({
      choice,
      percentA: poll.percentA,
      percentB: poll.percentB,
      total: poll.totalVotes,
    });

    // Check if this is the first vote of the day
    let firstVoteToday = false;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count: todayVotesBefore } = await supabase
      .from('votes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', todayStart.toISOString());
    
    if ((todayVotesBefore || 0) === 0 && !sessionShownRef.current.has('first_vote_today')) {
      firstVoteToday = true;
      setIsFirstVoteOfDay(true);
      sessionShownRef.current.add('first_vote_today');
    }

    // Get total vote count for milestone check
    const { count: totalVoteCount } = await supabase
      .from('votes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);
    const voteNumber = (totalVoteCount || 0) + 1; // +1 for current vote

    const votePayload = {
      poll_id: poll.id,
      user_id: user.id,
      choice,
      ...(poll.category ? { category: poll.category } : {}),
      ...(profile?.gender ? { voter_gender: profile.gender } : {}),
      ...(profile?.age_range ? { voter_age_range: profile.age_range } : {}),
      ...(profile?.country ? { voter_country: profile.country } : {}),
      ...(profile?.city ? { voter_city: profile.city } : {}),
    };

    const { error } = await supabase.from('votes').insert(votePayload);
    if (error && error.code !== '23505') {
      toast.error('Vote failed');
      setResult(null);
      setIsVoting(false);
      return;
    }

    const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: [poll.id] });
    let pA = poll.percentA;
    let pB = poll.percentB;
    let total = poll.totalVotes;
    let userPct = choice === 'A' ? pA : pB;
    let isMinorityVote = false;
    let isCloseSplit = false;

    if (results?.[0]) {
      pA = results[0].percent_a;
      pB = results[0].percent_b;
      total = Number(results[0].total_votes);
      userPct = choice === 'A' ? pA : pB;
      
      setResult({ choice, percentA: pA, percentB: pB, total });

      // Minority: user chose side with < 25%
      if (userPct < 25) {
        isMinorityVote = true;
        setIsMinority(true);
      }
      
      // Close split: between 45-55%
      isCloseSplit = pA >= 45 && pA <= 55;
    }

    playResultSound();

    queryClient.invalidateQueries({ queryKey: ['user-voted-ids'] });
    queryClient.invalidateQueries({ queryKey: ['unseen-poll-count'] });
    queryClient.invalidateQueries({ queryKey: ['user-vote-count'] });
    queryClient.invalidateQueries({ queryKey: ['visual-feed-home'] });

    // Determine mode: Flash vs Full Reveal
    const milestoneVotes = [10, 25, 50, 100, 200, 500, 1000];
    const isMilestone = milestoneVotes.includes(voteNumber);
    const shouldFullReveal = false; // Cinematic card disabled — replaced with subtle toast

    // Surface special moments as a small toast at top instead of full-screen takeover
    if (isMinorityVote) {
      toast('🎯 You\'re in the minority on this one', { duration: 2200 });
    } else if (isCloseSplit) {
      toast('⚖️ Almost a perfect split', { duration: 2200 });
    } else if (firstVoteToday) {
      toast('👋 First vote of the day', { duration: 2000 });
    } else if (isMilestone) {
      toast(`🔥 ${voteNumber} votes in`, { duration: 2200 });
    }

    // Campaign feedback prompt: only for campaign polls with config enabled
    if (feedbackConfig && (feedbackConfig.config.enabled || feedbackConfig.config.verbatim)) {
      const optionLabel = choice === 'A' ? poll.option_a : poll.option_b;
      // Delay slightly so flash result registers first
      setTimeout(() => {
        setFeedbackPrompt({ pollId: poll.id, choice, optionLabel });
      }, FLASH_RESULT_MS + 300);
    }

    if (shouldFullReveal) {
      setRevealMode('full');
      setTimeout(() => {
        setCinematicData({
          choice,
          percentA: pA,
          percentB: pB,
          totalVotes: total,
        });
      }, RESULT_MS);
    } else {
      // Flash mode: show inline result briefly, then auto-advance
      setRevealMode('flash');
      setTimeout(() => {
        setResult(null);
        setIsVoting(false);
        setRevealMode(null);
        setIsMinority(false);
        setIsFirstVoteOfDay(false);
        setShowHint(true);
        onVoteComplete?.();
      }, FLASH_RESULT_MS);
    }
  }, [onVoteComplete, poll, profile, queryClient, result, isVoting, user]);

  const submitSkip = useCallback(async () => {
    if (!poll || result || isVoting) return;
    setIsVoting(true);
    setDragX(0);
    setDragY(0);

    if (user) {
      await supabase.from('skipped_polls').insert({
        poll_id: poll.id,
        user_id: user.id,
        ...(poll.category ? { category: poll.category } : {}),
        ...(profile?.gender ? { voter_gender: profile.gender } : {}),
        ...(profile?.age_range ? { voter_age_range: profile.age_range } : {}),
        ...(profile?.country ? { voter_country: profile.country } : {}),
        ...(profile?.city ? { voter_city: profile.city } : {}),
      });
    }

    queryClient.invalidateQueries({ queryKey: ['user-voted-ids'] });
    queryClient.invalidateQueries({ queryKey: ['visual-feed-home'] });

    setIsVoting(false);
    setShowHint(true);
    onVoteComplete?.();
  }, [poll, result, isVoting, user, profile, queryClient, onVoteComplete]);

  if (!poll) {
    return <HeroCaughtUp onPollTap={onPollTap} />;
  }

  const handleStart = (clientX: number, clientY: number) => {
    if (result || isVoting) return;
    setIsDragging(true);
    isDraggingRef.current = true;
    startX.current = clientX;
    startY.current = clientY;
    currentDragX.current = 0;
    currentDragY.current = 0;
    hasMoved.current = false;
    setShowHint(false);
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDraggingRef.current || result || isVoting) return;
    const dx = clientX - startX.current;
    const dy = clientY - startY.current;
    if (Math.abs(dx) > TAP_MOVE_TOLERANCE || Math.abs(dy) > TAP_MOVE_TOLERANCE) {
      hasMoved.current = true;
    }
    currentDragX.current = dx;
    currentDragY.current = dy;
    setDragX(dx);
    setDragY(dy);
  };

  const handleEnd = (clientX: number) => {
    if (!isDraggingRef.current || result || isVoting) return;
    isDraggingRef.current = false;
    setIsDragging(false);

    const finalDragX = currentDragX.current;
    const finalDragY = currentDragY.current;

    // Swipe up = skip — requires a long, clearly-vertical flick to avoid
    // accidental skips from normal taps or near-horizontal drags.
    if (finalDragY < -SWIPE_UP_THRESHOLD && Math.abs(finalDragX) < SWIPE_UP_HORIZONTAL_LOCK) {
      submitSkip();
      return;
    }

    // Swipe left = vote A
    if (finalDragX < -SWIPE_THRESHOLD) {
      submitVote('A');
      return;
    }

    // Swipe right = vote B
    if (finalDragX > SWIPE_THRESHOLD) {
      submitVote('B');
      return;
    }

    // Tap detection (no significant movement)
    if (!hasMoved.current && cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const tapX = clientX - rect.left;
      const midpoint = rect.width / 2;
      if (tapX < midpoint) {
        submitVote('A');
      } else {
        submitVote('B');
      }
      return;
    }

    setDragX(0);
    setDragY(0);
  };

  // Images handled by PollOptionImage component

  // Apply dead zone to visual offset — card doesn't move until drag exceeds threshold
  const visualDragX = Math.abs(dragX) > DRAG_DEAD_ZONE ? dragX - Math.sign(dragX) * DRAG_DEAD_ZONE : 0;
  const visualDragY = Math.abs(dragY) > DRAG_DEAD_ZONE ? dragY - Math.sign(dragY) * DRAG_DEAD_ZONE : 0;

  const normalizedOffset = Math.min(Math.abs(visualDragX), 200) / 200;
  const rotation = Math.sign(visualDragX) * normalizedOffset * 8;
  const highlightA = !result && !isVoting && visualDragX < -10 ? Math.min(Math.abs(visualDragX) / SWIPE_THRESHOLD, 1) : 0;
  const highlightB = !result && !isVoting && visualDragX > 10 ? Math.min(visualDragX / SWIPE_THRESHOLD, 1) : 0;

  // Split question into a "lead" + "tail" so the trailing clause can render in
  // the brand green for visual rhythm (matches reference design).
  const splitQuestion = (q: string): { lead: string; tail: string | null } => {
    const connectors = [' than ', ' or ', ' vs ', ' versus '];
    for (const c of connectors) {
      const idx = q.toLowerCase().indexOf(c);
      if (idx > 0) {
        return { lead: q.slice(0, idx).trim(), tail: q.slice(idx).trim() };
      }
    }
    // Fallback: split roughly in half on a space if long
    if (q.length > 32) {
      const mid = Math.floor(q.length / 2);
      const space = q.indexOf(' ', mid);
      if (space > 0) return { lead: q.slice(0, space).trim(), tail: q.slice(space).trim() };
    }
    return { lead: q, tail: null };
  };
  const { lead: qLead, tail: qTail } = splitQuestion(poll.question);
  const avatars = recentVoters?.avatars ?? [];
  const extraVoters = recentVoters?.extra ?? 0;

  return (
    <section className="px-3 pt-3 pb-2">
      {/* Above-card meta: battles left + live countdown */}
      {(unseenCount > 0 || poll.ends_at) && (
        <div className="flex items-center justify-center gap-2 mb-2 flex-wrap">
          {unseenCount > 0 && (
            <motion.span
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-secondary text-foreground font-semibold"
            >
              🔥 <span className="text-destructive">{unseenCount}</span> battle{unseenCount !== 1 ? 's' : ''} left today
            </motion.span>
          )}
          {poll.ends_at && <CountdownTimer endsAt={poll.ends_at} size="sm" />}
        </div>
      )}

      {/* Main card */}
      <motion.div
        ref={cardRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`relative isolate rounded-3xl overflow-hidden border border-border/60 bg-card shadow-xl select-none ${
          !result && !isVoting ? 'cursor-pointer' : ''
        }`}
        style={{
          touchAction: result || isVoting ? 'auto' : 'pan-y',
          transform: result || isVoting
            ? 'none'
            : `translateX(${visualDragX}px) translateY(${Math.min(visualDragY, 0)}px) rotate(${rotation}deg)`,
          transition: isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.25,0.46,0.45,0.94)',
          willChange: isDragging ? 'transform' : 'auto',
        }}
        onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => {
          handleMove(e.touches[0].clientX, e.touches[0].clientY);
        }}
        onTouchEnd={(e) => handleEnd(e.changedTouches[0].clientX)}
        onMouseDown={(e) => { e.preventDefault(); handleStart(e.clientX, e.clientY); }}
        onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
        onMouseUp={(e) => handleEnd(e.clientX)}
        onMouseLeave={() => { if (isDraggingRef.current) { isDraggingRef.current = false; setIsDragging(false); setDragX(0); setDragY(0); } }}
      >
        {/* Header strip — LIVE pill, recent vote count, avatars */}
        <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              LIVE NOW
            </span>
            {liveVotes5m >= 5 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-medium truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                +{liveVotes5m.toLocaleString()} votes · last 5 min
              </span>
            )}
          </div>
          {(avatars.length > 0 || extraVoters > 0) && (
            <div className="flex items-center -space-x-2 shrink-0">
              {avatars.slice(0, 3).map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt=""
                  className="w-6 h-6 rounded-full border-2 border-card object-cover bg-muted"
                />
              ))}
              {extraVoters > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-secondary text-primary text-[10px] font-bold">
                  +{extraVoters > 99 ? '99' : extraVoters}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Question header */}
        <div className="px-5 pt-1 pb-3 text-center">
          {poll.is_hot_take ? (
            <p className="text-[11px] font-bold text-destructive mb-1 inline-flex items-center gap-1 justify-center">
              🔥 Hot Take
            </p>
          ) : (
            <p className="text-[11px] font-bold text-destructive mb-1 inline-flex items-center gap-1 justify-center">
              🔥 The Pulse
            </p>
          )}
          <h2 className="font-display font-bold leading-tight text-foreground text-2xl">
            {qLead}
            {qTail && (
              <>
                {' '}
                <span className="text-success">{qTail}</span>
              </>
            )}
            {!qTail && '?'}
          </h2>
          {poll.subtitle && (
            <p className="text-sm text-muted-foreground mt-1.5">{poll.subtitle}</p>
          )}
        </div>

        {/* Two-image split */}
        <div className={`flex h-[48vh] max-h-[420px] relative ${poll.is_hot_take ? 'ring-2 ring-[hsl(15,90%,55%)]' : ''}`}>
          <ControversialBadge percentA={poll.percentA} percentB={poll.percentB} totalVotes={poll.totalVotes} />

          {/* Option A — left half */}
          <div
            className="w-1/2 h-full relative overflow-hidden transition-transform duration-200"
            style={{
              transform: highlightA > 0 ? `scale(${1 + highlightA * 0.03})` : 'scale(1)',
              boxShadow: highlightA > 0
                ? `inset 0 0 ${highlightA * 25}px hsl(var(--option-a) / ${highlightA * 0.3})`
                : result?.choice === 'A'
                ? 'inset 0 0 20px hsl(var(--option-a) / 0.3)'
                : 'none',
            }}
          >
            <PollOptionImage
              imageUrl={poll.image_a_url}
              option={poll.option_a}
              question={poll.question}
              side="A"
              maxLogoSize="65%"
              variant="hero"
            />
            {/* Red brand-tinted bottom gradient */}
            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-destructive/85 via-destructive/30 to-transparent pointer-events-none" />

            {highlightA > 0 && (
              <div className="absolute inset-0 border-2 border-option-a/60 pointer-events-none" style={{ opacity: highlightA }} />
            )}

            {result?.choice === 'A' && (
              <div className="absolute inset-0 border-[3px] border-primary pointer-events-none" />
            )}

            {/* Action circle (↑) */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-[22%] z-10">
              <div className="w-12 h-12 rounded-full bg-destructive flex items-center justify-center shadow-lg ring-2 ring-white/40">
                {result?.choice === 'A'
                  ? <Check className="w-6 h-6 text-destructive-foreground" strokeWidth={3} />
                  : <ArrowUp className="w-6 h-6 text-destructive-foreground" strokeWidth={3} />}
              </div>
            </div>

            {/* Label block */}
            <div className="absolute inset-x-0 bottom-3 px-3 text-center">
              <p className="text-white text-base font-extrabold drop-shadow-lg leading-tight">
                {poll.option_a}
              </p>
              {result ? (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-1 inline-block text-xl font-bold text-white drop-shadow-lg"
                >
                  {result.percentA}%
                </motion.span>
              ) : (
                <span className="mt-1.5 inline-block px-3 py-1 rounded-full bg-white/25 backdrop-blur-sm text-white text-[11px] font-medium">
                  Tap to choose
                </span>
              )}
            </div>
          </div>

          {/* Center VS bubble */}
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px] bg-white/40 z-10" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
            <div className="w-11 h-11 rounded-full bg-white shadow-xl flex items-center justify-center">
              <span className="text-[13px] font-extrabold text-foreground tracking-tight">VS</span>
            </div>
          </div>

          {/* Option B — right half */}
          <div
            className="w-1/2 h-full relative overflow-hidden transition-transform duration-200"
            style={{
              transform: highlightB > 0 ? `scale(${1 + highlightB * 0.03})` : 'scale(1)',
              boxShadow: highlightB > 0
                ? `inset 0 0 ${highlightB * 25}px hsl(var(--option-b) / ${highlightB * 0.3})`
                : result?.choice === 'B'
                ? 'inset 0 0 20px hsl(var(--option-b) / 0.3)'
                : 'none',
            }}
          >
            <PollOptionImage
              imageUrl={poll.image_b_url}
              option={poll.option_b}
              question={poll.question}
              side="B"
              maxLogoSize="65%"
              variant="hero"
            />
            {/* Blue brand-tinted bottom gradient */}
            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-primary/85 via-primary/30 to-transparent pointer-events-none" />

            {highlightB > 0 && (
              <div className="absolute inset-0 border-2 border-option-b/60 pointer-events-none" style={{ opacity: highlightB }} />
            )}

            {result?.choice === 'B' && (
              <div className="absolute inset-0 border-[3px] border-primary pointer-events-none" />
            )}

            {/* Action circle (=) */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-[22%] z-10">
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg ring-2 ring-white/40">
                {result?.choice === 'B'
                  ? <Check className="w-6 h-6 text-primary-foreground" strokeWidth={3} />
                  : <Equal className="w-6 h-6 text-primary-foreground" strokeWidth={3} />}
              </div>
            </div>

            <div className="absolute inset-x-0 bottom-3 px-3 text-center">
              <p className="text-white text-base font-extrabold drop-shadow-lg leading-tight">
                {poll.option_b}
              </p>
              {result ? (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-1 inline-block text-xl font-bold text-white drop-shadow-lg"
                >
                  {result.percentB}%
                </motion.span>
              ) : (
                <span className="mt-1.5 inline-block px-3 py-1 rounded-full bg-white/25 backdrop-blur-sm text-white text-[11px] font-medium">
                  Tap to choose
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Result detail strip (after vote) */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="px-4 py-3 border-t border-border/60 bg-card"
            >
              <div className="h-2 bg-secondary rounded-full overflow-hidden flex mb-2">
                <motion.div
                  className="h-full bg-destructive"
                  initial={{ width: '50%' }}
                  animate={{ width: `${result.percentA}%` }}
                  transition={{ duration: 0.7 }}
                />
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: '50%' }}
                  animate={{ width: `${result.percentB}%` }}
                  transition={{ duration: 0.7 }}
                />
              </div>
              {genderTeaser && (
                <p className="text-[11px] text-muted-foreground text-center">{genderTeaser.text}</p>
              )}
              {peopleLikeYou && (
                <p className="text-[11px] text-muted-foreground text-center font-medium mt-0.5">
                  👥 {peopleLikeYou.text}
                </p>
              )}
              <p className="text-[10px] text-muted-foreground/80 text-center mt-1">
                {result.total.toLocaleString()} perspectives{revealMode === 'flash' ? ' · Next loading…' : ''}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Below-card meta: swipe hint, category, skip */}
      {!result && !isVoting && (
        <div className="flex flex-col items-center gap-1.5 mt-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-secondary text-muted-foreground text-xs font-medium">
            ← Swipe or tap to vote →
          </div>
          {poll.category && (
            <CategoryBadge category={mapToVersaCategory(poll.category)} size="xs" />
          )}
          <button
            onClick={submitSkip}
            className="text-xs font-medium text-muted-foreground/80 hover:text-muted-foreground active:scale-95 transition-all px-3 py-1 rounded-full border border-border/40"
          >
            Skip ↑
          </button>
        </div>
      )}

      {/* CinematicResults removed — inline results on the card are used instead */}

      {showHookMoment && (
        <HookMoment
          onJoin={() => {
            setShowHookMoment(false);
            window.location.href = '/auth?mode=signup';
          }}
        />
      )}

      <SharePollToFriendSheet
        pollId={poll.id}
        pollQuestion={poll.question}
        open={showShareSheet}
        onOpenChange={setShowShareSheet}
      />

      {feedbackPrompt && feedbackConfig && (
        <CampaignFeedbackModal
          open={!!feedbackPrompt}
          onClose={() => setFeedbackPrompt(null)}
          pollId={feedbackPrompt.pollId}
          choice={feedbackPrompt.choice}
          optionLabel={feedbackPrompt.optionLabel}
          config={feedbackConfig.config}
        />
      )}
    </section>
  );
}
