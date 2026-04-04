import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getPollDisplayImageSrc, handlePollImageError } from '@/lib/pollImages';
import { playSwipeSound, playResultSound } from '@/lib/sounds';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';

interface HeroPoll {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  image_a_url: string | null;
  image_b_url: string | null;
  category: string | null;
  totalVotes: number;
  percentA: number;
  percentB: number;
}

interface HeroVoteCardProps {
  poll: HeroPoll | null;
  unseenCount: number;
  onVoteComplete?: () => void;
}

const SWIPE_THRESHOLD = 70;
const SWIPE_OUT_MS = 400;
const RESULT_MS = 1500;

export default function HeroVoteCard({ poll, unseenCount, onVoteComplete }: HeroVoteCardProps) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<{ choice: 'A' | 'B'; percentA: number; percentB: number; total: number } | null>(null);
  const [flyDirection, setFlyDirection] = useState<'left' | 'right' | null>(null);
  const [showHint, setShowHint] = useState(true);
  const startX = useRef(0);

  useEffect(() => {
    if (!showHint) return;
    const timer = setTimeout(() => setShowHint(false), 4000);
    return () => clearTimeout(timer);
  }, [showHint]);

  const getAnimationClass = () => {
    if (flyDirection === 'left') return 'animate-swipe-left';
    if (flyDirection === 'right') return 'animate-swipe-right';
    return '';
  };

  const submitVote = useCallback(async (choice: 'A' | 'B') => {
    if (!poll || result) return;

    setFlyDirection(null);
    setDragX(0);
    setResult({ choice, percentA: poll.percentA, percentB: poll.percentB, total: poll.totalVotes });

    if (user) {
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
        return;
      }

      const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: [poll.id] });
      if (results?.[0]) {
        setResult({
          choice,
          percentA: results[0].percent_a,
          percentB: results[0].percent_b,
          total: Number(results[0].total_votes),
        });
      }
    }

    playResultSound();

    queryClient.invalidateQueries({ queryKey: ['user-voted-ids'] });
    queryClient.invalidateQueries({ queryKey: ['unseen-poll-count'] });
    queryClient.invalidateQueries({ queryKey: ['user-vote-count'] });
    queryClient.invalidateQueries({ queryKey: ['visual-feed-home'] });

    setTimeout(() => {
      navigate(`/vote?excludeHero=${poll.id}`);
    }, RESULT_MS);
  }, [navigate, poll, profile, queryClient, result, user]);

  if (!poll) {
    return (
      <section className="px-3 pt-4 pb-2">
        <div className="flex justify-center mb-2">
          <span className="text-xs px-3 py-1 rounded-full bg-muted text-muted-foreground font-medium">
            All caught up — check back tomorrow 🔥
          </span>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card px-6 py-12 text-center shadow-sm">
          <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-display font-bold text-foreground">You've voted on everything!</p>
          <p className="text-xs text-muted-foreground mt-1">New polls drop daily — come back tomorrow</p>
        </div>
      </section>
    );
  }

  const handleStart = (clientX: number) => {
    if (result || flyDirection) return;
    setIsDragging(true);
    startX.current = clientX;
    setShowHint(false);
  };

  const handleMove = (clientX: number) => {
    if (!isDragging || result || flyDirection) return;
    setDragX(clientX - startX.current);
  };

  const handleEnd = () => {
    if (!isDragging || result || flyDirection) return;

    setIsDragging(false);

    if (dragX < -SWIPE_THRESHOLD) {
      playSwipeSound();
      setFlyDirection('left');
      setTimeout(() => submitVote('A'), SWIPE_OUT_MS);
      return;
    }

    if (dragX > SWIPE_THRESHOLD) {
      playSwipeSound();
      setFlyDirection('right');
      setTimeout(() => submitVote('B'), SWIPE_OUT_MS);
      return;
    }

    setDragX(0);
  };

  const imgA = getPollDisplayImageSrc({ imageUrl: poll.image_a_url, option: poll.option_a, question: poll.question, side: 'A' });
  const imgB = getPollDisplayImageSrc({ imageUrl: poll.image_b_url, option: poll.option_b, question: poll.question, side: 'B' });
  const normalizedOffset = Math.min(Math.abs(dragX), 200) / 200;
  const rotation = Math.sign(dragX) * normalizedOffset * 8;
  const highlightA = !result && !flyDirection && dragX < -30 ? Math.min(Math.abs(dragX) / SWIPE_THRESHOLD, 1) : 0;
  const highlightB = !result && !flyDirection && dragX > 30 ? Math.min(dragX / SWIPE_THRESHOLD, 1) : 0;

  return (
    <section className="px-3 pt-4 pb-2">
      <div className="flex justify-center mb-2">
        {unseenCount > 0 ? (
          <motion.span
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-xs px-3 py-1 rounded-full bg-primary text-primary-foreground font-bold"
          >
            {unseenCount} new poll{unseenCount !== 1 ? 's' : ''} waiting
          </motion.span>
        ) : null}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`relative rounded-2xl overflow-hidden border border-border/60 shadow-xl ${!result && !flyDirection ? 'cursor-grab active:cursor-grabbing' : ''} ${getAnimationClass()}`}
        style={{
          transform: flyDirection ? undefined : result ? 'none' : `translateX(${dragX}px) rotate(${rotation}deg)`,
          opacity: flyDirection ? undefined : 1,
          transition: isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.35s ease-out',
          willChange: isDragging || !!flyDirection ? 'transform, opacity' : 'auto',
        }}
        onTouchStart={result ? undefined : (e) => handleStart(e.touches[0].clientX)}
        onTouchMove={result ? undefined : (e) => {
          handleMove(e.touches[0].clientX);
          if (Math.abs(dragX) > 10) e.preventDefault();
        }}
        onTouchEnd={result ? undefined : handleEnd}
        onMouseDown={result ? undefined : (e) => {
          e.preventDefault();
          handleStart(e.clientX);
        }}
        onMouseMove={result ? undefined : (e) => handleMove(e.clientX)}
        onMouseUp={result ? undefined : handleEnd}
        onMouseLeave={result ? undefined : () => isDragging && handleEnd()}
      >
        <div className="flex h-[55vh] max-h-[420px] relative">
          <div
            className="w-1/2 h-full relative overflow-hidden transition-transform duration-200"
            style={{
              transform: highlightA > 0 ? `scale(${1 + highlightA * 0.03})` : 'scale(1)',
              boxShadow: highlightA > 0
                ? `inset 0 0 ${highlightA * 25}px hsl(var(--option-a) / ${highlightA * 0.3})`
                : result?.choice === 'A' ? 'inset 0 0 20px hsl(var(--option-a) / 0.3)' : 'none',
            }}
          >
            <img
              src={imgA}
              alt={poll.option_a}
              className="w-full h-full object-cover bg-muted"
              onError={(e) => handlePollImageError(e, { option: poll.option_a, question: poll.question, side: 'A' })}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            {highlightA > 0 && <div className="absolute inset-0 border-2 border-option-a/60 pointer-events-none" style={{ opacity: highlightA }} />}
            {result?.choice === 'A' && <div className="absolute inset-0 border-2 border-option-a pointer-events-none" />}
            <div className="absolute bottom-3 left-3">
              <p className="text-white text-lg font-extrabold drop-shadow-lg">{poll.option_a}</p>
              {result && (
                <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-2xl font-bold text-option-a drop-shadow-lg block">
                  {result.percentA}%
                </motion.span>
              )}
            </div>
          </div>

          <div className="absolute inset-y-0 left-1/2 w-[2px] bg-white/20 z-10" />

          <div
            className="w-1/2 h-full relative overflow-hidden transition-transform duration-200"
            style={{
              transform: highlightB > 0 ? `scale(${1 + highlightB * 0.03})` : 'scale(1)',
              boxShadow: highlightB > 0
                ? `inset 0 0 ${highlightB * 25}px hsl(var(--option-b) / ${highlightB * 0.3})`
                : result?.choice === 'B' ? 'inset 0 0 20px hsl(var(--option-b) / 0.3)' : 'none',
            }}
          >
            <img
              src={imgB}
              alt={poll.option_b}
              className="w-full h-full object-cover bg-muted"
              onError={(e) => handlePollImageError(e, { option: poll.option_b, question: poll.question, side: 'B' })}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            {highlightB > 0 && <div className="absolute inset-0 border-2 border-option-b/60 pointer-events-none" style={{ opacity: highlightB }} />}
            {result?.choice === 'B' && <div className="absolute inset-0 border-2 border-option-b pointer-events-none" />}
            <div className="absolute bottom-3 right-3 text-right">
              <p className="text-white text-lg font-extrabold drop-shadow-lg">{poll.option_b}</p>
              {result && (
                <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-2xl font-bold text-option-b drop-shadow-lg block">
                  {result.percentB}%
                </motion.span>
              )}
            </div>
          </div>
        </div>

        <div className="absolute top-0 inset-x-0 px-4 pt-4 pb-10 bg-gradient-to-b from-black/70 to-transparent z-10">
          <h2 className="text-white text-xl font-display font-bold drop-shadow-lg text-center leading-snug">{poll.question}</h2>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-0 inset-x-0 z-20 px-4 pb-3 pt-8 bg-gradient-to-t from-black/90 to-transparent"
            >
              <div className="h-2 bg-white/15 rounded-full overflow-hidden flex mb-1.5">
                <motion.div className="h-full bg-option-a rounded-l-full" initial={{ width: '50%' }} animate={{ width: `${result.percentA}%` }} transition={{ duration: 0.7 }} />
                <motion.div className="h-full bg-option-b rounded-r-full" initial={{ width: '50%' }} animate={{ width: `${result.percentB}%` }} transition={{ duration: 0.7 }} />
              </div>
              <p className="text-[10px] text-white/60 text-center">{result.total.toLocaleString()} perspectives · Keep going →</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {!result && showHint && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
              <motion.div animate={{ x: [-20, 20, -20] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}>
                <span className="text-3xl drop-shadow-lg">👆</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {!result && (
        <p className="text-center text-xs text-muted-foreground mt-2">← Swipe to vote →</p>
      )}
    </section>
  );
}
