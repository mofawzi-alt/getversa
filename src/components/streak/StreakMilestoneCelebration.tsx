import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, X, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ShareToStoryButton from '@/components/stories/ShareToStoryButton';
import { toast } from 'sonner';
import versaLogoImg from '@/assets/versa-logo.png';

const STREAK_MILESTONES = [3, 7, 14, 30] as const;
const SEEN_KEY = 'versa_streak_milestones_seen';

function getSeenMilestones(): number[] {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch { return []; }
}
function markMilestoneSeen(day: number) {
  const seen = getSeenMilestones();
  if (!seen.includes(day)) {
    seen.push(day);
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  }
}

export function checkStreakMilestone(currentStreak: number): number | null {
  const seen = getSeenMilestones();
  for (const m of STREAK_MILESTONES) {
    if (currentStreak >= m && !seen.includes(m)) {
      return m;
    }
  }
  return null;
}

interface Props {
  streakDays: number;
  open: boolean;
  onClose: () => void;
}

export default function StreakMilestoneCelebration({ streakDays, open, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (open) markMilestoneSeen(streakDays);
  }, [open, streakDays]);

  const generateBadgeImage = useCallback(async (): Promise<Blob | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const W = 1080;
    const H = 1920;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    // Background gradient (royal blue to dark)
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#1a237e');
    grad.addColorStop(0.5, '#283593');
    grad.addColorStop(1, '#0d1b3e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Decorative circles
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(200, 400, 300, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(880, 1400, 250, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // Fire emoji cluster
    ctx.font = '120px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🔥', W / 2, 580);

    // Streak number — large
    ctx.font = 'bold 220px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(String(streakDays), W / 2, 830);

    // "DAY STREAK" label
    ctx.font = 'bold 48px "Space Grotesk", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.letterSpacing = '12px';
    ctx.fillText('DAY STREAK', W / 2, 910);

    // Divider line
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 150, 970);
    ctx.lineTo(W / 2 + 150, 970);
    ctx.stroke();

    // "on Versa" text
    ctx.font = '36px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(`${streakDays} day streak on Versa`, W / 2, 1040);

    // Motivational message based on milestone
    let message = '';
    if (streakDays >= 30) message = 'Legendary consistency 👑';
    else if (streakDays >= 14) message = 'Two weeks strong 💪';
    else if (streakDays >= 7) message = 'One week of insights 🎯';
    else if (streakDays >= 3) message = 'Building momentum 🚀';

    if (message) {
      ctx.font = '32px "Inter", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(message, W / 2, 1120);
    }

    // Versa logo at bottom
    try {
      const logo = new Image();
      logo.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        logo.onload = () => resolve();
        logo.onerror = reject;
        logo.src = versaLogoImg;
      });
      const logoH = 60;
      const logoW = (logo.width / logo.height) * logoH;
      // Invert logo for dark bg
      ctx.filter = 'invert(1)';
      ctx.drawImage(logo, (W - logoW) / 2, H - 200, logoW, logoH);
      ctx.filter = 'none';
    } catch {
      ctx.font = 'bold 40px "Space Grotesk", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('VERSA', W / 2, H - 170);
    }

    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  }, [streakDays]);

  const handleShare = useCallback(async () => {
    setGenerating(true);
    try {
      const blob = await generateBadgeImage();
      if (!blob) { toast.error('Failed to generate badge'); return; }

      const file = new File([blob], `versa-streak-${streakDays}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${streakDays} Day Streak on Versa`,
          text: `I'm on a ${streakDays} day streak on Versa! 🔥`,
        });
      } else {
        // Fallback: download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `versa-streak-${streakDays}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Badge downloaded! Share it to your stories 🔥');
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') toast.error('Share failed');
    } finally {
      setGenerating(false);
    }
  }, [generateBadgeImage, streakDays]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="relative w-full max-w-sm rounded-3xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/20 text-white"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Card content */}
            <div className="bg-gradient-to-b from-[hsl(225,73%,25%)] to-[hsl(225,73%,15%)] p-8 text-center text-white">
              {/* Animated fire */}
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="text-6xl mb-4"
              >
                🔥
              </motion.div>

              <h2 className="text-lg font-medium opacity-80 mb-2">Congratulations!</h2>

              <div className="flex items-center justify-center gap-2 mb-2">
                <Flame className="h-8 w-8 text-orange-400" />
                <span className="text-6xl font-display font-bold">{streakDays}</span>
                <Flame className="h-8 w-8 text-orange-400" />
              </div>

              <p className="text-xl font-display font-semibold mb-1">Day Streak!</p>
              <p className="text-sm opacity-70 mb-6">
                {streakDays >= 30
                  ? "Legendary 👑 30 days on Versa — less than 1% of users reach this"
                  : streakDays >= 14
                  ? "Two weeks 🏆 You're one of Versa's most loyal voters"
                  : streakDays >= 7
                  ? "One week strong 💪 You're in the top 10% of Versa voters"
                  : "You're on a 3-day streak 🔥 You're just getting started"}
              </p>

              {/* Share button */}
              <Button
                onClick={handleShare}
                disabled={generating}
                className="w-full h-14 rounded-2xl bg-white text-[hsl(225,73%,30%)] hover:bg-white/90 font-bold text-base gap-2"
              >
                <Share2 className="h-5 w-5" />
                {generating ? 'Generating...' : 'Share to Stories'}
              </Button>

              <ShareToStoryButton
                storyType="achievement"
                content={{
                  badge_name: `${streakDays}-Day Streak`,
                  title: `${streakDays}-Day Streak 🔥`,
                  description: `I'm on a ${streakDays} day voting streak on Versa!`,
                }}
                variant="default"
                className="w-full h-12 rounded-2xl bg-white/20 border-white/30 text-white hover:bg-white/30"
              />

              <button onClick={onClose} className="mt-4 text-sm opacity-50 hover:opacity-80">
                Maybe later
              </button>
            </div>

            {/* Hidden canvas for image generation */}
            <canvas ref={canvasRef} className="hidden" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
