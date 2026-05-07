import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const REVEAL_KEY = 'versa_taste_revealed';

export function hasTasteBeenRevealed(): boolean {
  try { return localStorage.getItem(REVEAL_KEY) === 'true'; } catch { return false; }
}

function markRevealed() {
  try { localStorage.setItem(REVEAL_KEY, 'true'); } catch {}
}

interface Props {
  archetype: { name: string; emoji: string; description: string };
  rarityPct: number | null;
  personalityCode?: string;
  personalityName?: string;
  onComplete: () => void;
}

const PHASE_DURATIONS = [2000, 2500, 2500, 3000]; // ms per phase

export default function TasteRevealCinematic({ archetype, rarityPct, personalityCode, personalityName, onComplete }: Props) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (phase >= PHASE_DURATIONS.length) {
      markRevealed();
      onComplete();
      return;
    }
    const timer = setTimeout(() => setPhase(p => p + 1), PHASE_DURATIONS[phase]);
    return () => clearTimeout(timer);
  }, [phase, onComplete]);

  const handleSkip = useCallback(() => {
    markRevealed();
    onComplete();
  }, [onComplete]);

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-[#0a0a0a] flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Skip */}
      <button onClick={handleSkip} className="absolute top-6 right-6 z-10 p-2 rounded-full text-white/40 hover:text-white/70 transition safe-area-top">
        <X className="h-5 w-5" />
      </button>

      {/* Background animated rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="absolute rounded-full border border-white/5"
            initial={{ width: 100, height: 100, opacity: 0 }}
            animate={{ width: 400 + i * 200, height: 400 + i * 200, opacity: [0, 0.3, 0] }}
            transition={{ duration: 3, delay: i * 0.5, repeat: Infinity, ease: 'easeOut' }}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Phase 0: "Analyzing your votes..." */}
        {phase === 0 && (
          <motion.div
            key="p0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center px-8"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-16 h-16 rounded-full border-2 border-white/20 border-t-white/80 mx-auto mb-6"
            />
            <p className="text-white/60 text-lg font-medium">Analyzing your votes...</p>
          </motion.div>
        )}

        {/* Phase 1: Archetype name */}
        {phase === 1 && (
          <motion.div
            key="p1"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="text-center px-8"
          >
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-white/40 text-sm uppercase tracking-[0.3em] mb-4"
            >
              You are
            </motion.p>
            <motion.p
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6, type: 'spring', stiffness: 150, damping: 12 }}
              className="text-6xl mb-4"
            >
              {archetype.emoji}
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className="text-4xl font-black text-white tracking-tight"
            >
              {archetype.name}
            </motion.h1>
          </motion.div>
        )}

        {/* Phase 2: Description + personality */}
        {phase === 2 && (
          <motion.div
            key="p2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center px-8 max-w-sm"
          >
            <p className="text-5xl mb-4">{archetype.emoji}</p>
            <h2 className="text-2xl font-bold text-white mb-3">{archetype.name}</h2>
            <p className="text-white/60 text-base leading-relaxed mb-6">{archetype.description}</p>
            {personalityCode && personalityName && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/15"
              >
                <span className="text-sm text-white/70">Personality:</span>
                <span className="text-sm font-bold text-white">{personalityName}</span>
                <span className="text-xs text-white/40">{personalityCode}</span>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Phase 3: Rarity score */}
        {phase === 3 && (
          <motion.div
            key="p3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center px-8 max-w-sm"
          >
            {rarityPct !== null ? (
              <>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-white/40 text-sm uppercase tracking-[0.3em] mb-6"
                >
                  Your taste is rarer than
                </motion.p>
                <motion.p
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.4, type: 'spring', stiffness: 120, damping: 10 }}
                  className="text-7xl font-black text-white mb-4"
                >
                  {rarityPct}%
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="text-white/50 text-base"
                >
                  of all Versa users
                </motion.p>
              </>
            ) : (
              <>
                <p className="text-5xl mb-4">💎</p>
                <p className="text-2xl font-bold text-white mb-2">Uniquely You</p>
                <p className="text-white/50">Your taste profile is one of a kind</p>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress dots */}
      <div className="absolute bottom-12 flex gap-2 safe-area-bottom">
        {PHASE_DURATIONS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              i === phase ? 'w-6 bg-white' : i < phase ? 'w-1.5 bg-white/40' : 'w-1.5 bg-white/15'
            }`}
          />
        ))}
      </div>
    </motion.div>,
    document.body,
  );
}
