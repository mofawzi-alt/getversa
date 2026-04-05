import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SEEN_KEY = 'versa_daily_return_seen';
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
}

export default function DailyReturnBanner({ currentStreak }: Props) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (currentStreak < 2 || hasShownToday()) return;

    if (currentStreak >= 7) {
      setMessage('7 days in a row 🔥 You never miss a battle');
    } else {
      setMessage("You're back 🙌 New battles are waiting");
    }

    markShownToday();
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(timer);
  }, [currentStreak]);

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
