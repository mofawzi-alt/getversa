import { motion } from 'framer-motion';
import { ArrowLeftRight, BarChart3, Compass, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TUTORIAL_KEY = 'versa_tutorial_done';

export function isTutorialDone(): boolean {
  try { return localStorage.getItem(TUTORIAL_KEY) === 'true'; } catch { return false; }
}

export function markTutorialDone() {
  localStorage.setItem(TUTORIAL_KEY, 'true');
}

const FEATURES = [
  { icon: ArrowLeftRight, emoji: '👆', title: 'Swipe to vote', desc: 'Left or right on any poll' },
  { icon: BarChart3, emoji: '📊', title: 'See results', desc: 'How your city & country compare' },
  { icon: Compass, emoji: '🧭', title: 'Explore topics', desc: 'Food, Tech, Lifestyle & more' },
  { icon: Trophy, emoji: '🔥', title: 'Earn streaks', desc: 'Vote daily, climb the leaderboard' },
];

interface AppTutorialProps {
  onComplete: () => void;
}

export default function AppTutorial({ onComplete }: AppTutorialProps) {
  const handleDismiss = () => {
    markTutorialDone();
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[80] bg-background/95 backdrop-blur-md flex flex-col items-center justify-center safe-area-top safe-area-bottom px-6">
      {/* Skip */}
      <button
        onClick={handleDismiss}
        className="absolute top-6 right-6 text-xs text-muted-foreground hover:text-foreground transition-colors z-10"
      >
        Skip
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center text-center max-w-sm gap-6"
      >
        {/* Swipe animation */}
        <div className="relative w-48 h-12">
          <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-muted rounded-full -translate-y-1/2" />
          <motion.div
            animate={{ x: [-30, 30, -30] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2"
          >
            <div className="w-10 h-10 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center">
              <span className="text-lg">👆</span>
            </div>
          </motion.div>
        </div>

        <div className="space-y-1">
          <h2 className="text-2xl font-display font-bold text-foreground">How Versa works</h2>
          <p className="text-sm text-muted-foreground">Swipe. See results. Repeat.</p>
        </div>

        {/* All 4 features in a compact grid */}
        <div className="w-full grid grid-cols-2 gap-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 * i, duration: 0.4 }}
              className="bg-card rounded-2xl border border-border/60 p-4 flex flex-col items-center gap-2 text-center"
            >
              <span className="text-2xl">{f.emoji}</span>
              <p className="text-sm font-bold text-foreground">{f.title}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">{f.desc}</p>
            </motion.div>
          ))}
        </div>

        <Button
          onClick={handleDismiss}
          className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-display font-bold rounded-2xl"
        >
          Got it — let me vote →
        </Button>
      </motion.div>
    </div>
  );
}
