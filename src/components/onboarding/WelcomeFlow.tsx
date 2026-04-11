import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import VersaLogo from '@/components/VersaLogo';

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
  const handleComplete = () => {
    markWelcomeDone();
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <motion.div
        key="intro"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
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
            onClick={handleComplete}
            className="w-full h-14 bg-gradient-primary hover:opacity-90 text-lg font-display font-bold rounded-2xl"
          >
            Start Voting <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
