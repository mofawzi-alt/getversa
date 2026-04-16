import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, MessageCircle, Camera, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * What's New banner — appears on Home once per release for each user.
 * Bump CURRENT_RELEASE when launching new features. The banner re-shows
 * to everyone the next time they open Home.
 */
const CURRENT_RELEASE = 'v1.2-messaging-avatars';
const STORAGE_KEY = 'versa_seen_release';

export function hasSeenCurrentRelease(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === CURRENT_RELEASE;
  } catch {
    return true;
  }
}

export function markCurrentReleaseSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, CURRENT_RELEASE);
  } catch {
    // ignore
  }
}

export default function WhatsNewBanner() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!hasSeenCurrentRelease()) {
      // Slight delay so it appears after the hero loads
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    markCurrentReleaseSeen();
    setOpen(false);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25 }}
        className="mx-4 mb-3"
      >
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-background p-4 shadow-sm">
          {/* Dismiss */}
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-foreground/10 text-muted-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">What's new</p>
              <p className="text-sm font-bold text-foreground leading-tight">
                Versa just got more social
              </p>
            </div>
          </div>

          {/* Collapsed teaser */}
          {!expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="mt-1 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              See what changed
              <ChevronRight className="h-3 w-3" />
            </button>
          )}

          {/* Expanded feature list */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="space-y-2.5 mt-3">
                  <FeatureRow
                    icon={<MessageCircle className="h-4 w-4 text-primary" />}
                    title="Message your friends"
                    desc="DM friends directly and share polls into any chat."
                    onClick={() => {
                      dismiss();
                      navigate('/messages');
                    }}
                  />
                  <FeatureRow
                    icon={<Camera className="h-4 w-4 text-primary" />}
                    title="Add a profile picture"
                    desc="Upload your photo so friends recognize you."
                    onClick={() => {
                      dismiss();
                      navigate('/profile/edit');
                    }}
                  />
                </div>

                <button
                  onClick={dismiss}
                  className="mt-3 w-full rounded-xl bg-primary text-primary-foreground text-sm font-semibold py-2.5 hover:opacity-90 transition-opacity"
                >
                  Got it
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function FeatureRow({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 p-2.5 rounded-xl bg-background/60 hover:bg-background transition-colors text-left border border-border/40"
    >
      <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground leading-tight">{title}</p>
        <p className="text-xs text-muted-foreground leading-snug mt-0.5">{desc}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
    </button>
  );
}
