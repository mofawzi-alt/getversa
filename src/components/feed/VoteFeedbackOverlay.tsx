import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const FEEDBACK_MESSAGES = [
  "You're with the majority.",
  "You see it differently.",
  "You just broke the tie.",
  "Close call.",
  "That one's controversial.",
  "You sparked a shift.",
];

function pickFeedbackMessage(percentA: number, percentB: number, choice: 'A' | 'B'): string {
  const userPercent = choice === 'A' ? percentA : percentB;
  const diff = Math.abs(percentA - percentB);

  if (diff <= 4) return "You just broke the tie.";
  if (diff <= 12) return "Close call.";
  if (diff >= 30 && diff <= 50) return "That one's controversial.";
  if (userPercent >= 55) return "You're with the majority.";
  if (userPercent < 45) return "You see it differently.";
  return "You sparked a shift.";
}

interface VoteFeedbackOverlayProps {
  percentA: number;
  percentB: number;
  choice: 'A' | 'B';
  visible: boolean;
}

function AnimatedPercent({ target, delay = 0 }: { target: number; delay?: number }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target === 0) return;
    const start = performance.now();
    const duration = 800;
    const startDelay = delay;

    const animate = (now: number) => {
      const elapsed = now - start - startDelay;
      if (elapsed < 0) {
        requestAnimationFrame(animate);
        return;
      }
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, delay]);

  return <>{value}%</>;
}

export default function VoteFeedbackOverlay({ percentA, percentB, choice, visible }: VoteFeedbackOverlayProps) {
  const message = pickFeedbackMessage(percentA, percentB, choice);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
        >
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="px-5 py-3 rounded-2xl bg-black/70 backdrop-blur-md border border-white/10"
          >
            <p className="text-white text-sm font-display font-bold text-center leading-snug tracking-wide">
              {message}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { AnimatedPercent, pickFeedbackMessage };
