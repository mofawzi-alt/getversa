import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import VersaLogo from '@/components/VersaLogo';

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
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-[100] flex flex-col items-center safe-area-top safe-area-bottom bg-background"
    >
      {/* Top logo */}
      <div className="pt-14 pb-4">
        <VersaLogo size="md" className="opacity-60" />
      </div>

      {/* Center content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 max-w-sm text-center -mt-10">
        {/* Phone mockup with swipe animation */}
        <div className="relative w-48 h-72 rounded-3xl border-2 border-border flex items-center justify-center overflow-hidden bg-secondary/30">
          <div className="absolute inset-3 rounded-2xl border border-border/50 bg-secondary/20" />
          
          {/* Swipe finger — 3 loops then stops */}
          <motion.div
            animate={{ x: [-40, 40, -40] }}
            transition={{ duration: 2, repeat: 2, ease: 'easeInOut' }}
            className="relative z-10"
          >
            <div className="w-14 h-14 rounded-full flex items-center justify-center bg-primary/10 border-2 border-primary/20">
              <span className="text-3xl">👆</span>
            </div>
          </motion.div>

          {/* Left/Right arrows hint */}
          <motion.div
            animate={{ opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 2, repeat: 2 }}
            className="absolute bottom-6 left-0 right-0 flex justify-between px-5"
          >
            <span className="text-muted-foreground text-xl">←</span>
            <span className="text-muted-foreground text-xl">→</span>
          </motion.div>
        </div>

        {/* Title */}
        <h2 className="text-3xl font-display font-bold text-foreground mt-2">
          Swipe to choose
        </h2>

        {/* Subtext */}
        <p className="text-sm leading-relaxed text-muted-foreground">
          Swipe left or right to vote · See what everyone else chose
        </p>
      </div>

      {/* Bottom section */}
      <div className="pb-10 px-8 w-full max-w-sm flex flex-col items-center gap-5">
        {/* Dot indicators — step 1 of 2 */}
        <div className="flex gap-2">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <div className="w-2 h-2 rounded-full bg-muted" />
        </div>

        {/* CTA */}
        <Button
          onClick={handleDismiss}
          className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground text-base font-display font-bold rounded-2xl"
        >
          Got it — let's go
        </Button>
      </div>
    </motion.div>
  );
}
