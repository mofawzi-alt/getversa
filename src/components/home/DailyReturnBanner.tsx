import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SESSION_KEY = 'versa_session_return_shown';

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function hasShownToday(): boolean {
  return sessionStorage.getItem(SESSION_KEY) === getTodayKey();
}

function markShownToday() {
  sessionStorage.setItem(SESSION_KEY, getTodayKey());
}

interface Props {
  currentStreak: number;
  remainingToday?: number;
}

export default function DailyReturnBanner({ currentStreak, remainingToday }: Props) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (hasShownToday()) return;

    if (currentStreak >= 7) {
      setMessage('7 days in a row 🔥 You never miss a battle');
    } else if (currentStreak >= 2) {
      setMessage("You're back 🙌 New battles are waiting");
    } else if (remainingToday && remainingToday > 0) {
      setMessage(`Your daily battles are ready 🔥 ${remainingToday} new polls today`);
    } else {
      return; // nothing to show
    }

    markShownToday();
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(timer);
  }, [currentStreak, remainingToday]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          className="px-3 mb-2"
        >
          <div className="rounded-xl bg-primary/10 border border-primary/20 px-4 py-2.5 text-center">
            <p className="text-xs font-display font-bold text-primary">{message}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}