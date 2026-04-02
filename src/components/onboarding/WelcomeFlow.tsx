import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Flame, Zap, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { markExploreUnlocked } from '@/components/onboarding/ExploreUnlockPopup';
import VersaLogo from '@/components/VersaLogo';

import coffeeImg from '@/assets/polls/coffee.jpg';
import teaImg from '@/assets/polls/tea.jpg';
import dogsImg from '@/assets/polls/dogs.jpg';
import catsImg from '@/assets/polls/cats.jpg';
import pizzaImg from '@/assets/polls/pizza.jpg';
import sushiImg from '@/assets/polls/sushi.jpg';
import sunriseImg from '@/assets/polls/sunrise.jpg';
import sunsetImg from '@/assets/polls/sunset.jpg';

const WELCOME_KEY = 'versa_welcome_done';

export function isWelcomeDone(): boolean {
  try { return localStorage.getItem(WELCOME_KEY) === 'true'; } catch { return false; }
}

export function markWelcomeDone() {
  localStorage.setItem(WELCOME_KEY, 'true');
}

interface DemoPoll {
  question: string;
  optionA: { label: string; emoji: string; img: string };
  optionB: { label: string; emoji: string; img: string };
  resultA: number;
  resultB: number;
  insight: string;
}

const DEMO_POLLS: DemoPoll[] = [
  {
    question: 'Which do you prefer?',
    optionA: { label: 'Coffee', emoji: '☕', img: coffeeImg },
    optionB: { label: 'Tea', emoji: '🍵', img: teaImg },
    resultA: 32, resultB: 68,
    insight: '68% prefer Tea in Cairo',
  },
  {
    question: 'Which pet do you love more?',
    optionA: { label: 'Dogs', emoji: '🐕', img: dogsImg },
    optionB: { label: 'Cats', emoji: '🐈', img: catsImg },
    resultA: 55, resultB: 45,
    insight: '55% are dog people worldwide',
  },
  {
    question: 'Pick your favourite food',
    optionA: { label: 'Pizza', emoji: '🍕', img: pizzaImg },
    optionB: { label: 'Sushi', emoji: '🍣', img: sushiImg },
    resultA: 61, resultB: 39,
    insight: '61% choose Pizza in Egypt',
  },
];

interface WelcomeFlowProps {
  onComplete: () => void;
}

