import { useState, useEffect } from 'react';
import { X, Share, MoreVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const DISMISS_KEY = 'versa_a2hs_dismissed_at';
const RE_SHOW_DAYS = 3;

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  );
}

function shouldShow(): boolean {
  if (isStandalone()) return false;
  try {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (!dismissed) return true;
    const dismissedAt = parseInt(dismissed, 10);
    const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
    return daysSince >= RE_SHOW_DAYS;
  } catch {
    return true;
  }
}

function getOS(): 'ios' | 'android' | 'other' {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

interface AddToHomeScreenBannerProps {
  visible: boolean;
}

export default function AddToHomeScreenBanner({ visible }: AddToHomeScreenBannerProps) {
  const [show, setShow] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const os = getOS();

  useEffect(() => {
    if (visible && shouldShow()) {
      // Small delay so it doesn't compete with result animation
      const t = setTimeout(() => setShow(true), 1200);
      return () => clearTimeout(t);
    }
  }, [visible]);

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch { /* ignore */ }
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-20 left-3 right-3 z-50 rounded-2xl bg-card border border-border shadow-xl overflow-hidden max-w-md mx-auto"
        >
          {/* Main banner row */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-display font-bold text-foreground leading-tight">
                Add Versa to your home screen for daily battles 🔥
              </p>
            </div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="shrink-0 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold min-h-[44px] flex items-center active:scale-95 transition-transform"
            >
              {expanded ? 'Hide' : 'How?'}
            </button>
            <button
              onClick={dismiss}
              className="shrink-0 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Expandable instructions */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 space-y-3">
                  {os === 'ios' ? (
                    <div className="flex items-start gap-3 bg-secondary/50 rounded-xl p-3">
                      <Share className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-foreground">iPhone / iPad</p>
                        <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                          <li>Tap the <span className="font-semibold text-foreground">Share</span> button in Safari (bottom bar)</li>
                          <li>Scroll down and tap <span className="font-semibold text-foreground">Add to Home Screen</span></li>
                          <li>Tap <span className="font-semibold text-foreground">Add</span> in the top right</li>
                        </ol>
                      </div>
                    </div>
                  ) : os === 'android' ? (
                    <div className="flex items-start gap-3 bg-secondary/50 rounded-xl p-3">
                      <MoreVertical className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-foreground">Android</p>
                        <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                          <li>Tap the <span className="font-semibold text-foreground">⋮ menu</span> in Chrome (top right)</li>
                          <li>Tap <span className="font-semibold text-foreground">Add to Home screen</span></li>
                          <li>Tap <span className="font-semibold text-foreground">Add</span></li>
                        </ol>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-3 bg-secondary/50 rounded-xl p-3">
                        <Share className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-foreground">iPhone / iPad</p>
                          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                            <li>Tap <span className="font-semibold text-foreground">Share</span> in Safari</li>
                            <li>Tap <span className="font-semibold text-foreground">Add to Home Screen</span></li>
                          </ol>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 bg-secondary/50 rounded-xl p-3">
                        <MoreVertical className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-foreground">Android</p>
                          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                            <li>Tap <span className="font-semibold text-foreground">⋮ menu</span> in Chrome</li>
                            <li>Tap <span className="font-semibold text-foreground">Add to Home screen</span></li>
                          </ol>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
