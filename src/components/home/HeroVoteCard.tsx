import { useState, useRef, useCallback, useEffect } from 'react';
import HotTakeBadge from './HotTakeBadge';
import ControversialBadge from './ControversialBadge';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { playSwipeSound, playResultSound } from '@/lib/sounds';
import PollOptionImage from '@/components/poll/PollOptionImage';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import HeroCaughtUp from './HeroCaughtUp';
import CinematicResults from '@/components/poll/CinematicResults';
import { useGenderSplitTeaser } from '@/hooks/useGenderSplitTeaser';
import { usePeopleLikeYou } from '@/hooks/usePeopleLikeYou';
import { getInsightTier } from '@/lib/streakGating';
import HookMoment from '@/components/onboarding/HookMoment';

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
}

interface HeroVoteCardProps {
  poll: HeroPoll | null;
  unseenCount: number;
  onVoteComplete?: () => void;
  onPollTap?: (poll: any) => void;
}

const SWIPE_THRESHOLD = 50;
const SWIPE_UP_THRESHOLD = 50;
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
    const shouldFullReveal = isMinorityVote || isCloseSplit || firstVoteToday || isMilestone;

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

    // Swipe up = skip
    if (finalDragY < -SWIPE_UP_THRESHOLD && Math.abs(finalDragX) < SWIPE_THRESHOLD) {
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

  return (
    <section className="px-3 pt-4 pb-2">
      {/* Unseen count badge */}
      <div className="flex justify-center mb-2">
        {unseenCount > 0 && (
          <motion.span
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-xs px-3 py-1 rounded-full bg-primary text-primary-foreground font-bold"
          >
            🔥 {unseenCount} battle{unseenCount !== 1 ? 's' : ''} left today
          </motion.span>
        )}
      </div>

      {/* Main card */}
      <motion.div
        ref={cardRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`relative rounded-2xl overflow-hidden border border-border/60 shadow-xl select-none ${
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
        {/* Two-image split */}
        <div className={`flex h-[55vh] max-h-[420px] relative ${poll.is_hot_take ? 'ring-2 ring-[hsl(15,90%,55%)]' : ''}`}>
          {poll.is_hot_take && <HotTakeBadge />}
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
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

            {/* Highlight border while dragging */}
            {highlightA > 0 && (
              <div className="absolute inset-0 border-2 border-option-a/60 pointer-events-none" style={{ opacity: highlightA }} />
            )}

            {/* Vote confirmation: highlight + checkmark */}
            {result?.choice === 'A' && (
              <>
                <div className="absolute inset-0 border-3 border-primary pointer-events-none" />
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
                >
                  <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center shadow-lg">
                    <Check className="w-8 h-8 text-primary-foreground" strokeWidth={3} />
                  </div>
                </motion.div>
              </>
            )}

            <div className="absolute bottom-3 left-3">
              <p className="text-white text-lg font-extrabold drop-shadow-lg">{poll.option_a}</p>
              {result && (
                <>
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-2xl font-bold text-option-a drop-shadow-lg block"
                  >
                    {result.percentA}%
                  </motion.span>
                  {result.choice === 'A' && (
                    <motion.span
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-[10px] text-primary-foreground font-semibold"
                    >
                      Your choice ✓
                    </motion.span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Center divider */}
          <div className="absolute inset-y-0 left-1/2 w-[2px] bg-white/20 z-10" />

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
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

            {highlightB > 0 && (
              <div className="absolute inset-0 border-2 border-option-b/60 pointer-events-none" style={{ opacity: highlightB }} />
            )}

            {result?.choice === 'B' && (
              <>
                <div className="absolute inset-0 border-3 border-primary pointer-events-none" />
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
                >
                  <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center shadow-lg">
                    <Check className="w-8 h-8 text-primary-foreground" strokeWidth={3} />
                  </div>
                </motion.div>
              </>
            )}

            <div className="absolute bottom-3 right-3 text-right">
              <p className="text-white text-lg font-extrabold drop-shadow-lg">{poll.option_b}</p>
              {result && (
                <>
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-2xl font-bold text-option-b drop-shadow-lg block"
                  >
                    {result.percentB}%
                  </motion.span>
                  {result.choice === 'B' && (
                    <motion.span
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-[10px] text-primary-foreground font-semibold"
                    >
                      Your choice ✓
                    </motion.span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Question overlay at top */}
        <div className="absolute top-0 inset-x-0 px-4 pt-4 pb-10 bg-gradient-to-b from-black/70 to-transparent z-10 pointer-events-none">
          <h2 className="text-white text-xl font-display font-bold drop-shadow-lg text-center leading-snug">
            {poll.question}
          </h2>
          {poll.subtitle && (
            <p className="text-white/70 text-sm font-medium text-center mt-0.5 drop-shadow">
              {poll.subtitle}
            </p>
          )}
        </div>

        {/* Result bar overlay */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-0 inset-x-0 z-20 px-4 pb-3 pt-8 bg-gradient-to-t from-black/90 to-transparent"
            >
              {/* Minority moment badge */}
              {isMinority && revealMode === 'full' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className="mb-2 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-center"
                >
                  <p className="text-[11px] font-bold text-amber-300">
                    You're in the bold minority 💡 Only {result.choice === 'A' ? result.percentA : result.percentB}% chose this
                  </p>
                </motion.div>
              )}

              {/* First vote of the day */}
              {isFirstVoteOfDay && revealMode === 'full' && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="mb-2 text-center"
                >
                  <p className="text-[11px] font-medium text-emerald-300">
                    First vote of the day ✅ Keep the streak alive
                  </p>
                </motion.div>
              )}

              <div className="h-2 bg-white/15 rounded-full overflow-hidden flex mb-1.5">
                <motion.div
                  className="h-full bg-option-a rounded-l-full"
                  initial={{ width: '50%' }}
                  animate={{ width: `${result.percentA}%` }}
                  transition={{ duration: 0.7 }}
                />
                <motion.div
                  className="h-full bg-option-b rounded-r-full"
                  initial={{ width: '50%' }}
                  animate={{ width: `${result.percentB}%` }}
                  transition={{ duration: 0.7 }}
                />
              </div>

              {/* Gender teaser */}
              {genderTeaser && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-[11px] text-white/80 text-center"
                >
                  {genderTeaser.text}
                </motion.p>
              )}

              {/* Flash mode: quick one-liner */}
              {revealMode === 'flash' && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-[10px] text-white/60 text-center"
                >
                  {result.total.toLocaleString()} perspectives · Next loading...
                </motion.p>
              )}

              {/* Full reveal mode hint */}
              {revealMode === 'full' && (
                <p className="text-[10px] text-white/60 text-center">
                  {result.total.toLocaleString()} perspectives
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Swipe hint animation */}
        <AnimatePresence>
          {!result && !isVoting && showHint && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
            >
              <motion.div
                animate={{ x: [-20, 20, -20] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <span className="text-3xl drop-shadow-lg">👆</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Bottom hints */}
      {!result && !isVoting && (
        <div className="flex flex-col items-center gap-1 mt-2">
          <p className="text-center text-xs text-muted-foreground">← Tap or swipe to vote →</p>
          <button
            onClick={submitSkip}
            className="text-sm font-medium text-muted-foreground/80 hover:text-muted-foreground active:scale-95 transition-all px-4 py-1.5 rounded-full border border-border/40"
          >
            Skip ↑
          </button>
        </div>
      )}

      {/* Cinematic Results — only in Full Reveal mode */}
      {poll && cinematicData && revealMode === 'full' && (
        <CinematicResults
          poll={poll}
          choice={cinematicData.choice}
          percentA={cinematicData.percentA}
          percentB={cinematicData.percentB}
          totalVotes={cinematicData.totalVotes}
          visible={!!cinematicData}
          onNext={() => {
            setCinematicData(null);
            setResult(null);
            setIsVoting(false);
            setIsMinority(false);
            setIsFirstVoteOfDay(false);
            setRevealMode(null);
            setShowHint(true);
            onVoteComplete?.();
          }}
        />
      )}

      {showHookMoment && (
        <HookMoment
          onJoin={() => {
            setShowHookMoment(false);
            window.location.href = '/auth?mode=signup';
          }}
        />
      )}
    </section>
  );
}
