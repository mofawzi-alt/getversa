import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const OVERLAY_KEY = 'versa_swipe_overlay_done';

export function isSwipeOverlayDone(): boolean {
  try { return localStorage.getItem(OVERLAY_KEY) === 'true'; } catch { return false; }
}

export function markSwipeOverlayDone() {
  localStorage.setItem(OVERLAY_KEY, 'true');
}

interface SwipeOverlayProps {
  onDismiss: () => void;
}

export default function SwipeOverlay({ onDismiss }: SwipeOverlayProps) {
  const handleDismiss = () => {
    markSwipeOverlayDone();
    onDismiss();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center safe-area-top safe-area-bottom"
    >
      <div className="flex flex-col items-center gap-6 px-8 max-w-sm text-center">
        {/* Phone mockup with swipe animation — loops 3 times then stops */}
        <div className="relative w-44 h-72 rounded-3xl border-2 border-white/20 bg-white/5 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-3 rounded-2xl bg-white/5 border border-white/10" />
          
          {/* Swipe finger — 3 loops then stops */}
          <motion.div
            animate={{ x: [-40, 40, -40] }}
            transition={{ duration: 2, repeat: 2, ease: 'easeInOut' }}
            className="relative z-10"
          >
            <div className="w-12 h-12 rounded-full bg-primary/30 border-2 border-primary/50 flex items-center justify-center shadow-lg shadow-primary/20">
              <span className="text-2xl">👆</span>
            </div>
          </motion.div>

          {/* Left/Right arrows hint */}
          <motion.div
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 2, repeat: 2 }}
            className="absolute bottom-6 left-0 right-0 flex justify-between px-4"
          >
            <span className="text-white/40 text-lg">←</span>
            <span className="text-white/40 text-lg">→</span>
          </motion.div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-display font-bold text-white">
          Swipe to choose
        </h2>

        {/* Subtext */}
        <p className="text-sm text-white/60 leading-relaxed">
          Swipe left or right to vote · Skip up · See results instantly
        </p>

        {/* CTA */}
        <Button
          onClick={handleDismiss}
          className="w-full h-13 bg-primary hover:bg-primary/90 text-primary-foreground text-base font-display font-bold rounded-2xl mt-2"
        >
          Got it — let's go
        </Button>
      </div>
    </motion.div>
  );
}
