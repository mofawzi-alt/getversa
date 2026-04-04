import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Share, Smartphone } from 'lucide-react';

const DISMISS_KEY = 'versa_pwa_dismissed';
const FIRST_VOTE_KEY = 'versa_first_vote_done';
const DISMISS_DURATION_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as any).standalone === true;
}

function isDismissed(): boolean {
  try {
    const ts = localStorage.getItem(DISMISS_KEY);
    if (!ts) return false;
    return Date.now() - parseInt(ts, 10) < DISMISS_DURATION_MS;
  } catch { return false; }
}

export function markFirstVote() {
  try { localStorage.setItem(FIRST_VOTE_KEY, '1'); } catch {}
}

export function hasFirstVote(): boolean {
  try { return localStorage.getItem(FIRST_VOTE_KEY) === '1'; } catch { return false; }
}

/** Inline banner shown inside the vote results screen after first vote */
export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (isStandalone() || isDismissed() || !hasFirstVote()) return;

    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIOS(ios);

    if (ios) {
      setShow(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Re-check when component re-renders (after a vote)
  useEffect(() => {
    if (isStandalone() || isDismissed()) return;
    if (hasFirstVote() && !show) {
      const ua = navigator.userAgent;
      const ios = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
      setIsIOS(ios);
      if (ios) setShow(true);
    }
  });

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    }
    setShow(false);
  };

  const handleDismiss = () => {
    setShow(false);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.3 }}
        className="w-full mt-2"
      >
        <div className="bg-secondary/80 backdrop-blur-md border border-border/40 rounded-xl px-3 py-2.5 flex items-center gap-2.5 relative">
          <button
            onClick={handleDismiss}
            className="absolute top-1.5 right-1.5 text-muted-foreground hover:text-foreground p-0.5"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Smartphone className="h-4 w-4 text-primary" />
          </div>

          <div className="flex-1 min-w-0 pr-5">
            <p className="text-xs font-bold text-foreground leading-tight">
              Add Versa to your home screen for daily battles 🔥
            </p>

            {isIOS ? (
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                Tap <Share className="inline h-3 w-3 -mt-0.5" /> then <span className="font-semibold text-foreground">"Add to Home Screen"</span>
              </p>
            ) : (
              <button
                onClick={handleInstall}
                className="mt-1 flex items-center gap-1 text-[10px] font-bold text-primary hover:text-primary/80 transition-colors"
              >
                <Download className="h-3 w-3" /> Install App
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
