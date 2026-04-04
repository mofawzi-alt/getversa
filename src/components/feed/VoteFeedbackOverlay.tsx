import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DemoData {
  demoPercentA: number;
  demoPercentB: number;
  demoTotal: number;
  ageRange: string | null;
  city: string | null;
  gender?: string | null;
}

function pickFeedbackMessage(percentA: number, percentB: number, choice: 'A' | 'B'): string {
  const userPercent = choice === 'A' ? percentA : percentB;
  const diff = Math.abs(percentA - percentB);

  if (diff <= 4) return "You just broke the tie.";
  if (diff <= 12) return "Close call.";
  if (diff >= 30 && diff <= 50) return "That one's controversial.";
  if (userPercent >= 55) return "You're with the majority.";
  if (userPercent < 45) return "You see it differently.";
  return "You sparked a shift.";
}

interface VoteFeedbackOverlayProps {
  percentA: number;
  percentB: number;
  choice: 'A' | 'B';
  visible: boolean;
  userCountry?: string | null;
  demoData?: DemoData | null;
}

function AnimatedPercent({ target, delay = 0 }: { target: number; delay?: number }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target === 0) return;
    const start = performance.now();
    const duration = 800;
    const startDelay = delay;

    const animate = (now: number) => {
      const elapsed = now - start - startDelay;
      if (elapsed < 0) {
        requestAnimationFrame(animate);
        return;
      }
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, delay]);

  return <>{value}%</>;
}

function buildDemoLine(choice: 'A' | 'B', demoData: DemoData): string | null {
  const { demoPercentA, demoPercentB, demoTotal, ageRange, city } = demoData;
  if (demoTotal < 2) return null; // Not enough demographic data

  const userDemoPercent = choice === 'A' ? demoPercentA : demoPercentB;
  
  // Build the demographic label
  const parts: string[] = [];
  if (ageRange) parts.push(ageRange);
  if (city) parts.push(`in ${city}`);
  const demoLabel = parts.length > 0 ? parts.join(' ') : null;
  if (!demoLabel) return null;

  return `${userDemoPercent}% of ${demoLabel} chose this`;
}

function buildMajorityLine(percentA: number, percentB: number, choice: 'A' | 'B'): { text: string; isMajority: boolean } {
  const userPercent = choice === 'A' ? percentA : percentB;
  if (userPercent >= 50) {
    return { text: 'You voted with the majority', isMajority: true };
  }
  return { text: `You're in the ${userPercent}% minority`, isMajority: false };
}

export default function VoteFeedbackOverlay({ percentA, percentB, choice, visible, userCountry, demoData }: VoteFeedbackOverlayProps) {
  const majorityInfo = buildMajorityLine(percentA, percentB, choice);
  const demoLine = demoData ? buildDemoLine(choice, demoData) : null;
  const message = pickFeedbackMessage(percentA, percentB, choice);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 pointer-events-none"
        >
          {/* PRIMARY: Majority/minority line — most prominent */}
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200, delay: 0.15 }}
            className={`px-6 py-3.5 rounded-2xl backdrop-blur-md border shadow-lg ${
              majorityInfo.isMajority
                ? 'bg-primary/80 border-primary/30'
                : 'bg-destructive/80 border-destructive/30'
            }`}
          >
            <p className="text-white text-lg font-display font-bold text-center leading-snug tracking-wide">
              {majorityInfo.isMajority ? '👥 ' : '👀 '}
              {majorityInfo.text}
            </p>
          </motion.div>

          {/* SECONDARY: Demographic comparison line */}
          {demoLine && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.4, delay: 0.4 }}
              className="px-5 py-2.5 rounded-2xl bg-black/70 backdrop-blur-md shadow-md"
              style={{
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: demoData?.gender === 'Male'
                  ? 'hsl(210, 80%, 55%)'
                  : demoData?.gender === 'Female'
                    ? 'hsl(340, 75%, 55%)'
                    : 'hsla(0, 0%, 100%, 0.15)',
              }}
            >
              <p className="text-white text-sm font-semibold text-center leading-snug">
                📊 {demoLine}
              </p>
            </motion.div>
          )}

          {/* TERTIARY: Contextual message */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.4, delay: 0.6 }}
            className="px-4 py-1.5 rounded-full bg-black/50 backdrop-blur-sm border border-white/10"
          >
            <p className="text-white/70 text-xs font-medium text-center">
              {message}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { AnimatedPercent, pickFeedbackMessage };
export type { DemoData };
