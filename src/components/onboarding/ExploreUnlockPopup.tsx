import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

const EXPLORE_UNLOCKED_KEY = 'versa_explore_unlocked';

export function isExploreUnlocked(): boolean {
  try { return localStorage.getItem(EXPLORE_UNLOCKED_KEY) === 'true'; } catch { return false; }
}

export function markExploreUnlocked() {
  localStorage.setItem(EXPLORE_UNLOCKED_KEY, 'true');
}

interface ExploreUnlockPopupProps {
  open: boolean;
  onClose: () => void;
}

export default function ExploreUnlockPopup({ open, onClose }: ExploreUnlockPopupProps) {
  if (!open) return null;

  return (
    createPortal(
      <div className="fixed inset-x-0 bottom-0 z-[90] p-4 pb-safe pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="mx-auto flex w-full max-w-xs flex-col items-center gap-4 rounded-2xl border border-primary/20 bg-card p-5 text-center shadow-lg pointer-events-auto"
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-7 top-7 text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            ×
          </button>
          <div className="text-5xl" aria-hidden="true">🎉</div>
          <h2 className="text-xl font-display font-bold text-foreground">
            You've unlocked Explore Mode
          </h2>
          <p className="text-sm text-muted-foreground">
            Highlights, Trending, and more are now available!
          </p>
          <Button
            onClick={onClose}
            className="w-full h-12 bg-gradient-primary hover:opacity-90 font-display font-bold rounded-2xl"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Let's Go
          </Button>
        </motion.div>
      </div>,
      document.body,
    )
  );
}
