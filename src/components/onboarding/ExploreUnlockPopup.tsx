import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
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
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xs text-center border-primary/20">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="flex flex-col items-center gap-4 py-4"
        >
          <div className="text-5xl">🎉</div>
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
      </DialogContent>
    </Dialog>
  );
}
