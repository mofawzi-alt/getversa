import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { X, Sparkles } from 'lucide-react';

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

export default function TasteRevealCinematic({ archetype, rarityPct, personalityCode, personalityName, onComplete }: Props) {
  const [ready, setReady] = useState(false);

  // Brief loading beat, then reveal everything at once
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 1800);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = useCallback(() => {
    markRevealed();
    onComplete();
  }, [onComplete]);

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at 50% 30%, #1a1030 0%, #0a0a12 50%, #050508 100%)',
      }}
    >
      {/* Skip / Close */}
      <button
        onClick={handleDismiss}
        className="absolute top-6 right-6 z-10 p-2 rounded-full text-white/30 hover:text-white/60 transition safe-area-top"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Ambient glow orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)', top: '5%', left: '50%', transform: 'translateX(-50%)' }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-[300px] h-[300px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.12) 0%, transparent 70%)', bottom: '15%', right: '-5%' }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />
        <motion.div
          className="absolute w-[200px] h-[200px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)', bottom: '30%', left: '5%' }}
          animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />
      </div>

      {/* Particle lines */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
            style={{
              top: `${20 + i * 12}%`,
              left: 0,
              right: 0,
            }}
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: [0, 0.3, 0], scaleX: [0, 1, 0] }}
            transition={{ duration: 3, delay: i * 0.4 + 2, repeat: Infinity, repeatDelay: 4 }}
          />
        ))}
      </div>

      {/* Loading state */}
      {!ready && (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="text-center px-8"
        >
          <motion.div
            className="relative w-20 h-20 mx-auto mb-6"
          >
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-white/10 border-t-purple-400/80"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="absolute inset-2 rounded-full border border-white/5 border-b-pink-400/50"
              animate={{ rotate: -360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-purple-300/60" />
            </div>
          </motion.div>
          <p className="text-white/40 text-sm font-medium tracking-wider uppercase">Reading your taste DNA...</p>
        </motion.div>
      )}

      {/* The Card — single premium reveal */}
      {ready && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-[340px] max-w-[90vw] mx-auto"
        >
          {/* Card container */}
          <div
            className="relative rounded-[28px] overflow-hidden"
            style={{
              background: 'linear-gradient(170deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 25px 60px -12px rgba(0,0,0,0.5), 0 0 80px -20px rgba(139,92,246,0.2)',
              backdropFilter: 'blur(40px)',
            }}
          >
            {/* Inner glow line at top */}
            <div className="absolute top-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

            <div className="px-7 pt-8 pb-7">
              {/* Top label */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex items-center justify-center gap-1.5 mb-6"
              >
                <Sparkles className="h-3 w-3 text-purple-300" />
                <span className="text-[10px] font-bold uppercase tracking-[0.35em] text-white/40">
                  Your Taste Identity
                </span>
              </motion.div>

              {/* Emoji */}
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.4, type: 'spring', stiffness: 200, damping: 12 }}
                className="text-center mb-4"
              >
                <span className="text-7xl drop-shadow-2xl">{archetype.emoji}</span>
              </motion.div>

              {/* Archetype name */}
              <motion.h1
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="text-center text-[28px] font-black text-white tracking-tight leading-tight mb-2"
              >
                {archetype.name}
              </motion.h1>

              {/* Description */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-center text-[13px] text-white/50 leading-relaxed mb-5 max-w-[260px] mx-auto"
              >
                {archetype.description}
              </motion.p>

              {/* Divider */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.9, duration: 0.5 }}
                className="h-px bg-gradient-to-r from-transparent via-white/15 to-transparent mb-5"
              />

              {/* Stats row */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
                className="flex items-center justify-center gap-4 mb-5"
              >
                {/* Rarity */}
                <div className="text-center flex-1">
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30 mb-1">Rarity</p>
                  <p className="text-2xl font-black text-white">
                    {rarityPct !== null ? (
                      <>
                        {rarityPct}
                        <span className="text-sm text-white/40">%</span>
                      </>
                    ) : (
                      <span className="text-lg">💎</span>
                    )}
                  </p>
                  <p className="text-[9px] text-white/25 mt-0.5">
                    {rarityPct !== null ? 'rarer than most' : 'unique'}
                  </p>
                </div>

                {/* Separator */}
                <div className="w-px h-10 bg-white/10" />

                {/* Personality */}
                <div className="text-center flex-1">
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30 mb-1">Type</p>
                  {personalityCode && personalityName ? (
                    <>
                      <p className="text-lg font-black text-white leading-tight">{personalityCode}</p>
                      <p className="text-[9px] text-white/25 mt-0.5">{personalityName}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg">✨</p>
                      <p className="text-[9px] text-white/25 mt-0.5">Emerging</p>
                    </>
                  )}
                </div>
              </motion.div>

              {/* CTA button */}
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 }}
                onClick={handleDismiss}
                className="w-full py-3.5 rounded-2xl font-bold text-sm text-white relative overflow-hidden active:scale-[0.97] transition-transform"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #db2777)',
                  boxShadow: '0 8px 24px -4px rgba(124,58,237,0.4)',
                }}
              >
                <span className="relative z-10">Explore My Taste →</span>
              </motion.button>
            </div>

            {/* Watermark */}
            <div className="absolute bottom-2 right-4 text-white/[0.06] text-[9px] font-bold tracking-widest uppercase">
              Versa
            </div>
          </div>

          {/* Reflection/glow under card */}
          <div
            className="absolute -bottom-8 left-[10%] right-[10%] h-16 rounded-full blur-2xl opacity-30"
            style={{ background: 'linear-gradient(90deg, rgba(124,58,237,0.3), rgba(219,39,119,0.3))' }}
          />
        </motion.div>
      )}
    </motion.div>,
    document.body,
  );
}
