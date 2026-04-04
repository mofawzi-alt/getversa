import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Home, Users, TrendingUp as TrendUp, Zap, Flame } from 'lucide-react';
import CaughtUpInsights from '@/components/feed/CaughtUpInsights';
import VoteFeedbackOverlay, { AnimatedPercent } from '@/components/feed/VoteFeedbackOverlay';
import ShareImageCard from '@/components/poll/ShareImageCard';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { playSwipeSound, playResultSound, playMinoritySound, playMilestoneSound } from '@/lib/sounds';
import VoteProgressIndicator from '@/components/onboarding/VoteProgressIndicator';
import { isExploreUnlocked, markExploreUnlocked } from '@/components/onboarding/ExploreUnlockPopup';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { getPollDisplayImageSrc, handlePollImageError } from '@/lib/pollImages';
import PWAInstallPrompt, { markFirstVote } from '@/components/PWAInstallPrompt';
import SwipeOverlay, { isSwipeOverlayDone, markSwipeOverlayDone } from '@/components/onboarding/SwipeOverlay';
import SwipeHint, { isSwipeHintDone } from '@/components/onboarding/SwipeHint';

const GUEST_VOTE_LIMIT = 3;
const GUEST_VOTES_KEY = 'versa_guest_votes';
const RESULT_DISPLAY_MS = 1800;
const MICRO_FEEDBACK_INTERVAL = 5;
const SUSPENSE_DELAY_MS = 500;
const HIGH_STAKES_INTERVAL = 20;

// Milestone definitions
const MILESTONES: { at: number; message: string; type: 'banner' | 'modal' | 'badge'; duration: number }[] = [
  { at: 10, message: "🔥 You're on a roll", type: 'banner', duration: 1500 },
  { at: 25, message: '', type: 'modal', duration: 3000 },
  { at: 50, message: "You're in the top 15% most active voters today.", type: 'badge', duration: 2000 },
];

function getGuestVoteCount(): number {
  try { return parseInt(localStorage.getItem(GUEST_VOTES_KEY) || '0', 10); } catch { return 0; }
}
function incrementGuestVotes(): number {
  const count = getGuestVoteCount() + 1;
  localStorage.setItem(GUEST_VOTES_KEY, String(count));
  return count;
}

// Haptic feedback helper
function triggerHaptic(intensity: 'light' | 'medium' = 'light') {
  if (!navigator.vibrate) return;
  navigator.vibrate(intensity === 'light' ? 15 : 40);
}

// Campaign label mapping from category
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

function getCampaignLabel(category: string | null): { emoji: string; label: string } {
  if (!category) return { emoji: '🔥', label: 'Live Now' };
  return CAMPAIGN_LABELS[category] || { emoji: '🔥', label: category };
}

// Micro-feedback messages
const ALIGNMENT_MESSAGES = [
  "You align with {pct}% of {city}.",
  "{pct}% of {city} voters agree with you.",
  "You think like {pct}% of people in {city}.",
  "Your taste matches {pct}% of {city}.",
];

interface Poll {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  category: string | null;
  image_a_url: string | null;
  image_b_url: string | null;
  is_sponsored?: boolean;
  sponsor_name?: string;
  sponsor_logo_url?: string;
  starts_at?: string | null;
  ends_at?: string | null;
  is_daily_poll?: boolean;
  created_by?: string | null;
  creator_username?: string | null;
}

interface VoteResult {
  pollId: string;
  choice: 'A' | 'B';
  percentA: number;
  percentB: number;
  totalVotes: number;
}

