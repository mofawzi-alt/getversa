import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight } from 'lucide-react';

const WELCOME_BANNER_KEY = 'versa_welcome_banner_dismissed';

function isWelcomeBannerDismissed(): boolean {
  try { return localStorage.getItem(WELCOME_BANNER_KEY) === 'true'; } catch { return false; }
}

/**
 * NUDGE 1 — Welcome banner at top of home screen
 */
export function WelcomeBanner() {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(isWelcomeBannerDismissed);

  if (dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="mx-3 mb-2 rounded-2xl bg-card border border-border/60 px-3 py-2.5 flex items-center gap-2.5"
    >
      <span className="text-base shrink-0">👋</span>
      <p className="flex-1 text-[11px] text-foreground leading-tight">
        Welcome to Versa — <span className="font-bold">sign up free</span> to vote and track your choices
      </p>
      <button
        onClick={() => navigate('/auth?mode=signup')}
        className="shrink-0 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-[11px] font-bold"
      >
        Join
      </button>
      <button
        onClick={() => { localStorage.setItem(WELCOME_BANNER_KEY, 'true'); setDismissed(true); }}
        className="shrink-0 p-1 rounded-full hover:bg-muted/50 text-muted-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}

/**
 * NUDGE 2 — Card inserted in Browse feed after 5 cards
 */
export function BrowseFeedNudgeCard({ onDismiss }: { onDismiss: () => void }) {
  const navigate = useNavigate();

  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-background px-6 gap-5">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl bg-card border border-border/60 p-6 text-center max-w-sm w-full"
      >
        <p className="text-lg font-display font-bold text-foreground mb-2">
          You've seen 5 battles 👀
        </p>
        <p className="text-sm text-muted-foreground mb-5">
          Sign up <span className="font-bold">free</span> to add your vote to any of them
        </p>
        <button
          onClick={() => navigate('/auth?mode=signup')}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-display font-bold text-sm mb-2"
        >
          Join Versa
        </button>
        <button
          onClick={onDismiss}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Maybe later
        </button>
      </motion.div>
    </div>
  );
}

/**
 * NUDGE 4 — Floating button after 10 minutes browsing
 */
export function TimedFloatingNudge() {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const startTime = useRef(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      if (Date.now() - startTime.current >= 10 * 60 * 1000) {
        setShow(true);
        clearInterval(timer);
      }
    }, 30_000); // check every 30s
    return () => clearInterval(timer);
  }, []);

  if (!show || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.button
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        onClick={() => navigate('/auth?mode=signup')}
        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full bg-primary text-primary-foreground font-display font-bold text-sm shadow-lg shadow-primary/30 flex items-center gap-2"
      >
        Ready to vote? Join free
        <ArrowRight className="h-4 w-4" />
      </motion.button>
      {/* Dismiss area */}
      <button
        onClick={() => setDismissed(true)}
        className="fixed bottom-24 right-4 z-50 p-2 rounded-full bg-card/80 backdrop-blur-sm border border-border/50 text-muted-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </AnimatePresence>
  );
}
