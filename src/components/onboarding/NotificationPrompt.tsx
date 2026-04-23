import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const PROMPT_KEY = 'versa_notif_prompt_shown';
const PROMPT_SESSION_KEY = 'versa_notif_prompt_session';

export function hasSeenNotifPrompt(): boolean {
  // If already subscribed, never show
  if (Notification.permission === 'granted') {
    return true;
  }
  // For unsubscribed users: only suppress within the same session
  return sessionStorage.getItem(PROMPT_SESSION_KEY) === '1';
}

export function markNotifPromptSeen(): void {
  localStorage.setItem(PROMPT_KEY, '1');
  sessionStorage.setItem(PROMPT_SESSION_KEY, '1');
}

interface NotificationPromptProps {
  open: boolean;
  onClose: () => void;
}

export default function NotificationPrompt({ open, onClose }: NotificationPromptProps) {
  const { subscribe, isLoading, isSupported, supportMessage } = usePushNotifications();
  const [closing, setClosing] = useState(false);

  const handleEnable = async () => {
    const enabled = await subscribe();

    if (!enabled) {
      return;
    }

    markNotifPromptSeen();
    setClosing(true);
    setTimeout(onClose, 300);
  };

  const handleLater = () => {
    markNotifPromptSeen();
    setClosing(true);
    setTimeout(onClose, 300);
  };

  return (
    <AnimatePresence>
      {open && !closing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-6"
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 30 }}
            transition={{ type: 'spring', damping: 22, stiffness: 300 }}
            className="w-full max-w-sm rounded-3xl bg-card border border-border p-8 text-center space-y-6 shadow-2xl"
          >
            {/* Animated bell icon */}
            <motion.div
              animate={{ 
                scale: [1, 1.15, 1],
                rotate: [0, -8, 8, -4, 0],
              }}
              transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
              className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center mx-auto"
            >
              <Bell className="h-10 w-10 text-primary" />
            </motion.div>

            {/* Copy */}
            <div className="space-y-2">
              <h2 className="text-2xl font-display font-bold text-foreground">
                Never miss a battle 🔥
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Enable notifications to get daily polls and streak reminders
              </p>
            </div>

            {/* Buttons */}
            <div className="space-y-3">
              <Button
                onClick={handleEnable}
                disabled={isLoading || !isSupported}
                className="w-full h-12 text-base font-bold rounded-xl"
              >
                {isLoading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full"
                  />
                ) : (
                  '🔔 Turn on notifications'
                )}
              </Button>
              <button
                onClick={handleLater}
                className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Maybe later
              </button>
            </div>

            {/* Platform hint */}
            <p className="text-[10px] text-muted-foreground/60">
              {isSupported ? 'Works on Safari, Chrome & all major browsers' : supportMessage}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