// ── Full-Screen Immersive Poll Card ──
function ImmersivePollCard({
  poll,
  result,
  onVote,
  onSkip,
  disabled,
  showFeedback,
  isHighStakes,
  rareEvent,
  userCountry,
  sessionVoteCount,
}: {
  poll: Poll;
  result: VoteResult | null;
  onVote: (pollId: string, choice: 'A' | 'B') => void;
  onSkip: (pollId: string) => void;
  disabled: boolean;
  showFeedback: boolean;
  isHighStakes?: boolean;
  rareEvent?: string | null;
  userCountry?: string | null;
  sessionVoteCount?: number;
}) {
  const navigate = useNavigate();
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [flyDirection, setFlyDirection] = useState<'left' | 'right' | 'up' | null>(null);
  const [showSuspense, setShowSuspense] = useState(false);
  const [showMinorityBadge, setShowMinorityBadge] = useState(false);
  const [showShiftMsg, setShowShiftMsg] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const hasResult = !!result;
  const imgA = getPollDisplayImageSrc({ imageUrl: poll.image_a_url, option: poll.option_a, question: poll.question, side: 'A' });
  const imgB = getPollDisplayImageSrc({ imageUrl: poll.image_b_url, option: poll.option_b, question: poll.question, side: 'B' });
  const winnerIsA = result ? result.percentA >= result.percentB : true;
  const THRESHOLD = 80;

  const handleStart = (clientX: number, clientY: number) => {
    if (hasResult || disabled || flyDirection) return;
    setIsDragging(true);
    startX.current = clientX;
    startY.current = clientY;
  };
  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    const dx = clientX - startX.current;
    const dy = clientY - startY.current;
    // Determine primary axis: if vertical movement dominates, track Y
    if (Math.abs(dy) > Math.abs(dx) && dy < -20) {
      setDragY(dy);
      setDragX(0);
    } else {
      setDragX(dx);
      setDragY(0);
    }
  };
  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragY < -THRESHOLD) {
      // Swipe up = skip
      setFlyDirection('up');
      triggerHaptic('light');
      setTimeout(() => onSkip(poll.id), 300);
    } else if (dragX < -THRESHOLD) {
      setFlyDirection('left');
      triggerHaptic('light');
      setTimeout(() => onVote(poll.id, 'A'), 300);
    } else if (dragX > THRESHOLD) {
      setFlyDirection('right');
      triggerHaptic('light');
      setTimeout(() => onVote(poll.id, 'B'), 300);
    }
    if (Math.abs(dragX) <= THRESHOLD && dragY >= -THRESHOLD) {
      setDragX(0);
      setDragY(0);
    }
  };

  // Suspense delay before showing results
  useEffect(() => {
    if (!result) return;
    setShowSuspense(true);
    setFlyDirection(null);
    const timer = setTimeout(() => setShowSuspense(false), SUSPENSE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [result]);

  // Minority trigger
  useEffect(() => {
    if (!result || showSuspense) return;
    const userPercent = result.choice === 'A' ? result.percentA : result.percentB;
    if (userPercent < 40) {
      playMinoritySound();
      triggerHaptic('medium');
      setShowMinorityBadge(true);
      const t = setTimeout(() => setShowMinorityBadge(false), 2000);
      return () => clearTimeout(t);
    }
  }, [result, showSuspense]);

  // Majority power trigger — if close to 50/50
  useEffect(() => {
    if (!result || showSuspense) return;
    const diff = Math.abs(result.percentA - result.percentB);
    if (diff <= 6 && result.totalVotes > 5) {
      setShowShiftMsg(true);
      const t = setTimeout(() => setShowShiftMsg(false), 2000);
      return () => clearTimeout(t);
    }
  }, [result, showSuspense]);

  // 3D tilt + scale calculations
  const normalizedDrag = Math.min(Math.abs(dragX), 200) / 200;
  const normalizedDragY = Math.min(Math.abs(dragY), 200) / 200;
  const rotation = flyDirection
    ? (flyDirection === 'left' ? -15 : flyDirection === 'right' ? 15 : 0)
    : Math.sign(dragX) * normalizedDrag * 12;
  const tiltY = Math.sign(dragX) * normalizedDrag * 8;
  const cardScale = isDragging ? 1 - Math.max(normalizedDrag, normalizedDragY) * 0.05 : 1;

  const translateX = flyDirection === 'left' ? -window.innerWidth * 1.5
    : flyDirection === 'right' ? window.innerWidth * 1.5
    : flyDirection === 'up' ? 0
    : dragX;
  const translateY = flyDirection === 'up' ? -window.innerHeight : Math.min(dragY, 0);

  const choiceOpacity = Math.min(Math.abs(dragX) / THRESHOLD, 1);
  const showA = dragX < -20;
  const showB = dragX > 20;

  // Color glow feedback: green for right, red for left
  const glowColor = dragX > 30
    ? `0 0 ${normalizedDrag * 40}px hsl(145 63% 42% / ${normalizedDrag * 0.4})`
    : dragX < -30
    ? `0 0 ${normalizedDrag * 40}px hsl(0 84% 60% / ${normalizedDrag * 0.4})`
    : 'none';

  const selectedGlow = result?.choice === 'A'
    ? 'shadow-[inset_0_0_30px_rgba(120,255,120,0.15)]'
    : result?.choice === 'B'
    ? 'shadow-[inset_0_0_30px_rgba(255,200,60,0.15)]'
    : '';

  const campaignLabel = getCampaignLabel(poll.category);

  const showResults = hasResult && !showSuspense;

  return (
    <div className={`w-full relative flex flex-col ${isHighStakes ? 'scale-[1.02]' : ''}`}>
      {/* Campaign label */}
      <div className="flex justify-center mb-1.5 gap-2">
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide ${isHighStakes ? 'bg-destructive/15 text-destructive animate-pulse' : 'bg-primary/10 text-primary'}`}>
          <span>{isHighStakes ? '🔥' : campaignLabel.emoji}</span> {isHighStakes ? 'Trending' : campaignLabel.label}
        </span>
        {rareEvent && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent/15 text-accent text-[10px] font-bold"
          >
            {rareEvent}
          </motion.span>
        )}
      </div>

      {/* Swipeable card area */}
      <div className="flex-1 relative min-h-0 flex items-center justify-center" style={{ perspective: '1200px' }}>
        {/* Choice indicators behind the card */}
        {!hasResult && (
          <>
            <div className="absolute inset-0 flex items-center justify-start pl-6 z-0">
              <motion.div
                animate={{ opacity: showA ? choiceOpacity : 0, scale: showA ? 1 : 0.8 }}
                className="flex flex-col items-center gap-1"
              >
                <div className="w-14 h-14 rounded-full bg-option-a/20 border-2 border-option-a flex items-center justify-center">
                  <span className="text-option-a font-display font-bold text-xl">A</span>
                </div>
                <span className="text-option-a text-[10px] font-bold max-w-16 text-center truncate">{poll.option_a}</span>
              </motion.div>
            </div>
            <div className="absolute inset-0 flex items-center justify-end pr-6 z-0">
              <motion.div
                animate={{ opacity: showB ? choiceOpacity : 0, scale: showB ? 1 : 0.8 }}
                className="flex flex-col items-center gap-1"
              >
                <div className="w-14 h-14 rounded-full bg-option-b/20 border-2 border-option-b flex items-center justify-center">
                  <span className="text-option-b font-display font-bold text-xl">B</span>
                </div>
                <span className="text-option-b text-[10px] font-bold max-w-16 text-center truncate">{poll.option_b}</span>
              </motion.div>
            </div>
          </>
        )}

        {/* The card itself with 3D tilt */}
        <div
          className={`w-full max-w-sm mx-auto rounded-2xl overflow-hidden z-10 ${isHighStakes ? 'shadow-[0_0_30px_hsl(var(--destructive)/0.2)] ring-1 ring-destructive/20' : 'shadow-2xl'} ${!hasResult && !disabled ? 'cursor-grab active:cursor-grabbing' : ''} ${hasResult ? selectedGlow : ''}`}
          style={{
            transform: hasResult
              ? 'none'
              : `translateX(${translateX}px) translateY(${translateY}px) rotateZ(${rotation}deg) rotateY(${tiltY}deg) scale(${cardScale})`,
            transition: isDragging ? 'none' : flyDirection ? 'transform 0.4s ease-in, opacity 0.3s' : 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            opacity: flyDirection ? 0 : 1,
            boxShadow: !hasResult ? glowColor : undefined,
            transformStyle: 'preserve-3d',
          }}
          onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchMove={(e) => { handleMove(e.touches[0].clientX, e.touches[0].clientY); if (Math.abs(dragX) > 10 || dragY < -10) e.preventDefault(); }}
          onTouchEnd={handleEnd}
          onMouseDown={(e) => { e.preventDefault(); handleStart(e.clientX, e.clientY); }}
          onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
          onMouseUp={handleEnd}
          onMouseLeave={() => isDragging && handleEnd()}
        >
          {/* Split images */}
          <div className="flex aspect-[4/3] w-full">
            <div className="w-1/2 h-full relative overflow-hidden">
              <img src={imgA} alt={poll.option_a} className="w-full h-full object-cover bg-muted" draggable={false} onError={(e) => handlePollImageError(e, { option: poll.option_a, question: poll.question, side: 'A' })} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
              {showResults && winnerIsA && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-option-a/90 text-option-a-foreground text-[9px] font-bold backdrop-blur-sm"
                >
                  <TrendUp className="h-2.5 w-2.5" /> Winner
                </motion.div>
              )}
              {showResults && result?.choice === 'A' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, boxShadow: ['inset 0 0 20px hsl(var(--option-a) / 0.3)', 'inset 0 0 40px hsl(var(--option-a) / 0.1)', 'inset 0 0 20px hsl(var(--option-a) / 0.3)'] }}
                  transition={{ boxShadow: { duration: 2, repeat: Infinity } }}
                  className="absolute inset-0 border-3 border-option-a rounded-l-2xl pointer-events-none"
                />
              )}
              <div className="absolute bottom-2 left-2 right-1">
                <p className="text-white text-base font-extrabold drop-shadow-lg">{poll.option_a}</p>
              </div>
            </div>

            <div className="absolute inset-y-0 left-1/2 w-[2px] bg-white/15 z-10" />

            <div className="w-1/2 h-full relative overflow-hidden">
              <img src={imgB} alt={poll.option_b} className="w-full h-full object-cover bg-muted" draggable={false} onError={(e) => handlePollImageError(e, { option: poll.option_b, question: poll.question, side: 'B' })} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
              {showResults && !winnerIsA && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-option-b/90 text-option-b-foreground text-[9px] font-bold backdrop-blur-sm"
                >
                  <TrendUp className="h-2.5 w-2.5" /> Winner
                </motion.div>
              )}
              {showResults && result?.choice === 'B' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, boxShadow: ['inset 0 0 20px hsl(var(--option-b) / 0.3)', 'inset 0 0 40px hsl(var(--option-b) / 0.1)', 'inset 0 0 20px hsl(var(--option-b) / 0.3)'] }}
                  transition={{ boxShadow: { duration: 2, repeat: Infinity } }}
                  className="absolute inset-0 border-3 border-option-b rounded-r-2xl pointer-events-none"
                />
              )}
              <div className="absolute bottom-2 left-1 right-2 text-right">
                <p className="text-white text-base font-extrabold drop-shadow-lg">{poll.option_b}</p>
              </div>
            </div>
          </div>

          {/* Question overlay */}
          <div className="absolute top-0 inset-x-0 px-4 pt-3 pb-8 bg-gradient-to-b from-black/70 to-transparent z-20 pointer-events-none">
            <p className="text-white text-base font-display font-bold drop-shadow-lg text-center leading-snug">{poll.question}</p>
          </div>

          {/* Suspense loading pulse */}
          {hasResult && showSuspense && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            >
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="w-12 h-12 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center"
              >
                <span className="text-white text-lg font-bold">?</span>
              </motion.div>
            </motion.div>
          )}

          {/* Emotional feedback overlay */}
          {showResults && (
            <VoteFeedbackOverlay
              percentA={result!.percentA}
              percentB={result!.percentB}
              choice={result!.choice}
              visible={showFeedback}
              userCountry={userCountry}
            />
          )}
        </div>

        {/* Minority floating badge */}
        <AnimatePresence>
          {showMinorityBadge && result && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.9 }}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-2xl bg-black/80 backdrop-blur-md border border-white/10"
            >
              <p className="text-white text-sm font-display font-bold text-center">
                You're in the {result.choice === 'A' ? result.percentA : result.percentB}% 👀
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Majority shift message */}
        <AnimatePresence>
          {showShiftMsg && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.9 }}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-2xl bg-primary/90 backdrop-blur-md border border-white/10"
            >
              <p className="text-primary-foreground text-sm font-display font-bold text-center">
                You just shifted the debate.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Results below image */}
      {showResults && (() => {
        const userPercent = result!.choice === 'A' ? result!.percentA : result!.percentB;
        const isMajority = userPercent >= 50;
        return (
          <div className="shrink-0 px-6 pt-2 space-y-2">
            <div className="flex justify-between items-center">
              <div className={`flex flex-col items-center flex-1 ${result?.choice === 'A' ? 'relative' : ''}`}>
                {result?.choice === 'A' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute -top-1 -left-1 -right-1 -bottom-1 rounded-xl bg-option-a/8 border border-option-a/20"
                  />
                )}
                <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={`text-2xl font-bold text-option-a relative z-10 ${result?.choice === 'A' ? 'text-3xl' : ''}`}>
                  <AnimatedPercent target={result!.percentA} delay={SUSPENSE_DELAY_MS} />
                </motion.span>
                {result?.choice === 'A' && <span className="text-xs font-bold text-option-a relative z-10">Your vote ✓</span>}
              </div>
              <div className={`flex flex-col items-center flex-1 ${result?.choice === 'B' ? 'relative' : ''}`}>
                {result?.choice === 'B' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute -top-1 -left-1 -right-1 -bottom-1 rounded-xl bg-option-b/8 border border-option-b/20"
                  />
                )}
                <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={`text-2xl font-bold text-option-b relative z-10 ${result?.choice === 'B' ? 'text-3xl' : ''}`}>
                  <AnimatedPercent target={result!.percentB} delay={SUSPENSE_DELAY_MS + 100} />
                </motion.span>
                {result?.choice === 'B' && <span className="text-xs font-bold text-option-b relative z-10">Your vote ✓</span>}
              </div>
            </div>
            {/* Animated result bar */}
            <div className="h-2.5 rounded-full bg-muted overflow-hidden flex">
              <motion.div
                initial={{ width: '50%' }}
                animate={{ width: `${result!.percentA}%` }}
                transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.3 }}
                className="h-full bg-option-a rounded-l-full"
              />
              <motion.div
                initial={{ width: '50%' }}
                animate={{ width: `${result!.percentB}%` }}
                transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.3 }}
                className="h-full bg-option-b rounded-r-full"
              />
            </div>
            {/* Alignment message */}
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="text-center"
            >
              <p className="text-sm font-display font-bold text-foreground">
                You voted with {userPercent}% of users{userCountry ? ` in ${userCountry}` : ''}
              </p>
              <span className={`inline-block mt-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${
                isMajority ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                {isMajority ? '👥 Majority' : '👀 Minority'}
              </span>
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: [0, 1, 1, 0] }}
                transition={{ duration: 2.5, times: [0, 0.15, 0.75, 1], delay: 0.8 }}
                className="flex items-center gap-2 mt-1.5"
              >
                <span className="text-[10px] font-bold text-accent">+5 points ⚡</span>
                <span className="text-[10px] text-muted-foreground/70">• streak kept 🔥</span>
              </motion.div>
            </motion.div>
          </div>
        );
      })()}

      {/* Bottom labels — always visible */}
      <div className="shrink-0 px-6 pb-3 pt-1 z-20">
        {showResults ? (
          <div className="flex flex-col gap-1.5">
            {/* Row 1: Vote count + Your pick */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[11px] flex items-center gap-1">
                <Users className="h-3 w-3" /> {result!.totalVotes.toLocaleString()} perspectives
              </span>
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                  result!.choice === 'A' ? 'bg-option-a/10 text-option-a' : 'bg-option-b/10 text-option-b'
                }`}
              >
                You picked {result!.choice === 'A' ? poll.option_a : poll.option_b}
              </motion.span>
            </div>
            {/* FIX 2: Prominent Share Button */}
            <ShareImageCard
              question={poll.question}
              optionA={poll.option_a}
              optionB={poll.option_b}
              percentA={result!.percentA}
              percentB={result!.percentB}
              imageAUrl={poll.image_a_url}
              imageBUrl={poll.image_b_url}
              choice={result!.choice}
            />
            {/* Category link */}
            {poll.category && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex justify-center"
              >
                <button
                  onClick={() => navigate(`/vote?category=${encodeURIComponent(poll.category!)}`)}
                  className="text-[10px] font-semibold text-primary px-2.5 py-0.5 rounded-full bg-primary/10 hover:bg-primary/20 active:scale-95 transition-all"
                >
                  More in {poll.category} →
                </button>
              </motion.div>
            )}
            {/* PWA Install prompt after first vote */}
            <PWAInstallPrompt />
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex flex-col items-center gap-0.5 flex-1">
              <span className="text-option-a font-display font-bold text-lg">A</span>
              <span className="text-foreground/50 text-xs font-medium max-w-24 text-center truncate">← {poll.option_a}</span>
            </div>
            <div className="flex flex-col items-center gap-0 flex-1">
              <span className="text-foreground/30 text-xs">swipe to choose</span>
              {/* Subtle skip hint */}
              <button
                onClick={(e) => { e.stopPropagation(); onSkip(poll.id); }}
                className="text-[9px] text-muted-foreground/40 mt-0.5 hover:text-muted-foreground/60 transition-colors"
              >
                or swipe ↑ to skip
              </button>
            </div>
            <div className="flex flex-col items-center gap-0.5 flex-1">
              <span className="text-option-b font-display font-bold text-lg">B</span>
              <span className="text-foreground/50 text-xs font-medium max-w-24 text-center truncate">{poll.option_b} →</span>
            </div>
          </div>
        )}
        {/* Skip up indicator when dragging up */}
        {dragY < -30 && !hasResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: Math.min(Math.abs(dragY) / THRESHOLD, 1) }}
            className="absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] font-bold text-muted-foreground/60"
          >
            ↑ Skip
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ── Animated Swipe Counter ──
function SwipeCounter({ count }: { count: number }) {
  return (
    <motion.div
      key={count}
      initial={{ scale: 1.3, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex items-center justify-center gap-1 py-1"
    >
      <span className="text-[10px] font-display font-bold text-foreground/40">
        {count} swipe{count !== 1 ? 's' : ''} today
      </span>
    </motion.div>
  );
}

const VALUE_MSG_VOTE_THRESHOLD = 3;

// ── Main Feed ──
export default function SwipeFeed() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [votedResults, setVotedResults] = useState<Map<string, VoteResult>>(new Map());
  const [feedbackPollId, setFeedbackPollId] = useState<string | null>(null);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showMicroFeedback, setShowMicroFeedback] = useState(false);
  const [microFeedbackMsg, setMicroFeedbackMsg] = useState('');
  const [sessionVoteCount, setSessionVoteCount] = useState(0);
  const [showPointsEarned, setShowPointsEarned] = useState(false);
  const [dailySwipeCount, setDailySwipeCount] = useState(0);
  const [milestoneMsg, setMilestoneMsg] = useState<{ message: string; type: 'banner' | 'modal' | 'badge' } | null>(null);
  const [showValueMsg, setShowValueMsg] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Check if authenticated user needs to complete profile
  const profileComplete = !!(profile?.username && profile?.age_range && profile?.gender && profile?.country && profile?.city);
  const [showUnlockPopup, setShowUnlockPopup] = useState(false);
  // Track guest votes for insight preview in signup modal
  const [guestChoices, setGuestChoices] = useState<string[]>([]);
  const [showSwipeOverlay, setShowSwipeOverlay] = useState(!isSwipeOverlayDone());
  const [showSwipeHint, setShowSwipeHint] = useState(!isSwipeHintDone());
  const [totalUserVotes, setTotalUserVotes] = useState<number | null>(null);
  const NEW_USER_VOTE_THRESHOLD = 5;

  useEffect(() => {
    if (loading) return;
    // Logged-in users: redirect to onboarding if profile is incomplete
    if (user && profile && !profileComplete) {
      navigate('/onboarding');
    }
  }, [loading, profileComplete, user, profile, navigate]);

  // Load daily swipe count from localStorage
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const key = `versa_daily_swipes_${today}`;
    try {
      setDailySwipeCount(parseInt(localStorage.getItem(key) || '0', 10));
    } catch { /* ignore */ }
  }, []);

  // Fetch total user vote count for new-user redirect logic
  useEffect(() => {
    if (!user) return;
    supabase.from('votes').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
      .then(({ count }) => setTotalUserVotes(count ?? 0));
  }, [user]);

  const searchParams = new URLSearchParams(window.location.search);
  const targetPollId = searchParams.get('pollId');
  const categoryFilter = searchParams.get('category');
  const searchFilter = searchParams.get('search');
  const liveOnlyFilter = searchParams.get('live') === 'true';

  // Streak data
  const streakData = profile ? {
    current: (profile as any).current_streak as number || 0,
    votedToday: (profile as any).last_vote_date === new Date().toISOString().split('T')[0],
  } : null;

  const { data: polls, isLoading, refetch } = useQuery({
    queryKey: ['feed-polls', user?.id, categoryFilter, searchFilter],
    queryFn: async () => {
      const now = new Date().toISOString();
      let query = supabase.from('polls').select('*').eq('is_active', true).neq('is_archived', true)
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .order('is_daily_poll', { ascending: false }).order('created_at', { ascending: false })
        .limit(60);
      const { data: fetchedPolls, error } = await query;
      if (error) throw error;
      let allPolls = fetchedPolls || [];

      // Build category affinity map from user's past votes for personalization
      const categoryAffinity = new Map<string, number>();
      let votedPollSet = new Set<string>();

      if (user) {
        // Only fetch poll_ids to mark as voted — don't fetch results for all of them
        const { data: userVotes } = await supabase.from('votes').select('poll_id, choice').eq('user_id', user.id);
        if (userVotes && userVotes.length > 0) {
          const votedPollIds = userVotes.map(v => v.poll_id);
          votedPollSet = new Set(votedPollIds);

          // Build category affinity from current batch only
          allPolls.forEach(p => {
            if (votedPollSet.has(p.id) && p.category) {
              categoryAffinity.set(p.category, (categoryAffinity.get(p.category) || 0) + 1);
            }
          });

          // Only fetch results for polls in the current batch that were voted on
          const batchVotedIds = allPolls.filter(p => votedPollSet.has(p.id)).map(p => p.id);
          if (batchVotedIds.length > 0) {
            const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: batchVotedIds });
            const resultsMap = new Map(results?.map((r: any) => [r.poll_id, r]) || []);
            const preloadedResults = new Map<string, VoteResult>();
            userVotes.filter(v => batchVotedIds.includes(v.poll_id)).forEach(v => {
              const r = resultsMap.get(v.poll_id);
              if (r) {
                preloadedResults.set(v.poll_id, {
                  pollId: v.poll_id,
                  choice: v.choice as 'A' | 'B',
                  percentA: r.percent_a || 0,
                  percentB: r.percent_b || 0,
                  totalVotes: r.total_votes || 0,
                });
              }
            });
            setVotedResults(prev => {
              const merged = new Map(preloadedResults);
              prev.forEach((v, k) => merged.set(k, v));
              return merged;
            });
          }
        }
      }

      if (profile) {
        allPolls = allPolls.filter(p => {
          if (p.target_gender && p.target_gender !== 'All' && profile.gender && p.target_gender !== profile.gender) return false;
          if (p.target_age_range && p.target_age_range !== 'All' && profile.age_range && p.target_age_range !== profile.age_range) return false;
          // Multi-country targeting: target_countries array takes priority over legacy target_country
          const countries = (p as any).target_countries as string[] | null;
          if (countries && countries.length > 0) {
            if (profile.country && !countries.includes(profile.country)) return false;
          } else if (p.target_country && p.target_country !== 'All' && profile.country && p.target_country !== profile.country) {
            return false;
          }
          return true;
        });
      }
      if (categoryFilter) {
        allPolls = allPolls.filter(p => p.category === categoryFilter);
      }
      if (searchFilter) {
        const s = searchFilter.toLowerCase();
        allPolls = allPolls.filter(p => 
          p.option_a.toLowerCase().includes(s) || 
          p.option_b.toLowerCase().includes(s) || 
          p.question.toLowerCase().includes(s)
        );
      }
      if (liveOnlyFilter) {
        const now = new Date();
        allPolls = allPolls.filter(p => {
          const hasStarted = p.starts_at ? new Date(p.starts_at) <= now : true;
          const isExpired = p.ends_at ? new Date(p.ends_at) < now : false;
          return hasStarted && !isExpired;
        });
      }

      // ── Sorting: unvoted first, then personalized by category affinity ──
      // Collect all known voted poll ids (from preloaded results + server votes already fetched above)
      const allVotedIds = new Set<string>(votedResults.keys());
      // votedPollSet was built above for authenticated users — merge it in via category affinity keys
      categoryAffinity.forEach((_, cat) => {
        allPolls.forEach(p => {
          if (p.category === cat && votedResults.has(p.id)) allVotedIds.add(p.id);
        });
      });

      allPolls.sort((a, b) => {
        // Unvoted polls always come first
        const aVoted = allVotedIds.has(a.id) ? 1 : 0;
        const bVoted = allVotedIds.has(b.id) ? 1 : 0;
        if (aVoted !== bVoted) return aVoted - bVoted;

        // Daily polls first among unvoted
        if (a.is_daily_poll !== b.is_daily_poll) return a.is_daily_poll ? -1 : 1;
        // Weight score priority
        const wA = Number(a.weight_score) || 1;
        const wB = Number(b.weight_score) || 1;
        if (wA !== wB) return wB - wA;
        // Category affinity
        if (categoryAffinity.size > 0 && !categoryFilter && !searchFilter) {
          const maxAffinity = Math.max(...categoryAffinity.values());
          const affinityA = a.category ? (categoryAffinity.get(a.category) || 0) / maxAffinity : 0.3;
          const affinityB = b.category ? (categoryAffinity.get(b.category) || 0) / maxAffinity : 0.3;
          if (Math.abs(affinityA - affinityB) > 0.1) return affinityB - affinityA;
        }
        // Fallback: newer first
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });

      if (targetPollId) {
        const idx = allPolls.findIndex(p => p.id === targetPollId);
        if (idx > 0) {
          const [t] = allPolls.splice(idx, 1);
          allPolls.unshift(t);
        } else if (idx === -1) {
          // Target poll wasn't in the batch — fetch it directly
          const { data: targetPoll } = await supabase
            .from('polls')
            .select('*')
            .eq('id', targetPollId)
            .eq('is_active', true)
            .single();
          if (targetPoll) {
            allPolls.unshift(targetPoll);
          }
        }
      }
      return allPolls;
    },
  });

  useEffect(() => {
    const ch = supabase.channel('polls-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'polls' }, () => {
        queryClient.invalidateQueries({ queryKey: ['feed-polls'] });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queryClient]);

  // Micro-feedback trigger
  const triggerMicroFeedback = useCallback(() => {
    const city = profile?.city || 'your city';
    const pct = Math.floor(Math.random() * 30) + 45;
    const msgs = ALIGNMENT_MESSAGES;
    const msg = msgs[Math.floor(Math.random() * msgs.length)]
      .replace('{pct}', String(pct))
      .replace('{city}', city);
    setMicroFeedbackMsg(msg);
    setShowMicroFeedback(true);
    setTimeout(() => setShowMicroFeedback(false), 3000);
  }, [profile?.city]);

  const voteMutation = useMutation({
    mutationFn: async ({ pollId, choice }: { pollId: string; choice: 'A' | 'B' }) => {
      if (!user) {
        setShowSignupModal(true);
        throw new Error('GUEST_LIMIT');
      }
      // Find poll to get category
      const currentPoll = polls?.find(p => p.id === pollId);
      const { error: voteError } = await supabase.from('votes').insert({
        poll_id: pollId,
        user_id: user.id,
        choice,
        voter_country: profile?.country || null,
        category: currentPoll?.category || null,
        voter_age_range: profile?.age_range || null,
        voter_gender: profile?.gender || null,
        voter_city: profile?.city || null,
      } as any);
      if (voteError) throw voteError;
      // Use RPC for results instead of fetching all individual votes
      const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: [pollId] });
      const r = results?.[0];
      const totalVotes = r?.total_votes || 1;
      const percentA = r?.percent_a || 0;
      return { pollId, choice, percentA, percentB: 100 - percentA, totalVotes };
    },
    onSuccess: (data) => {
      // Result sound plays after suspense delay (when animation begins)
      setTimeout(() => playResultSound(), SUSPENSE_DELAY_MS);
      setVotedResults(prev => new Map(prev).set(data.pollId, data));
      setFeedbackPollId(data.pollId);
      setTimeout(() => setFeedbackPollId(null), 1800);

      // Show points earned feedback
      if (user) {
        setShowPointsEarned(true);
        setTimeout(() => setShowPointsEarned(false), 2000);
      }

      // Update daily swipe counter
      const today = new Date().toISOString().split('T')[0];
      const key = `versa_daily_swipes_${today}`;
      const newDailyCount = dailySwipeCount + 1;
      setDailySwipeCount(newDailyCount);
      try { localStorage.setItem(key, String(newDailyCount)); } catch { /* ignore */ }

      // Track session votes and trigger micro-feedback every 5
      const newCount = sessionVoteCount + 1;
      setSessionVoteCount(newCount);

      // New user: after 5 total votes, redirect to home
      const newTotal = (totalUserVotes ?? 0) + newCount;
      if (totalUserVotes !== null && totalUserVotes < NEW_USER_VOTE_THRESHOLD && newTotal >= NEW_USER_VOTE_THRESHOLD) {
        setTimeout(() => navigate('/home', { replace: true }), 2000);
      }

      if (newCount % MICRO_FEEDBACK_INTERVAL === 0 && user) {
        setTimeout(() => triggerMicroFeedback(), 2000);
      }

      // Value message — show once at threshold
      if (newCount === VALUE_MSG_VOTE_THRESHOLD && !showValueMsg) {
        setTimeout(() => {
          setShowValueMsg(true);
          setTimeout(() => setShowValueMsg(false), 4000);
        }, 2500);
      }

      // Milestone triggers
      const milestone = MILESTONES.find(m => m.at === newDailyCount);
      if (milestone && user) {
        const msg = milestone.at === 25
          ? `You align with ${Math.floor(Math.random() * 20) + 55}% of ${profile?.city || 'your city'} today.`
          : milestone.message;
        setTimeout(() => {
          playMilestoneSound();
          setMilestoneMsg({ message: msg, type: milestone.type });
          setTimeout(() => setMilestoneMsg(null), milestone.duration);
        }, 2500);
      }

      // Onboarding: check if user hit 3 votes
      if (!user) {
        const guestCount = getGuestVoteCount();
        if (guestCount >= 3 && !isExploreUnlocked()) {
          markExploreUnlocked();
          setShowUnlockPopup(true);
        }
      }

      // Auto-flow: scroll to next unvoted card, prioritizing same category
      setTimeout(() => {
        if (!polls) return;
        const idx = polls.findIndex(p => p.id === data.pollId);
        const currentCategory = polls[idx]?.category;
        const updatedVoted = new Map(votedResults).set(data.pollId, data);
        const unvotedAfter = polls.filter((p, i) => i > idx && !updatedVoted.has(p.id));
        // Prefer same category, then any unvoted
        const sameCat = currentCategory ? unvotedAfter.find(p => p.category === currentCategory) : null;
        const nextPoll = sameCat || unvotedAfter[0];
        if (nextPoll) {
          const nextEl = cardRefs.current.get(nextPoll.id);
          nextEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }
      }, RESULT_DISPLAY_MS);

      queryClient.invalidateQueries({ queryKey: ['visual-feed-home'] });
      queryClient.invalidateQueries({ queryKey: ['user-voted-ids'] });
      queryClient.invalidateQueries({ queryKey: ['unseen-poll-count'] });
      queryClient.invalidateQueries({ queryKey: ['my-votes'] });
      queryClient.invalidateQueries({ queryKey: ['user-vote-count'] });
    },
    onError: (error: any) => {
      if (error.message === 'GUEST_LIMIT') return;
      if (error.message === 'ALREADY_VOTED' || error.message?.includes('duplicate')) { toast.error('You already voted on this poll'); return; }
      toast.error('Failed to vote');
    },
  });

  const handleVote = useCallback((pollId: string, choice: 'A' | 'B') => {
    if (votedResults.has(pollId)) return;
    if (!user && getGuestVoteCount() >= GUEST_VOTE_LIMIT) { setShowSignupModal(true); return; }
    playSwipeSound();
    markFirstVote();
    voteMutation.mutate({ pollId, choice });
  }, [voteMutation, user, votedResults]);

  // Skip handler — track in backend and scroll to next
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  const handleSkip = useCallback((pollId: string) => {
    if (skippedIds.has(pollId) || votedResults.has(pollId)) return;
    setSkippedIds(prev => new Set(prev).add(pollId));
    // Track skip in backend with enriched data
    if (user) {
      const currentPoll = polls?.find(p => p.id === pollId);
      supabase.from('skipped_polls').insert({
        user_id: user.id,
        poll_id: pollId,
        category: currentPoll?.category || null,
        voter_age_range: profile?.age_range || null,
        voter_gender: profile?.gender || null,
        voter_city: profile?.city || null,
        voter_country: profile?.country || null,
      } as any).then(() => {});
    }
    // Scroll to next unvoted poll
    if (polls) {
      const idx = polls.findIndex(p => p.id === pollId);
      const nextPoll = polls.find((p, i) => i > idx && !votedResults.has(p.id) && !skippedIds.has(p.id) && p.id !== pollId);
      if (nextPoll) {
        const nextEl = cardRefs.current.get(nextPoll.id);
        nextEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [user, polls, votedResults, skippedIds]);

  // No welcome flow — polls show immediately

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasPolls = polls && polls.length > 0;
  const unvotedCount = polls?.filter(p => !votedResults.has(p.id)).length || 0;

  return (
    <div className="h-dvh w-full flex flex-col bg-secondary/50 overflow-hidden">
      {/* Top bar with home + streak + info */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-secondary/80 backdrop-blur-sm safe-area-top">
        <button
          onClick={() => navigate('/home')}
          className="w-10 h-10 rounded-full bg-white/60 backdrop-blur-sm flex items-center justify-center text-foreground hover:bg-white/80 transition-colors shadow-sm"
        >
          <Home className="h-5 w-5" />
        </button>

        {/* Streak indicator */}
        {streakData && user && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/60 backdrop-blur-sm shadow-sm">
            <Flame className="h-3.5 w-3.5 text-destructive" />
            <span className="text-[10px] font-bold text-foreground">
              {streakData.current > 0 ? `${streakData.current}-Day Streak` : 'Start a Streak!'}
            </span>
            {!streakData.votedToday && streakData.current > 0 && (
              <span className="text-[8px] text-destructive font-bold animate-pulse ml-0.5">⚠️</span>
            )}
          </div>
        )}

        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/60 backdrop-blur-sm text-foreground shadow-sm flex items-center gap-1">
          <Zap className="h-3 w-3 text-accent" /> {unvotedCount > 0 ? `${unvotedCount} new` : `${polls?.length || 0} polls`}
        </span>
      </div>

      {/* Streak urgency message */}
      {streakData && user && !streakData.votedToday && streakData.current > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="shrink-0 mx-4 mb-1 px-3 py-1.5 rounded-xl bg-destructive/10 border border-destructive/20 text-center"
        >
          <span className="text-[10px] font-bold text-destructive">
            🔥 Swipe now to protect your {streakData.current}-day streak!
          </span>
        </motion.div>
      )}

      {/* Onboarding progress for new users */}
      {!user && !isExploreUnlocked() && (
        <div className="shrink-0 px-4 pb-2">
          <VoteProgressIndicator voteCount={getGuestVoteCount()} target={3} />
        </div>
      )}

      {/* Micro-feedback popup */}
      <AnimatePresence>
        {showMicroFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-primary text-primary-foreground shadow-glow"
          >
            <p className="text-sm font-display font-bold text-center">{microFeedbackMsg}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Milestone popup */}
      <AnimatePresence>
        {milestoneMsg && (
          <motion.div
            initial={{ opacity: 0, y: -30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`fixed z-[60] left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-xl backdrop-blur-md border border-white/10 ${
              milestoneMsg.type === 'modal'
                ? 'top-1/3 bg-card/95 max-w-xs text-center'
                : milestoneMsg.type === 'badge'
                ? 'top-24 bg-primary/90'
                : 'top-20 bg-foreground/90'
            }`}
          >
            {milestoneMsg.type === 'modal' ? (
              <div className="flex flex-col items-center gap-2">
                <span className="text-2xl">🧠</span>
                <p className="text-sm font-display font-bold text-foreground">Insight Snapshot</p>
                <p className="text-xs text-muted-foreground">{milestoneMsg.message}</p>
              </div>
            ) : milestoneMsg.type === 'badge' ? (
              <p className="text-sm font-display font-bold text-primary-foreground text-center">🏆 {milestoneMsg.message}</p>
            ) : (
              <p className="text-sm font-display font-bold text-background text-center">{milestoneMsg.message}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Points earned floating badge */}
      <AnimatePresence>
        {showPointsEarned && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.8 }}
            className="fixed top-16 right-4 z-[70] flex items-center gap-1.5 px-3 py-2 rounded-full bg-accent/90 backdrop-blur-md shadow-lg"
          >
            <Zap className="h-3.5 w-3.5 text-accent-foreground" />
            <span className="text-sm font-display font-bold text-accent-foreground">+5 pts</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showValueMsg && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-muted/90 backdrop-blur-sm border border-border max-w-xs"
          >
            <p className="text-[11px] text-muted-foreground text-center leading-snug">
              Insights like these help brands understand real consumer behavior
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scrollable feed */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-3 pt-4 pb-3 space-y-4"
      >
        {hasPolls ? (
          polls.map((poll, idx) => {
            const result = votedResults.get(poll.id) || null;
            // High-stakes: every ~20 unvoted cards
            const unvotedIndex = polls.filter((p, i) => i <= idx && !votedResults.has(p.id)).length;
            const isHighStakes = unvotedIndex > 0 && unvotedIndex % HIGH_STAKES_INTERVAL === 0 && !result;
            // Rare event: tight vote or high velocity hint
            let rareEvent: string | null = null;
            if (result && Math.abs(result.percentA - result.percentB) <= 6 && result.totalVotes > 10) {
              rareEvent = '⚠️ This debate is tight';
            } else if (result && result.totalVotes > 50) {
              rareEvent = '⚡ Votes moving fast';
            }
            return (
              <div
                key={poll.id}
                ref={(el) => { if (el) cardRefs.current.set(poll.id, el); }}
                className="w-full relative"
              >
                <ImmersivePollCard
                  poll={poll}
                  result={result}
                  onVote={(pollId, choice) => { setShowSwipeHint(false); handleVote(pollId, choice); }}
                  onSkip={handleSkip}
                  disabled={voteMutation.isPending}
                  showFeedback={feedbackPollId === poll.id}
                  isHighStakes={isHighStakes}
                  rareEvent={rareEvent}
                  userCountry={profile?.country}
                  sessionVoteCount={sessionVoteCount}
                />
                {/* Swipe hint on very first card only */}
                {idx === 0 && showSwipeHint && !result && <SwipeHint />}
              </div>
            );
          })
        ) : (
          <div className="h-full flex flex-col items-center justify-center px-4">
            <CaughtUpInsights onRefresh={() => { setVotedResults(new Map()); refetch(); }} />
            <div className="mt-4 w-full max-w-sm">
              <Button onClick={() => navigate('/home')} variant="outline" className="w-full gap-2 h-12 rounded-xl border-border">
                <Home className="h-4 w-4" /> Back to Home
              </Button>
            </div>
          </div>
        )}

        {hasPolls && polls.every(p => votedResults.has(p.id)) && (
          <div className="py-6 flex flex-col items-center gap-2">
            <p className="text-sm font-display font-bold text-foreground/70">You're all caught up! 🎉</p>
            <p className="text-xs text-muted-foreground">New polls drop daily</p>
          </div>
        )}
      </div>

      {/* Daily swipe counter */}
      {dailySwipeCount > 0 && (
        <div className="shrink-0 pb-1">
          <SwipeCounter count={dailySwipeCount} />
        </div>
      )}

      {/* Insight-driven signup modal */}
      <Dialog open={showSignupModal} onOpenChange={setShowSignupModal}>
        <DialogContent className="sm:max-w-sm bg-card border-border p-0 overflow-hidden">
          <div className="p-6 space-y-5">
            <div className="text-center space-y-2">
              <span className="text-4xl">🧠</span>
              <DialogHeader>
                <DialogTitle className="text-xl font-display">See what your choices say about you</DialogTitle>
                <DialogDescription className="text-muted-foreground text-sm">
                  Your first votes already reveal patterns
                </DialogDescription>
              </DialogHeader>
            </div>

            {/* Preview insights based on guest votes */}
            <div className="space-y-2 bg-secondary/50 rounded-xl p-3 border border-border/50">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Preview insights</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs">⚡</span>
                  <p className="text-xs text-foreground">You make quick, instinctive decisions</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs">🎯</span>
                  <p className="text-xs text-foreground">Your choices show a clear preference pattern</p>
                </div>
                <div className="flex items-center gap-2 opacity-40">
                  <span className="text-xs">🔒</span>
                  <p className="text-xs text-foreground italic">More insights after sign up...</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Button 
                onClick={() => { setShowSignupModal(false); navigate('/auth'); }} 
                className="w-full h-12 bg-gradient-primary hover:opacity-90 font-display font-bold rounded-xl"
              >
                Create Profile (10 seconds)
              </Button>
              <Button 
                onClick={() => { setShowSignupModal(false); navigate('/auth?mode=google'); }}
                variant="outline" 
                className="w-full h-11 rounded-xl gap-2 font-medium"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Continue with Google
              </Button>
              <button 
                onClick={() => setShowSignupModal(false)} 
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                Maybe later
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* First-time swipe overlay */}
      <AnimatePresence>
        {showSwipeOverlay && <SwipeOverlay onDismiss={() => setShowSwipeOverlay(false)} />}
      </AnimatePresence>
    </div>
  );
}
