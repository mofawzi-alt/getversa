import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { X, Flame, Users } from 'lucide-react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { playSwipeSound, playResultSound, playMinoritySound } from '@/lib/sounds';
import { AnimatedPercent } from '@/components/feed/VoteFeedbackOverlay';

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

const CAMPAIGN_LABELS: Record<string, { emoji: string; label: string }> = {
  'Telecom': { emoji: '📱', label: 'Telecom Wars' },
  'Food': { emoji: '🍰', label: 'Food Face-Off' },
  'Ramadan': { emoji: '🌙', label: 'Ramadan Season' },
  'Entertainment': { emoji: '🎬', label: 'Series Battle' },
  'Sports': { emoji: '⚽', label: 'Sports Clash' },
  'Fashion': { emoji: '👗', label: 'Style Wars' },
  'Tech': { emoji: '💻', label: 'Tech Debate' },
  'Travel': { emoji: '✈️', label: 'Travel Pick' },
  'Music': { emoji: '🎵', label: 'Music Showdown' },
  'Gaming': { emoji: '🎮', label: 'Game On' },
};

function getCampaignLabel(category: string | null) {
  if (!category) return { emoji: '🔥', label: 'Live Now' };
  return CAMPAIGN_LABELS[category] || { emoji: '🔥', label: category };
}

function triggerHaptic(intensity: 'light' | 'medium' = 'light') {
  if (!navigator.vibrate) return;
  navigator.vibrate(intensity === 'light' ? 15 : 40);
}

const SUSPENSE_MS = 500;
const RESULT_MS = 1500;
const THRESHOLD = 90;

interface Poll {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  category: string | null;
  image_a_url: string | null;
  image_b_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
}

interface VoteResult {
  choice: 'A' | 'B';
  percentA: number;
  percentB: number;
  totalVotes: number;
}

