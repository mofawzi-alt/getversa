import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const HINT_KEY = 'versa_swipe_hint_done';

export function isSwipeHintDone(): boolean {
  try { return localStorage.getItem(HINT_KEY) === 'true'; } catch { return false; }
}

export function markSwipeHintDone() {
  localStorage.setItem(HINT_KEY, 'true');
}

interface SwipeHintProps {
  onDone?: () => void;
}

export default function SwipeHint({ onDone }: SwipeHintProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      markSwipeHintDone();
      onDone?.();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onDone]);

  const dismiss = () => {
    setVisible(false);
    markSwipeHintDone();
    onDone?.();
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.3 }}
          className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
        >
          <motion.div
            animate={{ x: [-16, 16, -16] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            className="flex items-center gap-2"
          >
            <span className="text-2xl drop-shadow-lg">👆</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
