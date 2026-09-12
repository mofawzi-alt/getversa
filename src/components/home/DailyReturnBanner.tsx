import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useT } from '@/hooks/useT';

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
  const { t } = useT();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (hasShownToday()) return;

    if (currentStreak === 0 || currentStreak === 1) {
      // Brand new user or first day
      setMessage(t('Welcome to Versa 🔥 Your first battles are ready'));
    } else if (currentStreak >= 7) {
      setMessage(t('7 days in a row 🔥 You never miss a battle'));
    } else if (currentStreak >= 2) {
      setMessage(t("You're back 🙌 New battles are waiting"));
    } else if (remainingToday && remainingToday > 0) {
      setMessage(t('Your daily battles are ready 🔥 {n} new polls today', { n: remainingToday }));
    } else {
      // Fallback welcome
      setMessage(t('Welcome to Versa 🔥 Your first battles are ready'));
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