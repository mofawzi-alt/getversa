import { motion } from 'framer-motion';
import VersaLogo from '@/components/VersaLogo';

const SPLASH_KEY = 'versa_splash_seen';

export function isSplashSeen(): boolean {
  try { return localStorage.getItem(SPLASH_KEY) === 'true'; } catch { return false; }
}

export function markSplashSeen() {
  try { localStorage.setItem(SPLASH_KEY, 'true'); } catch {}
}

export default function SplashScreen({ onComplete }: { onComplete?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="flex flex-col items-center gap-4"
      >
        <VersaLogo size="hero" />
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-sm tracking-wide"
          style={{ color: '#b0b0b0' }}
        >
          Where you decide.
        </motion.p>
      </motion.div>
    </motion.div>
  );
}