export default function LiveDebate() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const startPollId = searchParams.get('pollId');

  const [currentIndex, setCurrentIndex] = useState(0);
  const [result, setResult] = useState<VoteResult | null>(null);
  const [phase, setPhase] = useState<'swipe' | 'suspense' | 'result'>('swipe');
  const [exitDragY, setExitDragY] = useState(0);
  const [isDraggingExit, setIsDraggingExit] = useState(false);

  const streakData = profile ? {
    current: (profile as any).current_streak as number || 0,
    votedToday: (profile as any).last_vote_date === new Date().toISOString().split('T')[0],
  } : null;

  // Fetch ALL live polls (not filtered by voted status)
  const { data: livePolls, isLoading } = useQuery({
    queryKey: ['live-debate-polls', user?.id],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data: polls } = await supabase.from('polls')
        .select('id, question, option_a, option_b, category, image_a_url, image_b_url, starts_at, ends_at')
        .eq('is_active', true)
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .or(`ends_at.is.null,ends_at.gt.${now}`)
        .order('created_at', { ascending: false })
        .limit(50);

      let allPolls = (polls || []) as Poll[];
      let votedChoices = new Map<string, string>();

      if (user) {
        const { data: votes } = await supabase.from('votes').select('poll_id, choice').eq('user_id', user.id);
        votedChoices = new Map(votes?.map(v => [v.poll_id, v.choice]) || []);
      }

      // Sort: unvoted first, then voted — but keep all visible
      const unvoted = allPolls.filter(p => !votedChoices.has(p.id));
      const voted = allPolls.filter(p => votedChoices.has(p.id));

      // Move target poll to front if specified
      let sorted = [...unvoted, ...voted];
      if (startPollId) {
        const idx = sorted.findIndex(p => p.id === startPollId);
        if (idx > 0) {
          const [t] = sorted.splice(idx, 1);
          sorted.unshift(t);
        } else if (idx === -1) {
          // Target poll not in initial batch — fetch it directly
          const { data: targetPoll } = await supabase
            .from('polls')
            .select('id, question, option_a, option_b, category, image_a_url, image_b_url, starts_at, ends_at')
            .eq('id', startPollId)
            .eq('is_active', true)
            .single();
          if (targetPoll) {
            sorted.unshift(targetPoll as Poll);
            // Check if user already voted on it
            if (user) {
              const { data: existingVote } = await supabase.from('votes').select('choice').eq('poll_id', startPollId).eq('user_id', user.id).maybeSingle();
              if (existingVote) votedChoices.set(startPollId, existingVote.choice);
            }
          }
        }
      }

      return { polls: sorted, votedChoices };
    },
  });

  const polls = livePolls?.polls || [];
  const votedChoices = livePolls?.votedChoices || new Map<string, string>();
  const currentPoll = polls[currentIndex];
  const hasMore = currentIndex < polls.length - 1;
  const currentPollIsVoted = currentPoll ? votedChoices.has(currentPoll.id) : false;

  // If the current poll was already voted on, show results immediately (no swipe)
  useEffect(() => {
    if (!currentPoll || phase !== 'swipe' || !currentPollIsVoted) return;
    const prevChoice = votedChoices.get(currentPoll.id);
    if (!prevChoice) return;
    
    supabase.from('votes').select('choice').eq('poll_id', currentPoll.id).then(({ data: votes }) => {
      const total = votes?.length || 0;
      const aVotes = votes?.filter(v => v.choice === 'A').length || 0;
      const percentA = total > 0 ? Math.round((aVotes / total) * 100) : 0;
      setResult({ choice: prevChoice as 'A' | 'B', percentA, percentB: 100 - percentA, totalVotes: total });
      setPhase('result');
    });
  }, [currentPoll?.id, phase]);

  // Preload next 3 images
  useEffect(() => {
    for (let i = 1; i <= 3; i++) {
      const p = polls[currentIndex + i];
      if (!p) break;
      const imgA = p.image_a_url || getFallbackImage(p.id, 0);
      const imgB = p.image_b_url || getFallbackImage(p.id, 1);
      const a = new Image(); a.src = imgA;
      const b = new Image(); b.src = imgB;
    }
  }, [currentIndex, polls]);

  const voteMutation = useMutation({
    mutationFn: async ({ pollId, choice }: { pollId: string; choice: 'A' | 'B' }) => {
      if (!user) throw new Error('Not authenticated');
      const currentPoll = polls?.find(p => p.id === pollId);
      const { error } = await supabase.from('votes').insert({
        poll_id: pollId,
        user_id: user.id,
        choice,
        voter_country: profile?.country || null,
        voter_age_range: profile?.age_range || null,
        voter_gender: profile?.gender || null,
        voter_city: profile?.city || null,
        category: currentPoll?.category || null,
      } as any);
      if (error) throw error;
      const { data: votes } = await supabase.from('votes').select('choice').eq('poll_id', pollId);
      const total = votes?.length || 0;
      const aVotes = votes?.filter(v => v.choice === 'A').length || 0;
      const percentA = total > 0 ? Math.round((aVotes / total) * 100) : 0;
      return { choice, percentA, percentB: 100 - percentA, totalVotes: total };
    },
    onSuccess: (data) => {
      setResult(data);
      // Suspense phase
      setPhase('suspense');
      setTimeout(() => {
        setPhase('result');
        playResultSound();
        // Minority haptic
        const userPct = data.choice === 'A' ? data.percentA : data.percentB;
        if (userPct < 40) {
          playMinoritySound();
          triggerHaptic('medium');
        }
      }, SUSPENSE_MS);

      // Auto-advance after result display (or auto-return home if last poll)
      setTimeout(() => {
        if (hasMore) {
          setCurrentIndex(prev => prev + 1);
          setResult(null);
          setPhase('swipe');
        } else {
          navigate('/home');
        }
      }, SUSPENSE_MS + RESULT_MS);

      queryClient.invalidateQueries({ queryKey: ['visual-feed-home'] });
      queryClient.invalidateQueries({ queryKey: ['user-voted-ids'] });
      queryClient.invalidateQueries({ queryKey: ['feed-polls'] });
    },
  });

  const handleVote = useCallback((choice: 'A' | 'B') => {
    if (!currentPoll || phase !== 'swipe') return;
    playSwipeSound();
    triggerHaptic('light');
    voteMutation.mutate({ pollId: currentPoll.id, choice });
  }, [currentPoll, phase, voteMutation]);

  const handleExit = useCallback(() => {
    navigate('/home');
  }, [navigate]);

  // Swipe-down to exit
  const handleExitDragEnd = useCallback((_: any, info: PanInfo) => {
    setIsDraggingExit(false);
    setExitDragY(0);
    if (info.offset.y > 150 || info.velocity.y > 500) {
      handleExit();
    }
  }, [handleExit]);

  // Horizontal swipe navigation (result phase only)
  const navSwipeRef = useRef(0);
  const handleNavSwipeStart = useCallback((clientX: number) => {
    if (phase !== 'result' || !currentPollIsVoted) return;
    navSwipeRef.current = clientX;
  }, [phase, currentPollIsVoted]);
  const handleNavSwipeEnd = useCallback((clientX: number) => {
    if (phase !== 'result' || !currentPollIsVoted) return;
    const delta = clientX - navSwipeRef.current;
    const SWIPE_THRESHOLD = 80;
    if (delta < -SWIPE_THRESHOLD && hasMore) {
      // Swipe left → next
      setCurrentIndex(prev => prev + 1); setResult(null); setPhase('swipe');
    } else if (delta > SWIPE_THRESHOLD && currentIndex > 0) {
      // Swipe right → previous
      setCurrentIndex(prev => prev - 1); setResult(null); setPhase('swipe');
    }
    navSwipeRef.current = 0;
  }, [phase, currentPollIsVoted, hasMore, currentIndex]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center">
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-sm font-display font-bold text-muted-foreground"
        >
          Loading debates...
        </motion.div>
      </div>
    );
  }

  if (!currentPoll) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-lg font-display font-bold text-foreground">No live debates right now</p>
        <p className="text-sm text-muted-foreground text-center">Check back soon for new ones.</p>
        <button onClick={handleExit} className="mt-4 px-6 py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm">
          Back to Home
        </button>
      </div>
    );
  }

  const imgA = currentPoll.image_a_url || getFallbackImage(currentPoll.id, 0);
  const imgB = currentPoll.image_b_url || getFallbackImage(currentPoll.id, 1);
  const campaignLabel = getCampaignLabel(currentPoll.category);
  const showResult = phase === 'result' && result;

  return (
    <motion.div
      className="fixed inset-0 z-[100] bg-black flex flex-col overflow-hidden"
      style={{ y: exitDragY }}
      drag={phase === 'swipe' ? 'y' : undefined}
      dragConstraints={{ top: 0, bottom: 200 }}
      dragElastic={0.3}
      onDrag={(_, info) => { setExitDragY(info.offset.y > 0 ? info.offset.y : 0); setIsDraggingExit(info.offset.y > 30); }}
      onDragEnd={handleExitDragEnd}
      onTouchStart={(e) => handleNavSwipeStart(e.touches[0].clientX)}
      onTouchEnd={(e) => handleNavSwipeEnd(e.changedTouches[0].clientX)}
      onMouseDown={(e) => handleNavSwipeStart(e.clientX)}
      onMouseUp={(e) => handleNavSwipeEnd(e.clientX)}
    >
      {/* Minimal top bar */}
      <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-4 pt-[env(safe-area-inset-top,12px)] pb-2">
        <button
          onClick={handleExit}
          className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center"
        >
          <X className="h-4 w-4 text-white" />
        </button>

        {/* Campaign tag */}
        <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-white text-[10px] font-bold">
          {campaignLabel.emoji} {campaignLabel.label}
        </span>

        {/* Streak */}
        {streakData && streakData.current > 0 && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-md">
            <Flame className="h-3 w-3 text-orange-400" />
            <span className="text-[10px] font-bold text-white">{streakData.current}</span>
          </div>
        )}
        {!streakData?.current && <div className="w-9" />}
      </div>

      {/* Swipe-down hint */}
      <AnimatePresence>
        {isDraggingExit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-md"
          >
            <span className="text-white text-xs font-bold">↓ Release to exit</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full-screen debate card */}
      <FullScreenCard
        key={currentPoll.id}
        poll={currentPoll}
        imgA={imgA}
        imgB={imgB}
        onVote={handleVote}
        phase={phase}
        result={result}
        disabled={voteMutation.isPending}
        isVotedPoll={currentPollIsVoted}
      />

      {/* Remaining count & navigation */}
      <div className="absolute bottom-[env(safe-area-inset-bottom,8px)] inset-x-0 z-30 flex justify-center pb-2">
        {phase === 'swipe' && !currentPollIsVoted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-1"
          >
            <span className="text-white/30 text-[9px] font-medium">
              ← {currentPoll.option_a.slice(0, 10)}{currentPoll.option_a.length > 10 ? '…' : ''} · {currentPoll.option_b.slice(0, 10)}{currentPoll.option_b.length > 10 ? '…' : ''} →
            </span>
            <span className="text-white/20 text-[8px]">
              {polls.length - currentIndex - 1} more debates
            </span>
          </motion.div>
        )}

        {/* For voted polls in result view — show Next/Exit buttons */}
        {phase === 'result' && currentPollIsVoted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-2"
          >
            <div className="flex items-center gap-3">
              {currentIndex > 0 && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { setCurrentIndex(prev => prev - 1); setResult(null); setPhase('swipe'); }}
                  className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-display font-bold shadow-glow tracking-wide"
                >
                  ← Previous
                </motion.button>
              )}
              {hasMore ? (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { setCurrentIndex(prev => prev + 1); setResult(null); setPhase('swipe'); }}
                  className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-display font-bold shadow-glow tracking-wide"
                >
                  Next Insight →
                </motion.button>
              ) : (
                <button onClick={handleExit} className="px-5 py-2 rounded-full bg-white/15 text-white text-xs font-bold backdrop-blur-md">
                  Back to Home
                </button>
              )}
            </div>
            <span className="text-white/30 text-[8px]">
              {currentIndex > 0 ? '← swipe right for previous' : ''}{currentIndex > 0 && hasMore ? ' · ' : ''}{hasMore ? 'swipe left for next →' : ''}
            </span>
          </motion.div>
        )}
      </div>

      {/* All caught up — only for freshly voted polls */}
      <AnimatePresence>
        {phase === 'result' && !hasMore && !currentPollIsVoted && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: RESULT_MS / 1000 }}
            className="absolute bottom-20 inset-x-0 z-40 flex flex-col items-center gap-2"
          >
            <p className="text-white text-sm font-display font-bold">All caught up! 🎉</p>
            <button onClick={handleExit} className="px-5 py-2 rounded-full bg-white/15 text-white text-xs font-bold backdrop-blur-md">
              Back to Home
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Full-Screen Swipeable Card ──
function FullScreenCard({
  poll,
  imgA,
  imgB,
  onVote,
  phase,
  result,
  disabled,
  isVotedPoll,
}: {
  poll: Poll;
  imgA: string;
  imgB: string;
  onVote: (choice: 'A' | 'B') => void;
  phase: 'swipe' | 'suspense' | 'result';
  result: VoteResult | null;
  disabled: boolean;
  isVotedPoll: boolean;
}) {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [flyDir, setFlyDir] = useState<'left' | 'right' | null>(null);
  const startX = useRef(0);

  const canSwipe = phase === 'swipe' && !disabled && !flyDir && !isVotedPoll;

  const handleStart = (clientX: number) => {
    if (!canSwipe) return;
    setIsDragging(true);
    startX.current = clientX;
  };
  const handleMove = (clientX: number) => {
    if (!isDragging) return;
    setDragX(clientX - startX.current);
  };
  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragX < -THRESHOLD) {
      setFlyDir('left');
      setTimeout(() => onVote('A'), 200);
    } else if (dragX > THRESHOLD) {
      setFlyDir('right');
      setTimeout(() => onVote('B'), 200);
    } else {
      setDragX(0);
    }
  };

  // Reset on new poll
  useEffect(() => {
    setDragX(0);
    setFlyDir(null);
    setIsDragging(false);
  }, [poll.id]);

  const normalizedDrag = Math.min(Math.abs(dragX), 200) / 200;
  const rotation = flyDir
    ? (flyDir === 'left' ? -20 : 20)
    : Math.sign(dragX) * normalizedDrag * 10;
  const translateX = flyDir
    ? (flyDir === 'left' ? -window.innerWidth * 1.5 : window.innerWidth * 1.5)
    : dragX;
  const cardScale = isDragging ? 1 - normalizedDrag * 0.03 : 1;

  // Glow
  const glowColor = dragX > 30
    ? `0 0 ${normalizedDrag * 60}px hsl(145 63% 42% / ${normalizedDrag * 0.5})`
    : dragX < -30
    ? `0 0 ${normalizedDrag * 60}px hsl(0 84% 60% / ${normalizedDrag * 0.5})`
    : 'none';

  const choiceOpacity = Math.min(Math.abs(dragX) / THRESHOLD, 1);
  const showA = dragX < -20;
  const showB = dragX > 20;

  const showResult = phase === 'result' && result;
  const winnerIsA = result ? result.percentA >= result.percentB : true;
  const userPct = result ? (result.choice === 'A' ? result.percentA : result.percentB) : 0;
  const isMinority = result ? userPct < 40 : false;

  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ perspective: '1200px' }}>
      {/* Choice indicators */}
      {canSwipe && (
        <>
          <motion.div
            animate={{ opacity: showA ? choiceOpacity : 0 }}
            className="absolute left-6 top-1/2 -translate-y-1/2 z-20"
          >
            <div className="w-16 h-16 rounded-full bg-option-a/20 border-2 border-option-a/60 flex items-center justify-center backdrop-blur-sm">
              <span className="text-option-a font-bold text-lg">A</span>
            </div>
          </motion.div>
          <motion.div
            animate={{ opacity: showB ? choiceOpacity : 0 }}
            className="absolute right-6 top-1/2 -translate-y-1/2 z-20"
          >
            <div className="w-16 h-16 rounded-full bg-option-b/20 border-2 border-option-b/60 flex items-center justify-center backdrop-blur-sm">
              <span className="text-option-b font-bold text-lg">B</span>
            </div>
          </motion.div>
        </>
      )}

      {/* The card — edge to edge */}
      <div
        className="absolute inset-0 z-10"
        style={{
          transform: phase !== 'swipe' && !flyDir
            ? 'none'
            : `translateX(${translateX}px) rotateZ(${rotation}deg) scale(${cardScale})`,
          transition: isDragging ? 'none' : flyDir ? 'transform 0.3s ease-in, opacity 0.25s' : 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          opacity: flyDir ? 0 : 1,
          boxShadow: phase === 'swipe' ? glowColor : 'none',
          transformStyle: 'preserve-3d',
        }}
        onTouchStart={(e) => handleStart(e.touches[0].clientX)}
        onTouchMove={(e) => { handleMove(e.touches[0].clientX); if (Math.abs(dragX) > 10) e.preventDefault(); }}
        onTouchEnd={handleEnd}
        onMouseDown={(e) => { e.preventDefault(); handleStart(e.clientX); }}
        onMouseMove={(e) => handleMove(e.clientX)}
        onMouseUp={handleEnd}
        onMouseLeave={() => isDragging && handleEnd()}
      >
        {/* Split images — full screen */}
        <div className="flex h-full w-full">
          <div className="w-1/2 h-full relative overflow-hidden">
            <img src={imgA} alt={poll.option_a} className="w-full h-full object-contain bg-muted" draggable={false} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
            <div className="absolute bottom-24 left-4 right-1">
              <p className="text-white text-lg font-bold drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">{poll.option_a}</p>
            </div>
          </div>
          <div className="absolute inset-y-0 left-1/2 w-[2px] bg-white/20 z-10" />
          <div className="w-1/2 h-full relative overflow-hidden">
            <img src={imgB} alt={poll.option_b} className="w-full h-full object-contain bg-muted" draggable={false} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
            <div className="absolute bottom-24 left-1 right-4 text-right">
              <p className="text-white text-lg font-bold drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">{poll.option_b}</p>
            </div>
          </div>
        </div>

        {/* Question overlay at top */}
        <div className="absolute top-16 inset-x-0 px-6 z-20 pointer-events-none">
          <p className="text-white text-xl font-display font-bold drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] text-center leading-snug">{poll.question}</p>
        </div>

        {/* Suspense loading */}
        {phase === 'suspense' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
              className="w-14 h-14 rounded-full bg-white/15 border-2 border-white/30 flex items-center justify-center"
            >
              <span className="text-white text-xl font-bold">?</span>
            </motion.div>
          </motion.div>
        )}

        {/* CENTERED Result overlay */}
        <AnimatePresence>
          {showResult && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-0 z-40 flex items-end justify-center pb-32 bg-gradient-to-t from-black/80 via-black/30 to-transparent"
            >
              <div className="flex flex-col items-center gap-4 max-w-xs px-6">
                {/* Percentages */}
                <div className="flex items-center gap-8">
                  <div className="flex flex-col items-center">
                    <span className={`text-4xl font-bold ${result!.choice === 'A' ? 'text-option-a' : 'text-white/70'}`}>
                      <AnimatedPercent target={result!.percentA} delay={0} />
                    </span>
                    <span className="text-white/50 text-xs mt-1">{poll.option_a}</span>
                    {result!.choice === 'A' && <span className="text-option-a text-[10px] font-bold mt-0.5">Your vote</span>}
                  </div>
                  <div className="w-px h-16 bg-white/20" />
                  <div className="flex flex-col items-center">
                    <span className={`text-4xl font-bold ${result!.choice === 'B' ? 'text-option-b' : 'text-white/70'}`}>
                      <AnimatedPercent target={result!.percentB} delay={100} />
                    </span>
                    <span className="text-white/50 text-xs mt-1">{poll.option_b}</span>
                    {result!.choice === 'B' && <span className="text-option-b text-[10px] font-bold mt-0.5">Your vote</span>}
                  </div>
                </div>

                {/* Animated bar */}
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden flex">
                  <motion.div
                    initial={{ width: '50%' }}
                    animate={{ width: `${result!.percentA}%` }}
                    transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="h-full bg-option-a rounded-l-full"
                  />
                  <motion.div
                    initial={{ width: '50%' }}
                    animate={{ width: `${result!.percentB}%` }}
                    transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="h-full bg-option-b rounded-r-full"
                  />
                </div>

                {/* Vote count */}
                <span className="text-white/40 text-xs flex items-center gap-1">
                  <Users className="h-3 w-3" /> {result!.totalVotes} perspectives
                </span>

                {/* Minority badge */}
                {isMinority && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="px-4 py-1.5 rounded-full bg-white/10 border border-white/10"
                  >
                    <span className="text-white text-xs font-bold">You're in the {userPct}% 👀</span>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
