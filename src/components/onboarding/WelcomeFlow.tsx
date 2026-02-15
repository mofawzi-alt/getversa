import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';

import coffeeImg from '@/assets/polls/coffee.jpg';
import teaImg from '@/assets/polls/tea.jpg';

const WELCOME_KEY = 'versa_welcome_done';

export function isWelcomeDone(): boolean {
  try { return localStorage.getItem(WELCOME_KEY) === 'true'; } catch { return false; }
}

export function markWelcomeDone() {
  localStorage.setItem(WELCOME_KEY, 'true');
}

interface WelcomeFlowProps {
  onComplete: () => void;
}

export default function WelcomeFlow({ onComplete }: WelcomeFlowProps) {
  const [step, setStep] = useState(0);
  const [demoSwiped, setDemoSwiped] = useState(false);
  const [demoChoice, setDemoChoice] = useState<'A' | 'B' | null>(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [flyDirection, setFlyDirection] = useState<'left' | 'right' | null>(null);
  const startX = useRef(0);
  const THRESHOLD = 80;

  const handleDemoVote = (choice: 'A' | 'B') => {
    if (demoSwiped) return;
    setDemoChoice(choice);
    setDemoSwiped(true);
  };

  const handleStart = (clientX: number) => {
    if (demoSwiped || flyDirection) return;
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
      setTimeout(() => handleDemoVote('A'), 300);
    } else if (dragX > THRESHOLD) {
      setFlyDirection('right');
      setTimeout(() => handleDemoVote('B'), 300);
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

  const handleComplete = () => {
    markWelcomeDone();
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="intro"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -100 }}
            className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-6"
          >
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-5xl font-display font-bold text-gradient"
            >
              VERSA
            </motion.h1>
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
                onClick={() => setStep(1)}
                className="w-full h-14 bg-gradient-primary hover:opacity-90 text-lg font-display font-bold rounded-2xl"
              >
                Start Voting <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </motion.div>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="demo"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="flex-1 flex flex-col items-center justify-center px-6 gap-4"
          >
            <p className="text-sm font-display font-bold text-muted-foreground uppercase tracking-wider">Try it out</p>
            <h2 className="text-xl font-display font-bold text-foreground text-center">
              Which do you prefer?
            </h2>

            {/* Swipe indicators */}
            {!demoSwiped && (
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
            <div
              className={`w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl ${!demoSwiped ? 'cursor-grab active:cursor-grabbing' : ''}`}
              style={{
                transform: demoSwiped ? 'none' : `translateX(${translateX}px) rotate(${rotation}deg)`,
                transition: isDragging ? 'none' : flyDirection ? 'transform 0.4s ease-in, opacity 0.4s' : 'transform 0.3s ease-out',
                opacity: flyDirection ? 0 : 1,
              }}
              onTouchStart={(e) => handleStart(e.touches[0].clientX)}
              onTouchMove={(e) => { handleMove(e.touches[0].clientX); if (Math.abs(dragX) > 10) e.preventDefault(); }}
              onTouchEnd={handleEnd}
              onMouseDown={(e) => { e.preventDefault(); handleStart(e.clientX); }}
              onMouseMove={(e) => handleMove(e.clientX)}
              onMouseUp={handleEnd}
              onMouseLeave={() => isDragging && handleEnd()}
            >
              <div className="flex aspect-[4/3] w-full relative">
                <div
                  onClick={() => handleDemoVote('A')}
                  className={`w-1/2 h-full relative overflow-hidden transition-all cursor-pointer ${demoSwiped && demoChoice === 'A' ? 'ring-4 ring-inset ring-option-a' : ''}`}
                >
                  <img src={coffeeImg} alt="Coffee" className="w-full h-full object-cover" draggable={false} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
                  <div className="absolute bottom-3 left-3">
                    <p className="text-white text-sm font-bold drop-shadow-lg">Coffee ☕</p>
                  </div>
                  {demoSwiped && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute inset-0 flex items-center justify-center bg-black/30"
                    >
                      <span className="text-3xl font-bold text-white drop-shadow-lg">32%</span>
                    </motion.div>
                  )}
                </div>
                <div className="absolute inset-y-0 left-1/2 w-[2px] bg-white/15 z-10" />
                <div
                  onClick={() => handleDemoVote('B')}
                  className={`w-1/2 h-full relative overflow-hidden transition-all cursor-pointer ${demoSwiped && demoChoice === 'B' ? 'ring-4 ring-inset ring-option-b' : ''}`}
                >
                  <img src={teaImg} alt="Tea" className="w-full h-full object-cover" draggable={false} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
                  <div className="absolute bottom-3 right-3 text-right">
                    <p className="text-white text-sm font-bold drop-shadow-lg">Tea 🍵</p>
                  </div>
                  {demoSwiped && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute inset-0 flex items-center justify-center bg-black/30"
                    >
                      <span className="text-3xl font-bold text-white drop-shadow-lg">68%</span>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>

            {demoSwiped && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-4"
              >
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Flame className="h-4 w-4 text-destructive" />
                  <span>68% prefer Tea in Cairo</span>
                </div>
                <Button
                  onClick={() => setStep(2)}
                  className="h-12 px-8 bg-gradient-primary hover:opacity-90 font-display font-bold rounded-2xl"
                >
                  Continue <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </motion.div>
            )}

            {!demoSwiped && (
              <p className="text-xs text-muted-foreground animate-pulse">Swipe or tap to vote</p>
            )}
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="value"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-6"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="text-6xl"
            >
              🌍
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-lg text-foreground font-display font-bold max-w-xs"
            >
              Your votes help build live public insights.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="w-full max-w-xs"
            >
              <Button
                onClick={handleComplete}
                className="w-full h-14 bg-gradient-primary hover:opacity-90 text-lg font-display font-bold rounded-2xl"
              >
                Enter VERSA <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step dots */}
      <div className="shrink-0 flex justify-center gap-2 pb-8 safe-area-bottom">
        {[0, 1, 2].map(s => (
          <div
            key={s}
            className={`h-1.5 rounded-full transition-all ${s === step ? 'w-6 bg-primary' : 'w-1.5 bg-muted'}`}
          />
        ))}
      </div>
    </div>
  );
}
