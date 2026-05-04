import { useState } from 'react';
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
  const [showContent, setShowContent] = useState(false);

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
      className="fixed inset-0 z-[200] flex flex-col items-center safe-area-top safe-area-bottom bg-white"
    >
      {/* Logo — starts centered, moves up */}
      <motion.div
        initial={{ y: '35vh' }}
        animate={{ y: showContent ? 0 : '35vh' }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="pt-14 pb-2 flex flex-col items-center"
        onAnimationComplete={() => {}}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <VersaLogo size="hero" />
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: showContent ? 0 : 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-sm tracking-wide mt-3"
          style={{ color: '#b0b0b0' }}
        >
          Where you decide.
        </motion.p>
      </motion.div>

      {/* Auto-transition: after 1.4s splash, reveal the instruction */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4 }}
        onAnimationStart={() => {
          setTimeout(() => setShowContent(true), 1400);
        }}
        style={{ display: showContent ? 'flex' : 'none' }}
        className="flex-1 flex flex-col items-center justify-center gap-6 px-8 max-w-sm text-center -mt-10"
      >
        {/* Phone mockup with swipe animation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={showContent ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="relative w-48 h-72 rounded-3xl border-2 border-border flex items-center justify-center overflow-hidden bg-secondary/30"
        >
          <div className="absolute inset-3 rounded-2xl border border-border/50 bg-secondary/20" />
          
          {/* Swipe finger */}
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
        </motion.div>

        {/* Title */}
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={showContent ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="text-3xl font-display font-bold text-foreground mt-2"
        >
          Swipe to choose
        </motion.h2>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={showContent ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="text-sm leading-relaxed text-muted-foreground"
        >
          Swipe left or right to vote · See what everyone else chose
        </motion.p>
      </motion.div>

      {/* CTA — only after content revealed */}
      {showContent && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="pb-10 px-8 w-full max-w-sm flex flex-col items-center gap-5"
        >
          <Button
            onClick={handleDismiss}
            className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground text-base font-display font-bold rounded-2xl"
          >
            Got it — let's go
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}
