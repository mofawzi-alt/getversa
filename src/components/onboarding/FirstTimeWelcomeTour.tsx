import { useState, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface FirstTimeWelcomeTourProps {
  userId: string;
  onComplete: () => void;
}

const SCREENS = [
  {
    headline: 'Swipe to decide',
    subtext: 'Left or right. See how Egypt voted instantly.',
    visual: 'swipe' as const,
  },
  {
    headline: "See Egypt's pulse",
    subtext: 'Real votes. Real opinions. Updated every day.',
    visual: 'result' as const,
  },
  {
    headline: 'Discover who you are',
    subtext: 'Every swipe builds your taste profile and personality type.',
    visual: 'personality' as const,
  },
];

/* ── Static visuals (no external deps, pure illustration) ── */

function SwipeVisual() {
  return (
    <div className="relative w-64 h-80 mx-auto">
      {/* Mock poll card */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-muted/60 to-muted overflow-hidden border border-border/40 shadow-lg">
        <div className="h-1/2 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
          <span className="text-4xl">🇪🇬</span>
        </div>
        <div className="p-4 text-center space-y-2">
          <p className="text-sm font-semibold text-foreground">Tea or Coffee?</p>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>☕ Coffee</span>
            <span>🍵 Tea</span>
          </div>
        </div>
      </div>
      {/* Swipe arrows */}
      <motion.div
        className="absolute -left-8 top-1/2 -translate-y-1/2 bg-primary/10 rounded-full p-2"
        animate={{ x: [-4, 4, -4] }}
        transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
      >
        <ArrowLeft className="w-5 h-5 text-primary" />
      </motion.div>
      <motion.div
        className="absolute -right-8 top-1/2 -translate-y-1/2 bg-primary/10 rounded-full p-2"
        animate={{ x: [4, -4, 4] }}
        transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
      >
        <ArrowRight className="w-5 h-5 text-primary" />
      </motion.div>
    </div>
  );
}

function ResultVisual() {
  return (
    <div className="w-64 mx-auto rounded-2xl border border-border/40 shadow-lg overflow-hidden bg-background">
      <div className="h-24 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
        <span className="text-3xl">🇪🇬</span>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground text-center">Egypt's verdict</p>
        {/* Percentage bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="font-medium text-foreground">Coffee</span>
            <span className="text-primary font-bold">63%</span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: '63%' }} />
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="font-medium text-foreground">Tea</span>
            <span className="text-muted-foreground font-bold">37%</span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-muted-foreground/30" style={{ width: '37%' }} />
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground text-center">12,453 votes</p>
      </div>
    </div>
  );
}

function PersonalityVisual() {
  return (
    <div className="w-64 mx-auto rounded-2xl border border-border/40 shadow-lg overflow-hidden bg-background">
      <div className="bg-gradient-to-br from-primary/15 to-primary/5 p-6 text-center space-y-2">
        <span className="text-5xl">⚡</span>
        <h3 className="text-lg font-bold text-foreground">The Maverick</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Inventive and restless — always first to try the new thing, you thrive on disrupting the expected.
        </p>
      </div>
      <div className="p-4 space-y-2">
        {['Early adopter', 'Creative choices', 'Trend-setting'].map((trait) => (
          <div key={trait} className="flex items-center gap-2 text-xs text-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            {trait}
          </div>
        ))}
      </div>
    </div>
  );
}

const VISUALS = {
  swipe: SwipeVisual,
  result: ResultVisual,
  personality: PersonalityVisual,
};

export default function FirstTimeWelcomeTour({ userId, onComplete }: FirstTimeWelcomeTourProps) {
  const [currentScreen, setCurrentScreen] = useState(0);

  const dismiss = useCallback(async () => {
    // Mark in DB
    await supabase.from('users').update({ has_seen_welcome_tour: true } as any).eq('id', userId);
    // Also mark in localStorage for instant next check
    localStorage.setItem('versa_welcome_tour_done', 'true');
    onComplete();
  }, [userId, onComplete]);

  const next = () => {
    if (currentScreen < SCREENS.length - 1) {
      setCurrentScreen((s) => s + 1);
    }
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x < -50 && currentScreen < SCREENS.length - 1) {
      setCurrentScreen((s) => s + 1);
    } else if (info.offset.x > 50 && currentScreen > 0) {
      setCurrentScreen((s) => s - 1);
    }
  };

  const screen = SCREENS[currentScreen];
  const Visual = VISUALS[screen.visual];
  const isLast = currentScreen === SCREENS.length - 1;

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      {/* Skip */}
      {!isLast && (
        <div className="flex justify-end p-4 pt-[max(env(safe-area-inset-top),1rem)]">
          <button
            onClick={dismiss}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip
          </button>
        </div>
      )}
      {isLast && <div className="p-4 pt-[max(env(safe-area-inset-top),1rem)]" />}

      {/* Content */}
      <motion.div
        key={currentScreen}
        className="flex-1 flex flex-col items-center justify-center px-8 gap-8"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        initial={{ opacity: 0, x: 60 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -60 }}
        transition={{ duration: 0.25 }}
      >
        <Visual />
        <div className="text-center space-y-2 max-w-sm">
          <h2 className="text-2xl font-bold text-foreground">{screen.headline}</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">{screen.subtext}</p>
        </div>
      </motion.div>

      {/* Bottom: dots + CTA */}
      <div className="pb-[max(env(safe-area-inset-bottom),1.5rem)] px-8 space-y-4">
        {/* Dots */}
        <div className="flex justify-center gap-2">
          {SCREENS.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === currentScreen ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
            />
          ))}
        </div>

        {isLast ? (
          <Button
            onClick={dismiss}
            className="w-full h-12 text-base font-semibold"
          >
            Start swiping →
          </Button>
        ) : (
          <Button
            variant="ghost"
            onClick={next}
            className="w-full h-12 text-base text-muted-foreground"
          >
            Next
          </Button>
        )}
      </div>
    </div>
  );
}

/** Quick localStorage check to avoid DB round-trip */
export function isWelcomeTourDone(): boolean {
  try {
    return localStorage.getItem('versa_welcome_tour_done') === 'true';
  } catch {
    return false;
  }
}
