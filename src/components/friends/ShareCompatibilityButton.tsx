import { useRef, useCallback, useState } from 'react';
import { Share2 } from 'lucide-react';
import { toast } from 'sonner';
import versaLogoImg from '@/assets/versa-logo.png';

interface Props {
  friendUsername: string;
  compatibilityScore: number;
  matchLabel: string;
}

function getMatchColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#E8392A';
  if (score >= 40) return '#eab308';
  return '#f97316';
}

export default function ShareCompatibilityButton({ friendUsername, compatibilityScore, matchLabel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [generating, setGenerating] = useState(false);

  const generateImage = useCallback(async (): Promise<Blob | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const W = 1080;
    const H = 1350;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    // Background
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#0d1b3e');
    grad.addColorStop(0.5, '#1a237e');
    grad.addColorStop(1, '#0d1b3e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Subtle circles
    ctx.globalAlpha = 0.04;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(200 + i * 220, 400 + Math.sin(i) * 150, 120 + i * 40, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Logo
    ctx.textAlign = 'center';
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
      ctx.drawImage(logo, (W - logoW) / 2, 160, logoW, logoH);
      ctx.filter = 'none';
    } catch {
      ctx.font = 'bold 40px "Space Grotesk", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText('VERSA', W / 2, 200);
    }

    // "Me and @friend"
    ctx.font = '600 44px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(`Me and @${friendUsername}`, W / 2, 320);

    // Compatibility percentage — large
    const accentColor = getMatchColor(compatibilityScore);
    ctx.font = 'bold 220px "Space Grotesk", sans-serif';
    ctx.fillStyle = accentColor;
    ctx.fillText(`${compatibilityScore}%`, W / 2, 620);

    // Match label
    ctx.font = 'bold 48px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(matchLabel, W / 2, 720);

    // Decorative ring
    ctx.beginPath();
    ctx.arc(W / 2, 540, 260, 0, Math.PI * 2);
    ctx.strokeStyle = `${accentColor}22`;
    ctx.lineWidth = 4;
    ctx.stroke();

    // CTA
    ctx.font = '28px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('Find your match on Versa — getversa.app', W / 2, H - 140);

    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  }, [friendUsername, compatibilityScore, matchLabel]);

  const handleShare = useCallback(async () => {
    setGenerating(true);
    try {
      const blob = await generateImage();
      if (!blob) { toast.error('Failed to generate card'); return; }

      const file = new File([blob], 'versa-compatibility.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Me and @${friendUsername} on Versa`,
          text: `We're ${compatibilityScore}% compatible — ${matchLabel}!`,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'versa-compatibility.png';
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Compatibility card downloaded!');
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') toast.error('Share failed');
    } finally {
      setGenerating(false);
    }
  }, [generateImage, friendUsername, compatibilityScore, matchLabel]);

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); handleShare(); }}
        disabled={generating}
        className="p-1.5 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
        aria-label="Share compatibility"
      >
        <Share2 className="h-3.5 w-3.5" />
      </button>
      <canvas ref={canvasRef} className="hidden" />
    </>
  );
}