export default function WelcomeFlow({ onComplete }: WelcomeFlowProps) {
  const [step, setStep] = useState(0);

  const handleComplete = () => {
    markWelcomeDone();
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <AnimatePresence mode="wait">
        {step === 0 && <IntroScreen onNext={() => setStep(1)} />}
        {step === 1 && <DemoTrialScreen onComplete={handleComplete} />}
      </AnimatePresence>

      {/* Step dots */}
      <div className="shrink-0 flex justify-center gap-2 pb-8 safe-area-bottom">
        {[0, 1].map(s => (
          <div
            key={s}
            className={`h-1.5 rounded-full transition-all ${s === step ? 'w-6 bg-primary' : 'w-1.5 bg-muted'}`}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Step 0: Brand intro ─── */
function IntroScreen({ onNext }: { onNext: () => void }) {
  return (
    <motion.div
      key="intro"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, x: -100 }}
      className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-6"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <VersaLogo size="hero" />
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-lg text-muted-foreground max-w-xs"
      >
        Swipe to choose. See what the world prefers.
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="w-full max-w-xs"
      >
        <Button
          onClick={onNext}
          className="w-full h-14 bg-gradient-primary hover:opacity-90 text-lg font-display font-bold rounded-2xl"
        >
          Start Voting <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </motion.div>
    </motion.div>
  );
}

/* ─── Step 1: Tutorial swipe (single demo poll) ─── */
function TutorialScreen({ onNext }: { onNext: () => void }) {
  const poll = DEMO_POLLS[0];
  const [swiped, setSwiped] = useState(false);
  const [choice, setChoice] = useState<'A' | 'B' | null>(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [flyDirection, setFlyDirection] = useState<'left' | 'right' | null>(null);
  const startX = useRef(0);
  const THRESHOLD = 80;

  const handleVote = (c: 'A' | 'B') => {
    if (swiped) return;
    setChoice(c);
    setSwiped(true);
  };

  const handleStart = (clientX: number) => {
    if (swiped || flyDirection) return;
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
      setFlyDirection('left');
      setTimeout(() => handleVote('A'), 300);
    } else if (dragX > THRESHOLD) {
      setFlyDirection('right');
      setTimeout(() => handleVote('B'), 300);
    }
    if (Math.abs(dragX) <= THRESHOLD) setDragX(0);
  };

  const rotation = flyDirection
    ? (flyDirection === 'left' ? -15 : 15)
    : Math.sign(dragX) * Math.min(Math.abs(dragX), 200) / 200 * 12;
  const translateX = flyDirection
    ? (flyDirection === 'left' ? -window.innerWidth * 1.5 : window.innerWidth * 1.5)
    : dragX;
  const choiceOpacity = Math.min(Math.abs(dragX) / THRESHOLD, 1);

  return (
    <motion.div
      key="tutorial"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className="flex-1 flex flex-col items-center justify-center px-6 gap-4"
    >
      <p className="text-sm font-display font-bold text-muted-foreground uppercase tracking-wider">Try it out</p>
      <h2 className="text-xl font-display font-bold text-foreground text-center">{poll.question}</h2>

      {/* Swipe indicators */}
      {!swiped && (
        <div className="w-full max-w-sm relative h-0">
          <motion.div
            animate={{ opacity: dragX < -20 ? choiceOpacity : 0, scale: dragX < -20 ? 1 : 0.8 }}
            className="absolute -left-2 top-16 flex flex-col items-center gap-1 z-20"
          >
            <div className="w-12 h-12 rounded-full bg-option-a/20 border-2 border-option-a flex items-center justify-center">
              <span className="text-option-a font-display font-bold text-lg">A</span>
            </div>
          </motion.div>
          <motion.div
            animate={{ opacity: dragX > 20 ? choiceOpacity : 0, scale: dragX > 20 ? 1 : 0.8 }}
            className="absolute -right-2 top-16 flex flex-col items-center gap-1 z-20"
          >
            <div className="w-12 h-12 rounded-full bg-option-b/20 border-2 border-option-b flex items-center justify-center">
              <span className="text-option-b font-display font-bold text-lg">B</span>
            </div>
          </motion.div>
        </div>
      )}

      {/* Demo poll card */}
      <DemoPollCard
        poll={poll}
        swiped={swiped}
        choice={choice}
        dragX={dragX}
        isDragging={isDragging}
        flyDirection={flyDirection}
        translateX={translateX}
        rotation={rotation}
        onStart={handleStart}
        onMove={handleMove}
        onEnd={handleEnd}
        onVote={handleVote}
      />

      {swiped && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Flame className="h-4 w-4 text-destructive" />
            <span>{poll.insight}</span>
          </div>
          <Button onClick={onNext} className="h-12 px-8 bg-gradient-primary hover:opacity-90 font-display font-bold rounded-2xl">
            Continue <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </motion.div>
      )}

      {!swiped && <p className="text-xs text-muted-foreground animate-pulse">Swipe or tap to vote</p>}
    </motion.div>
  );
}

/* ─── Step 2: 3 Demo Trial Polls + Explore Unlock ─── */
function DemoTrialScreen({ onComplete }: { onComplete: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [votes, setVotes] = useState<('A' | 'B')[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);
  const [unlockDismissed, setUnlockDismissed] = useState(false);

  const poll = DEMO_POLLS[currentIndex];
  const voteCount = votes.length;
  const allDone = voteCount >= 3;

  // Card state
  const [choice, setChoice] = useState<'A' | 'B' | null>(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [flyDirection, setFlyDirection] = useState<'left' | 'right' | null>(null);
  const startX = useRef(0);
  const THRESHOLD = 80;

  const handleVote = (c: 'A' | 'B') => {
    if (showResult) return;
    setChoice(c);
    setShowResult(true);
    const newVotes = [...votes, c];
    setVotes(newVotes);

    // After a delay, move to next or show unlock
    setTimeout(() => {
      if (newVotes.length >= 3) {
        markExploreUnlocked();
        setShowUnlock(true);
      } else {
        // Reset for next poll
        setCurrentIndex(prev => prev + 1);
        setChoice(null);
        setShowResult(false);
        setDragX(0);
        setFlyDirection(null);
      }
    }, 1500);
  };

  const handleStart = (clientX: number) => {
    if (showResult || flyDirection) return;
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
      setFlyDirection('left');
      setTimeout(() => handleVote('A'), 300);
    } else if (dragX > THRESHOLD) {
      setFlyDirection('right');
      setTimeout(() => handleVote('B'), 300);
    }
    if (Math.abs(dragX) <= THRESHOLD) setDragX(0);
  };

  const rotation = flyDirection
    ? (flyDirection === 'left' ? -15 : 15)
    : Math.sign(dragX) * Math.min(Math.abs(dragX), 200) / 200 * 12;
  const translateX = flyDirection
    ? (flyDirection === 'left' ? -window.innerWidth * 1.5 : window.innerWidth * 1.5)
    : dragX;
  const choiceOpacity = Math.min(Math.abs(dragX) / THRESHOLD, 1);

  const progress = Math.min(voteCount / 3, 1);

  return (
    <motion.div
      key="trial"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col items-center px-6 pt-8 gap-3"
    >
      {/* Progress indicator */}
      <div className="w-full max-w-sm flex items-center gap-2.5 px-3 py-2 rounded-xl bg-primary/5 border border-primary/15">
        <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-foreground">
              {voteCount}/3 votes to unlock Explore Mode
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-primary"
            />
          </div>
        </div>
      </div>

      {!allDone && poll && (
        <>
          <h2 className="text-lg font-display font-bold text-foreground text-center mt-2">{poll.question}</h2>

          {/* Swipe indicators */}
          {!showResult && (
            <div className="w-full max-w-sm relative h-0">
              <motion.div
                animate={{ opacity: dragX < -20 ? choiceOpacity : 0, scale: dragX < -20 ? 1 : 0.8 }}
                className="absolute -left-2 top-16 flex flex-col items-center gap-1 z-20"
              >
                <div className="w-12 h-12 rounded-full bg-option-a/20 border-2 border-option-a flex items-center justify-center">
                  <span className="text-option-a font-display font-bold text-lg">A</span>
                </div>
              </motion.div>
              <motion.div
                animate={{ opacity: dragX > 20 ? choiceOpacity : 0, scale: dragX > 20 ? 1 : 0.8 }}
                className="absolute -right-2 top-16 flex flex-col items-center gap-1 z-20"
              >
                <div className="w-12 h-12 rounded-full bg-option-b/20 border-2 border-option-b flex items-center justify-center">
                  <span className="text-option-b font-display font-bold text-lg">B</span>
                </div>
              </motion.div>
            </div>
          )}

          <DemoPollCard
            poll={poll}
            swiped={showResult}
            choice={choice}
            dragX={dragX}
            isDragging={isDragging}
            flyDirection={flyDirection}
            translateX={translateX}
            rotation={rotation}
            onStart={handleStart}
            onMove={handleMove}
            onEnd={handleEnd}
            onVote={handleVote}
          />

          {showResult && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Flame className="h-4 w-4 text-destructive" />
              <span>{poll.insight}</span>
            </motion.div>
          )}

          {!showResult && <p className="text-xs text-muted-foreground animate-pulse">Swipe or tap to vote</p>}
        </>
      )}

      {/* Explore Unlock Dialog */}
      <Dialog open={showUnlock} onOpenChange={(o) => { if (!o) { setShowUnlock(false); setUnlockDismissed(true); } }}>
        <DialogContent className="sm:max-w-xs text-center border-primary/20">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="flex flex-col items-center gap-4 py-4"
          >
            <div className="text-5xl">🎉</div>
            <h2 className="text-xl font-display font-bold text-foreground">Nice taste!</h2>
            <p className="text-sm text-muted-foreground">Let's explore what VERSA has to offer.</p>
            <Button
              onClick={() => { setShowUnlock(false); setUnlockDismissed(true); onComplete(); }}
              className="w-full h-12 bg-gradient-primary hover:opacity-90 font-display font-bold rounded-2xl"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Explore the App
            </Button>
          </motion.div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

/* ─── Shared Demo Poll Card ─── */
interface DemoPollCardProps {
  poll: DemoPoll;
  swiped: boolean;
  choice: 'A' | 'B' | null;
  dragX: number;
  isDragging: boolean;
  flyDirection: 'left' | 'right' | null;
  translateX: number;
  rotation: number;
  onStart: (clientX: number) => void;
  onMove: (clientX: number) => void;
  onEnd: () => void;
  onVote: (choice: 'A' | 'B') => void;
}

function DemoPollCard({ poll, swiped, choice, isDragging, flyDirection, translateX, rotation, onStart, onMove, onEnd, onVote }: DemoPollCardProps) {
  return (
    <div
      className={`w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl ${!swiped ? 'cursor-grab active:cursor-grabbing' : ''}`}
      style={{
        transform: swiped ? 'none' : `translateX(${translateX}px) rotate(${rotation}deg)`,
        transition: isDragging ? 'none' : flyDirection ? 'transform 0.4s ease-in, opacity 0.4s' : 'transform 0.3s ease-out',
        opacity: flyDirection ? 0 : 1,
      }}
      onTouchStart={(e) => onStart(e.touches[0].clientX)}
      onTouchMove={(e) => { onMove(e.touches[0].clientX); }}
      onTouchEnd={onEnd}
      onMouseDown={(e) => { e.preventDefault(); onStart(e.clientX); }}
      onMouseMove={(e) => onMove(e.clientX)}
      onMouseUp={onEnd}
      onMouseLeave={() => isDragging && onEnd()}
    >
      <div className="flex aspect-[4/3] w-full relative">
        <div
          onClick={() => onVote('A')}
          className={`w-1/2 h-full relative overflow-hidden transition-all cursor-pointer ${swiped && choice === 'A' ? 'ring-4 ring-inset ring-option-a' : ''}`}
        >
          <img src={poll.optionA.img} alt={poll.optionA.label} className="w-full h-full object-cover" draggable={false} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
          <div className="absolute bottom-3 left-3">
            <p className="text-white text-sm font-bold drop-shadow-lg">{poll.optionA.label} {poll.optionA.emoji}</p>
          </div>
          {swiped && (
            <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} className="absolute inset-0 flex items-center justify-center bg-black/30">
              <span className="text-3xl font-bold text-white drop-shadow-lg">{poll.resultA}%</span>
            </motion.div>
          )}
        </div>
        <div className="absolute inset-y-0 left-1/2 w-[2px] bg-white/15 z-10" />
        <div
          onClick={() => onVote('B')}
          className={`w-1/2 h-full relative overflow-hidden transition-all cursor-pointer ${swiped && choice === 'B' ? 'ring-4 ring-inset ring-option-b' : ''}`}
        >
          <img src={poll.optionB.img} alt={poll.optionB.label} className="w-full h-full object-cover" draggable={false} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
          <div className="absolute bottom-3 right-3 text-right">
            <p className="text-white text-sm font-bold drop-shadow-lg">{poll.optionB.label} {poll.optionB.emoji}</p>
          </div>
          {swiped && (
            <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} className="absolute inset-0 flex items-center justify-center bg-black/30">
              <span className="text-3xl font-bold text-white drop-shadow-lg">{poll.resultB}%</span>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
