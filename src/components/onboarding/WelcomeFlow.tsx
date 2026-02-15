import { useState } from 'react';
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

  const handleDemoVote = (choice: 'A' | 'B') => {
    if (demoSwiped) return;
    setDemoChoice(choice);
    setDemoSwiped(true);
  };

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

            {/* Demo poll card */}
            <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl">
              <div className="flex aspect-[4/3] w-full">
                <button
                  onClick={() => handleDemoVote('A')}
                  className={`w-1/2 h-full relative overflow-hidden transition-all ${demoSwiped && demoChoice === 'A' ? 'ring-4 ring-inset ring-option-a' : ''}`}
                  disabled={demoSwiped}
                >
                  <img src={coffeeImg} alt="Coffee" className="w-full h-full object-cover" />
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
                </button>
                <div className="absolute inset-y-0 left-1/2 w-[2px] bg-white/15 z-10" />
                <button
                  onClick={() => handleDemoVote('B')}
                  className={`w-1/2 h-full relative overflow-hidden transition-all ${demoSwiped && demoChoice === 'B' ? 'ring-4 ring-inset ring-option-b' : ''}`}
                  disabled={demoSwiped}
                >
                  <img src={teaImg} alt="Tea" className="w-full h-full object-cover" />
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
                </button>
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
              <p className="text-xs text-muted-foreground animate-pulse">Tap a side to vote</p>
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
