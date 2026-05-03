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

const PERSONAL_MESSAGES: Record<string, string[]> = {
  tie: [
    "This one splits people — no clear winner",
    "You just broke the tie.",
    "The world can't decide either.",
  ],
  close: [
    "Close call — could go either way.",
    "This choice says something about you.",
    "Interesting choice.",
  ],
  controversial: [
    "That one's controversial.",
    "Most people disagree with you.",
    "You think differently on this.",
  ],
  majority: [
    "You're aligned with the majority.",
    "You're with the crowd on this one.",
    "Popular opinion — you fit right in.",
  ],
  minority: [
    "You see it differently.",
    "You think differently on this.",
    "Not many agree — and that's interesting.",
  ],
  neutral: [
    "You sparked a shift.",
    "This choice says something about your style.",
    "Interesting choice.",
  ],
};

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickFeedbackMessage(percentA: number, percentB: number, choice: 'A' | 'B'): string {
  const userPercent = choice === 'A' ? percentA : percentB;
  const diff = Math.abs(percentA - percentB);

  if (diff <= 4) return pickRandom(PERSONAL_MESSAGES.tie);
  if (diff <= 12) return pickRandom(PERSONAL_MESSAGES.close);
  if (diff >= 30 && diff <= 50) return pickRandom(PERSONAL_MESSAGES.controversial);
  if (userPercent >= 55) return pickRandom(PERSONAL_MESSAGES.majority);
  if (userPercent < 45) return pickRandom(PERSONAL_MESSAGES.minority);
  return pickRandom(PERSONAL_MESSAGES.neutral);
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

interface MinorityBadgeData {
  userPercent: number;
  cityPercent?: number | null;
  city?: string | null;
}

function buildMinorityBadge(choice: 'A' | 'B', percentA: number, percentB: number, demoData?: DemoData | null, city?: string | null): MinorityBadgeData | null {
  const userPercent = choice === 'A' ? percentA : percentB;
  if (userPercent >= 20) return null;
  
  const cityPercent = demoData && demoData.demoTotal >= 2 && city
    ? (choice === 'A' ? demoData.demoPercentA : demoData.demoPercentB)
    : null;
  
  return { userPercent, cityPercent, city: city || null };
}

export default function VoteFeedbackOverlay({ percentA, percentB, choice, visible, userCountry, demoData }: VoteFeedbackOverlayProps) {
  const majorityInfo = buildMajorityLine(percentA, percentB, choice);
  const demoLine = demoData ? buildDemoLine(choice, demoData) : null;
  const message = pickFeedbackMessage(percentA, percentB, choice);
  const minorityBadge = buildMinorityBadge(choice, percentA, percentB, demoData, demoData?.city);

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
          {/* MINORITY BADGE: Bold blue badge for <20% votes */}
          {minorityBadge && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ type: 'spring', damping: 18, stiffness: 220, delay: 0.1 }}
              className="px-6 py-4 rounded-2xl backdrop-blur-lg border-2 shadow-xl"
              style={{
                background: 'linear-gradient(135deg, hsl(217, 91%, 50%), hsl(224, 76%, 48%))',
                borderColor: 'hsl(217, 91%, 65%)',
                boxShadow: '0 0 30px hsla(217, 91%, 50%, 0.4), 0 8px 32px hsla(217, 91%, 50%, 0.2)',
              }}
            >
              <p className="text-white text-lg font-bold text-center leading-snug tracking-wide">
                👀 You're in the {minorityBadge.userPercent}% minority on this one
              </p>
              {minorityBadge.cityPercent != null && minorityBadge.city && (
                <p className="text-white/90 text-sm font-semibold text-center mt-1.5 leading-snug">
                  — only {minorityBadge.cityPercent}% of {minorityBadge.city} agrees with you.
                </p>
              )}
            </motion.div>
          )}

          {/* PRIMARY: Majority/minority line — skip if minority badge shown */}
          {!minorityBadge && (
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
          )}

          {/* SECONDARY: Demographic comparison line (skip if minority badge already shows city) */}
          {demoLine && !(minorityBadge?.cityPercent != null) && (
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
