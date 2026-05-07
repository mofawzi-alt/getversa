import { useRef, useCallback, useState } from 'react';
import { Share2 } from 'lucide-react';
import { toast } from 'sonner';
import versaLogoImg from '@/assets/versa-logo.png';

interface Props {
  userAName: string;
  userBName: string;
  score: number;
  topCategory?: string;
  categoryMatches?: Array<{ category: string; percent: number }>;
}

export default function ShareCompatibilityImage({ userAName, userBName, score, topCategory, categoryMatches }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [generating, setGenerating] = useState(false);

  const generateImage = useCallback(async (): Promise<Blob | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const W = 1080;
    const H = 1920;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    // Background
    const grad = ctx.createLinearGradient(0, 0, W, H);
    if (score >= 75) {
      grad.addColorStop(0, '#0a2e1a');
      grad.addColorStop(0.5, '#134e2d');
      grad.addColorStop(1, '#0a2e1a');
    } else if (score >= 50) {
      grad.addColorStop(0, '#0d1b3e');
      grad.addColorStop(0.5, '#1a237e');
      grad.addColorStop(1, '#0d1b3e');
    } else {
      grad.addColorStop(0, '#2e0a0a');
      grad.addColorStop(0.5, '#4a1515');
      grad.addColorStop(1, '#2e0a0a');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Glow
    const glow = ctx.createRadialGradient(W / 2, 700, 0, W / 2, 700, 400);
    glow.addColorStop(0, score >= 75 ? 'rgba(34, 197, 94, 0.2)' : score >= 50 ? 'rgba(99, 102, 241, 0.2)' : 'rgba(239, 68, 68, 0.15)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';

    // Eyebrow
    ctx.font = '600 26px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('VERSA COMPATIBILITY', W / 2, 300);

    // Names
    ctx.font = '700 42px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(truncate(`@${userAName}`, 20), W / 2, 420);
    
    ctx.font = '500 30px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('×', W / 2, 475);
    
    ctx.font = '700 42px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(truncate(`@${userBName}`, 20), W / 2, 530);

    // Big score
    ctx.font = 'bold 180px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${score}%`, W / 2, 800);

    // Label
    const label = score >= 90 ? 'Soul Twins 🔥' :
                  score >= 75 ? 'Best Match 💫' :
                  score >= 50 ? 'Good Vibes 🤝' :
                  score >= 25 ? 'Different Minds 🤔' : 'Polar Opposites 💥';
    ctx.font = '600 36px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(label, W / 2, 890);

    // Category bars
    if (categoryMatches?.length) {
      const top3 = categoryMatches.slice(0, 3);
      let barY = 1020;
      ctx.font = '500 24px "Inter", sans-serif';
      
      for (const cat of top3) {
        // Category name
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText(cat.category, 140, barY);

        // Bar bg
        const barX = 140;
        const barW = 800;
        const barH = 24;
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.roundRect(barX, barY + 12, barW, barH, 12);
        ctx.fill();

        // Bar fill
        ctx.fillStyle = score >= 75 ? 'rgba(34, 197, 94, 0.6)' : 'rgba(99, 102, 241, 0.6)';
        ctx.beginPath();
        ctx.roundRect(barX, barY + 12, (cat.percent / 100) * barW, barH, 12);
        ctx.fill();

        // Percent
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillText(`${cat.percent}%`, barX + barW, barY);

        barY += 80;
      }
      ctx.textAlign = 'center';
    }

    // CTA
    ctx.font = '500 28px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('Compare yours → getversa.app', W / 2, H - 200);

    // Logo
    try {
      const logo = new Image();
      logo.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        logo.onload = () => resolve();
        logo.onerror = reject;
        logo.src = versaLogoImg;
      });
      const logoH = 50;
      const logoW = (logo.width / logo.height) * logoH;
      ctx.filter = 'invert(1)';
      ctx.drawImage(logo, (W - logoW) / 2, H - 140, logoW, logoH);
      ctx.filter = 'none';
    } catch {
      ctx.font = 'bold 36px "Space Grotesk", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText('VERSA', W / 2, H - 120);
    }

    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  }, [userAName, userBName, score, categoryMatches]);

  const handleShare = useCallback(async () => {
    setGenerating(true);
    try {
      const blob = await generateImage();
      if (!blob) { toast.error('Failed to generate card'); return; }
      const file = new File([blob], 'versa-compatibility.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${score}% compatible on Versa`,
          text: `@${userAName} & @${userBName} are ${score}% compatible! 🤝`,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'versa-compatibility.png';
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Card saved! Share it 📲');
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') toast.error('Share failed');
    } finally {
      setGenerating(false);
    }
  }, [generateImage, score, userAName, userBName]);

  return (
    <>
      <button
        onClick={handleShare}
        disabled={generating}
        className="w-full h-11 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-50"
      >
        <Share2 className="h-4 w-4" />
        {generating ? 'Generating...' : 'Share Compatibility'}
      </button>
      <canvas ref={canvasRef} className="hidden" />
    </>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
