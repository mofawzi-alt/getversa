import { useRef, useCallback, useState } from 'react';
import { Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import versaLogoImg from '@/assets/versa-logo.png';

interface TasteCardProps {
  archetype: string;
  description: string;
  topCategory: string;
  totalVotes: number;
  streak: number;
  personalityCode?: string;
  personalityName?: string;
}

export default function ShareableTasteCard({ archetype, description, topCategory, totalVotes, streak, personalityCode, personalityName }: TasteCardProps) {
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

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#0d1b3e');
    grad.addColorStop(0.3, '#1a237e');
    grad.addColorStop(0.7, '#283593');
    grad.addColorStop(1, '#0d1b3e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Subtle decorative elements
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 5; i++) {
      const x = 100 + i * 200;
      const y = 300 + Math.sin(i) * 200;
      ctx.beginPath();
      ctx.arc(x, y, 150 + i * 30, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // "MY TASTE PROFILE" label at top
    ctx.font = '600 28px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '8px';
    ctx.fillText('MY TASTE PROFILE', W / 2, 340);

    // Archetype name — hero text
    ctx.font = 'bold 96px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(archetype, W / 2, 520);

    // Underline accent
    const textWidth = Math.min(ctx.measureText(archetype).width, 800);
    const lineGrad = ctx.createLinearGradient(W / 2 - textWidth / 2, 0, W / 2 + textWidth / 2, 0);
    lineGrad.addColorStop(0, 'rgba(255,255,255,0)');
    lineGrad.addColorStop(0.3, 'rgba(255,255,255,0.5)');
    lineGrad.addColorStop(0.7, 'rgba(255,255,255,0.5)');
    lineGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(W / 2 - textWidth / 2, 545);
    ctx.lineTo(W / 2 + textWidth / 2, 545);
    ctx.stroke();

    // Description text — wrap lines
    ctx.font = '32px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    const words = description.split(' ');
    let line = '';
    let y = 630;
    const maxWidth = 800;
    for (const word of words) {
      const testLine = line + word + ' ';
      if (ctx.measureText(testLine).width > maxWidth && line) {
        ctx.fillText(line.trim(), W / 2, y);
        line = word + ' ';
        y += 48;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), W / 2, y);

    // Stats section
    const statsY = 880;
    
    // Stats boxes
    const stats = [
      { label: 'VOTES', value: String(totalVotes) },
      { label: 'STREAK', value: `${streak}d` },
      { label: 'TOP', value: topCategory },
    ];

    const boxW = 260;
    const gap = 40;
    const totalW = stats.length * boxW + (stats.length - 1) * gap;
    const startX = (W - totalW) / 2;

    stats.forEach((stat, i) => {
      const x = startX + i * (boxW + gap);
      
      // Box background
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath();
      ctx.roundRect(x, statsY, boxW, 140, 20);
      ctx.fill();

      // Border
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, statsY, boxW, 140, 20);
      ctx.stroke();

      // Value
      ctx.font = 'bold 44px "Space Grotesk", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(stat.value, x + boxW / 2, statsY + 65);

      // Label
      ctx.font = '600 18px "Inter", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillText(stat.label, x + boxW / 2, statsY + 110);
    });

    // Versa logo at bottom
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
      ctx.drawImage(logo, (W - logoW) / 2, H - 220, logoW, logoH);
      ctx.filter = 'none';
    } catch {
      ctx.font = 'bold 36px "Space Grotesk", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText('VERSA', W / 2, H - 200);
    }

    // "versa.app" tagline
    ctx.font = '24px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('getversa.lovable.app', W / 2, H - 150);

    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  }, [archetype, description, topCategory, totalVotes, streak]);

  const handleShare = useCallback(async () => {
    setGenerating(true);
    try {
      const blob = await generateImage();
      if (!blob) { toast.error('Failed to generate card'); return; }

      const file = new File([blob], 'versa-taste-profile.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `I'm ${archetype} on Versa`,
          text: `My taste profile: ${archetype} — ${description}`,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'versa-taste-profile.png';
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Taste card downloaded! Share it to your stories 🎨');
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') toast.error('Share failed');
    } finally {
      setGenerating(false);
    }
  }, [generateImage, archetype, description]);

  return (
    <div className="space-y-4">
      {/* Preview card */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[hsl(225,73%,15%)] to-[hsl(225,73%,25%)] p-6 text-center text-white">
        <div className="absolute inset-0 opacity-5">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                width: 100 + i * 60,
                height: 100 + i * 60,
                left: `${20 + i * 25}%`,
                top: `${10 + i * 20}%`,
              }}
            />
          ))}
        </div>

        <p className="text-[10px] font-semibold tracking-[4px] text-white/40 uppercase mb-3">My Taste Profile</p>
        <h2 className="text-3xl font-display font-bold mb-1">{archetype}</h2>
        {personalityCode && personalityName && (
          <p className="text-xs font-mono text-white/50 tracking-[3px] mb-2">{personalityCode} — {personalityName}</p>
        )}
        <p className="text-sm text-white/70 leading-relaxed mb-5 max-w-[260px] mx-auto">{description}</p>

        <div className="flex justify-center gap-3">
          {[
            { label: 'Votes', value: totalVotes },
            { label: 'Streak', value: `${streak}d` },
            { label: 'Top', value: topCategory },
          ].map((s) => (
            <div key={s.label} className="px-4 py-2.5 rounded-xl bg-white/10 border border-white/10 min-w-[70px]">
              <div className="text-lg font-bold">{s.value}</div>
              <div className="text-[9px] font-semibold text-white/40 uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <Button
        onClick={handleShare}
        disabled={generating}
        className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-bold text-base gap-2"
      >
        <Share2 className="h-5 w-5" />
        {generating ? 'Generating...' : 'Share Taste Profile'}
      </Button>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
