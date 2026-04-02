import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Share } from 'lucide-react';
import VersaLogo from '@/components/VersaLogo';


const DISMISS_KEY = 'versa_pwa_dismissed';
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

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (isStandalone() || isDismissed()) return;

    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIOS(ios);

    if (ios) {
      // Show after a short delay on iOS
      const t = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(t);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShow(true), 2000);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

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
        initial={{ opacity: 0, y: 80 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 80 }}
        className="fixed bottom-24 left-3 right-3 z-[100] max-w-sm mx-auto"
      >
        <div className="bg-card/95 backdrop-blur-xl border border-border/60 rounded-2xl p-4 shadow-xl">
          <button onClick={handleDismiss} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-3 mb-3">
            <VersaLogo size="sm" />
            <div>
              <h3 className="font-display font-bold text-sm text-foreground">Add to Home Screen</h3>
              <p className="text-xs text-muted-foreground">Get the full app experience</p>
            </div>
          </div>

          {isIOS ? (
            <div className="bg-secondary/60 rounded-xl p-3 text-xs text-muted-foreground space-y-1.5">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <Share className="h-3.5 w-3.5" /> Tap the Share button below
              </p>
              <p>Then scroll down and tap <span className="font-semibold text-foreground">"Add to Home Screen"</span></p>
            </div>
          ) : (
            <button
              onClick={handleInstall}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-bold transition-all hover:scale-[1.02]"
            >
              <Download className="h-4 w-4" /> Install App
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
