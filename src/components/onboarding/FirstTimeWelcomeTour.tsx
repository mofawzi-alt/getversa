import { useState, useCallback } from 'react';
import { motion, PanInfo } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import pollPreviewImg from '@/assets/onboarding-poll-preview.jpg';
import personalityPreviewImg from '@/assets/onboarding-personality-preview.jpg';

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

/* ── Screen 1: Swipe poll card mockup with real images ── */
function SwipeVisual() {
  return (
    <div className="relative w-72 mx-auto">
      {/* Card */}
      <div className="rounded-3xl bg-card shadow-xl border border-border/60 overflow-hidden">
        {/* Split image */}
        <div className="relative grid grid-cols-2 aspect-[4/3] overflow-hidden">
          {/* Left – Coffee */}
          <div className="relative overflow-hidden">
            <img
              src={pollPreviewImg}
              alt="Coffee"
              className="w-[200%] h-full object-cover object-left"
              draggable={false}
            />
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
              <p className="text-white text-xs font-bold drop-shadow-md">Coffee</p>
            </div>
          </div>
          {/* Right – Tea */}
          <div className="relative overflow-hidden">
            <img
              src={pollPreviewImg}
              alt="Tea"
              className="w-[200%] h-full object-cover object-right"
              draggable={false}
            />
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
              <p className="text-white text-xs font-bold drop-shadow-md text-right">Tea</p>
            </div>
          </div>
        </div>
        {/* Question */}
        <div className="px-4 py-3">
          <p className="text-[15px] font-bold text-foreground">Tea or Coffee?</p>
          <div className="flex justify-center gap-8 text-[10px] uppercase tracking-wider text-muted-foreground/60 mt-2">
            <span>← Swipe</span>
            <span>Swipe →</span>
          </div>
        </div>
      </div>

      {/* Animated swipe arrows */}
      <motion.div
        className="absolute -left-6 top-[35%] bg-primary/15 backdrop-blur-sm rounded-full p-2.5 shadow-md"
        animate={{ x: [-6, 6, -6] }}
        transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
      >
        <ArrowLeft className="w-5 h-5 text-primary" />
      </motion.div>
      <motion.div
        className="absolute -right-6 top-[35%] bg-primary/15 backdrop-blur-sm rounded-full p-2.5 shadow-md"
        animate={{ x: [6, -6, 6] }}
        transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
      >
        <ArrowRight className="w-5 h-5 text-primary" />
      </motion.div>
    </div>
  );
}

/* ── Screen 2: Result card with bars and flag ── */
function ResultVisual() {
  return (
    <div className="w-72 mx-auto rounded-3xl bg-card shadow-xl border border-border/60 overflow-hidden">
      {/* Split image with result overlay */}
      <div className="relative grid grid-cols-2 aspect-[16/9] overflow-hidden">
        <div className="relative overflow-hidden">
          <img src={pollPreviewImg} alt="" className="w-[200%] h-full object-cover object-left" draggable={false} />
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-extrabold text-white drop-shadow-lg">63<span className="text-xl">%</span></span>
          </div>
        </div>
        <div className="relative overflow-hidden">
          <img src={pollPreviewImg} alt="" className="w-[200%] h-full object-cover object-right" draggable={false} />
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-extrabold text-white drop-shadow-lg">37<span className="text-xl">%</span></span>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🇪🇬</span>
          <p className="text-[15px] font-bold text-foreground">Tea or Coffee?</p>
        </div>

        {/* Result bars */}
        <div className="space-y-2">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-foreground">Coffee</span>
              <span className="text-xs font-bold text-primary">63%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: '63%' }} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-foreground">Tea</span>
              <span className="text-xs font-bold text-muted-foreground">37%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-muted-foreground/40 rounded-full" style={{ width: '37%' }} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full text-[10px]">Majority</span>
          <span className="text-[10px] text-muted-foreground">12,453 votes</span>
        </div>
      </div>
    </div>
  );
}

/* ── Screen 3: Personality card ── */
function PersonalityVisual() {
  return (
    <div className="w-72 mx-auto rounded-3xl bg-card shadow-xl border border-border/60 overflow-hidden">
      {/* Hero image */}
      <div className="relative h-36 overflow-hidden">
        <img src={personalityPreviewImg} alt="" className="w-full h-full object-cover" draggable={false} />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4">
          <div className="flex items-center gap-2">
            <span className="text-3xl">⚡</span>
            <h3 className="text-xl font-extrabold text-foreground">The Maverick</h3>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 pt-1 space-y-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Inventive and restless — always first to try the new thing, you thrive on disrupting the expected.
        </p>

        <div className="space-y-1.5">
          {['Early adopter', 'Creative choices', 'Trend-setting'].map((trait) => (
            <div key={trait} className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <div className="w-2 h-2 rounded-full bg-primary" />
              </div>
              <span className="text-xs font-medium text-foreground">{trait}</span>
            </div>
          ))}
        </div>
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
    await supabase.from('users').update({ has_seen_welcome_tour: true } as any).eq('id', userId);
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
            className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
          >
            Skip
          </button>
        </div>
      )}
      {isLast && <div className="p-4 pt-[max(env(safe-area-inset-top),1rem)]" />}

      {/* Content */}
      <motion.div
        key={currentScreen}
        className="flex-1 flex flex-col items-center justify-center px-6 gap-6"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        initial={{ opacity: 0, x: 60 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -60 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <Visual />
        <div className="text-center space-y-2 max-w-xs">
          <h2 className="text-2xl font-extrabold text-foreground tracking-tight">{screen.headline}</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">{screen.subtext}</p>
        </div>
      </motion.div>

      {/* Bottom: dots + CTA */}
      <div className="pb-[max(env(safe-area-inset-bottom),1.5rem)] px-8 space-y-5">
        {/* Dots */}
        <div className="flex justify-center gap-2">
          {SCREENS.map((_, i) => (
            <motion.div
              key={i}
              className="h-2 rounded-full"
              animate={{
                width: i === currentScreen ? 24 : 8,
                backgroundColor: i === currentScreen ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.25)',
              }}
              transition={{ duration: 0.3 }}
            />
          ))}
        </div>

        {isLast ? (
          <Button onClick={dismiss} className="w-full h-12 text-base font-semibold rounded-xl">
            Start swiping →
          </Button>
        ) : (
          <Button variant="ghost" onClick={next} className="w-full h-12 text-base text-muted-foreground">
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
