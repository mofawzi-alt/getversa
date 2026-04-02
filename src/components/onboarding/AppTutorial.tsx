import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeftRight, BarChart3, Trophy, Compass, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const TUTORIAL_KEY = 'versa_tutorial_done';

export function isTutorialDone(): boolean {
  try { return localStorage.getItem(TUTORIAL_KEY) === 'true'; } catch { return false; }
}

export function markTutorialDone() {
  localStorage.setItem(TUTORIAL_KEY, 'true');
}

const STEPS = [
  {
    icon: ArrowLeftRight,
    emoji: '👆',
    title: 'Swipe to Vote',
    description: 'Swipe left or right on polls to share your opinion. Each vote earns you points!',
    color: 'from-primary/20 to-accent/20',
    iconColor: 'text-primary',
  },
  {
    icon: BarChart3,
    emoji: '📊',
    title: 'See Instant Results',
    description: 'After voting, see how your city and country compare. Are you with the majority?',
    color: 'from-accent/20 to-primary/20',
    iconColor: 'text-accent',
  },
  {
    icon: Compass,
    emoji: '🧭',
    title: 'Explore Categories',
    description: 'Browse polls by category — Food, Tech, Fashion, Lifestyle and more.',
    color: 'from-primary/20 to-accent/20',
    iconColor: 'text-primary',
  },
  {
    icon: Trophy,
    emoji: '🔥',
    title: 'Build Streaks & Earn Rewards',
    description: 'Vote daily to build streaks, unlock badges, and climb the leaderboard!',
    color: 'from-accent/20 to-primary/20',
    iconColor: 'text-accent',
  },
  {
    icon: UserPlus,
    emoji: '🚀',
    title: 'Create Your Account',
    description: 'Sign up to save your progress, track your insights, and unlock all features.',
    color: 'from-primary/20 to-accent/20',
    iconColor: 'text-primary',
    isFinal: true,
  },
];

interface AppTutorialProps {
  onComplete: () => void;
}

export default function AppTutorial({ onComplete }: AppTutorialProps) {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      markTutorialDone();
      onComplete();
    } else {
      setStep(s => s + 1);
    }
  };

  const handleSkip = () => {
    markTutorialDone();
    onComplete();
  };

  const handleSignUp = () => {
    markTutorialDone();
    navigate('/auth?mode=signup');
  };

  return (
    <div className="fixed inset-0 z-[80] bg-background/95 backdrop-blur-md flex flex-col items-center justify-center safe-area-top safe-area-bottom">
      {/* Skip button */}
      <button
        onClick={handleSkip}
        className="absolute top-6 right-6 text-xs text-muted-foreground hover:text-foreground transition-colors z-10"
      >
        Skip
      </button>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 80 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -80 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="flex flex-col items-center text-center px-8 max-w-sm gap-6"
        >
          {/* Animated icon area */}
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
            className={`w-28 h-28 rounded-3xl bg-gradient-to-br ${current.color} flex items-center justify-center shadow-lg`}
          >
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <span className="text-5xl">{current.emoji}</span>
            </motion.div>
          </motion.div>

          {/* Hand swipe animation for step 0 */}
          {step === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="relative w-48 h-12"
            >
              <motion.div
                animate={{ x: [-30, 30, -30] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2"
              >
                <div className="w-10 h-10 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center">
                  <span className="text-lg">👆</span>
                </div>
              </motion.div>
              {/* Track line */}
              <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-muted rounded-full -translate-y-1/2" />
            </motion.div>
          )}

          {/* Results animation for step 1 */}
          {step === 1 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-4 items-end"
            >
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 48 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="w-12 rounded-t-lg bg-option-a/60"
              />
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 72 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="w-12 rounded-t-lg bg-option-b/60"
              />
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="text-xs font-bold text-muted-foreground"
              >
                62% vs 38%
              </motion.div>
            </motion.div>
          )}

          {/* Streak animation for step 3 */}
          {step === 3 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-1"
            >
              {[1, 2, 3, 4, 5].map(i => (
                <motion.div
                  key={i}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2 + i * 0.15, type: 'spring' }}
                  className="text-xl"
                >
                  🔥
                </motion.div>
              ))}
              <motion.span
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.2 }}
                className="text-sm font-bold text-foreground ml-2"
              >
                5-day streak!
              </motion.span>
            </motion.div>
          )}

          <div className="space-y-2">
            <h2 className="text-2xl font-display font-bold text-foreground">{current.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{current.description}</p>
          </div>

          {/* Action buttons */}
          <div className="w-full space-y-3 mt-2">
            {isLast ? (
              <>
                <Button
                  onClick={handleSignUp}
                  className="w-full h-13 bg-gradient-primary hover:opacity-90 text-base font-display font-bold rounded-2xl"
                >
                  <UserPlus className="mr-2 h-5 w-5" /> Create Account
                </Button>
                <button
                  onClick={handleNext}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                >
                  Browse first →
                </button>
              </>
            ) : (
              <Button
                onClick={handleNext}
                className="w-full h-12 bg-gradient-primary hover:opacity-90 font-display font-bold rounded-2xl"
              >
                Next <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Step dots */}
      <div className="absolute bottom-8 flex gap-2">
        {STEPS.map((_, i) => (
          <motion.div
            key={i}
            animate={{
              width: i === step ? 24 : 6,
              backgroundColor: i === step ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
            }}
            className="h-1.5 rounded-full"
            transition={{ duration: 0.3 }}
          />
        ))}
      </div>
    </div>
  );
}
