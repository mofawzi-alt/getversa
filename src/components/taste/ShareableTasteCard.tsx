import { useRef, useCallback, useState } from 'react';
import { Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import versaLogoImg from '@/assets/versa-wordmark.png';

interface TasteCardProps {
  archetype: string;
  description: string;
  topCategory: string;
  totalVotes: number;
  streak: number;
  personalityCode?: string;
  personalityName?: string;
  personalityEmoji?: string;
}

export default function ShareableTasteCard({ archetype, description, topCategory, totalVotes, streak, personalityCode, personalityName, personalityEmoji }: TasteCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [generating, setGenerating] = useState(false);

  const emoji = personalityEmoji || '✨';

  const generateImage = useCallback(async (): Promise<Blob | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const W = 1080;
    const H = 1920;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    // Rich multi-stop background
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#0a0f2c');
    grad.addColorStop(0.25, '#111b4d');
    grad.addColorStop(0.5, '#1a2980');
    grad.addColorStop(0.75, '#26348a');
    grad.addColorStop(1, '#0d1440');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Radial glow behind archetype
    const glowGrad = ctx.createRadialGradient(W / 2, 680, 0, W / 2, 680, 500);
    glowGrad.addColorStop(0, 'rgba(99, 102, 241, 0.25)');
    glowGrad.addColorStop(0.5, 'rgba(99, 102, 241, 0.08)');
    glowGrad.addColorStop(1, 'rgba(99, 102, 241, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, W, H);

    // Decorative floating orbs
    const orbs = [
      { x: 150, y: 350, r: 200, alpha: 0.06 },
      { x: 900, y: 500, r: 280, alpha: 0.04 },
      { x: 540, y: 1400, r: 350, alpha: 0.05 },
      { x: 100, y: 1200, r: 180, alpha: 0.04 },
      { x: 950, y: 1500, r: 150, alpha: 0.06 },
    ];
    for (const orb of orbs) {
      const orbGrad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r);
      orbGrad.addColorStop(0, `rgba(255, 255, 255, ${orb.alpha * 2})`);
      orbGrad.addColorStop(1, `rgba(255, 255, 255, 0)`);
      ctx.fillStyle = orbGrad;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Thin decorative line at top
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(100, 250);
    ctx.lineTo(W - 100, 250);
    ctx.stroke();

    // Emoji large
    ctx.font = '120px serif';
    ctx.textAlign = 'center';
    ctx.fillText(emoji, W / 2, 440);

    // "MY TASTE PROFILE" label
    ctx.font = '700 26px "Inter", "SF Pro Display", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.letterSpacing = '10px';
    ctx.fillText('M Y   T A S T E   P R O F I L E', W / 2, 530);

    // Archetype name — big bold
    ctx.font = 'bold 88px "Space Grotesk", "SF Pro Display", sans-serif';
    ctx.fillStyle = '#ffffff';
    // Auto-size if too wide
    let fontSize = 88;
    while (ctx.measureText(archetype).width > 900 && fontSize > 50) {
      fontSize -= 4;
      ctx.font = `bold ${fontSize}px "Space Grotesk", "SF Pro Display", sans-serif`;
    }
    ctx.fillText(archetype, W / 2, 660);

    // Glowing underline
    const tw = Math.min(ctx.measureText(archetype).width + 60, 900);
    const ulGrad = ctx.createLinearGradient(W / 2 - tw / 2, 0, W / 2 + tw / 2, 0);
    ulGrad.addColorStop(0, 'rgba(99, 102, 241, 0)');
    ulGrad.addColorStop(0.2, 'rgba(129, 140, 248, 0.6)');
    ulGrad.addColorStop(0.5, 'rgba(165, 180, 252, 0.8)');
    ulGrad.addColorStop(0.8, 'rgba(129, 140, 248, 0.6)');
    ulGrad.addColorStop(1, 'rgba(99, 102, 241, 0)');
    ctx.strokeStyle = ulGrad;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(W / 2 - tw / 2, 690);
    ctx.lineTo(W / 2 + tw / 2, 690);
    ctx.stroke();

    // Personality name subtitle
    if (personalityName) {
      ctx.font = '600 30px "Inter", sans-serif';
      ctx.fillStyle = 'rgba(165, 180, 252, 0.7)';
      ctx.fillText(personalityName, W / 2, 745);
    }

    // Description — wrapped
    ctx.font = '34px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    const words = description.split(' ');
    let line = '';
    let y = personalityName ? 830 : 790;
    const maxWidth = 800;
    for (const word of words) {
      const testLine = line + word + ' ';
      if (ctx.measureText(testLine).width > maxWidth && line) {
        ctx.fillText(line.trim(), W / 2, y);
        line = word + ' ';
        y += 52;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), W / 2, y);

    // Stats section — glass cards
    const statsY = y + 100;
    const stats = [
      { label: 'VOTES', value: String(totalVotes), icon: '🗳️' },
      { label: 'STREAK', value: `${streak}d`, icon: '🔥' },
      { label: 'TOP', value: topCategory, icon: '👑' },
    ];

    const boxW = 270;
    const gap = 30;
    const totalW = stats.length * boxW + (stats.length - 1) * gap;
    const startX = (W - totalW) / 2;

    stats.forEach((stat, i) => {
      const x = startX + i * (boxW + gap);

      // Glass background
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.beginPath();
      ctx.roundRect(x, statsY, boxW, 170, 24);
      ctx.fill();

      // Glass border
      const borderGrad = ctx.createLinearGradient(x, statsY, x, statsY + 170);
      borderGrad.addColorStop(0, 'rgba(255,255,255,0.2)');
      borderGrad.addColorStop(1, 'rgba(255,255,255,0.05)');
      ctx.strokeStyle = borderGrad;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(x, statsY, boxW, 170, 24);
      ctx.stroke();

      // Icon
      ctx.font = '32px serif';
      ctx.fillText(stat.icon, x + boxW / 2, statsY + 45);

      // Value
      ctx.font = 'bold 46px "Space Grotesk", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(stat.value, x + boxW / 2, statsY + 100);

      // Label
      ctx.font = '600 16px "Inter", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText(stat.label, x + boxW / 2, statsY + 145);
    });

    // Bottom section — divider
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(100, H - 280);
    ctx.lineTo(W - 100, H - 280);
    ctx.stroke();

    // Versa wordmark logo at bottom
    try {
      const logo = new Image();
      logo.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        logo.onload = () => resolve();
        logo.onerror = reject;
        logo.src = versaLogoImg;
      });
      const destH = 60;
      const destW = (logo.width / logo.height) * destH;
      ctx.drawImage(logo, (W - destW) / 2, H - 240, destW, destH);
    } catch {
      ctx.font = 'bold 40px "Space Grotesk", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText('VERSA', W / 2, H - 200);
    }

    // URL
    ctx.font = '600 22px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillText('getversa.app', W / 2, H - 155);

    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  }, [archetype, description, topCategory, totalVotes, streak, personalityName, emoji]);

  const handleShare = useCallback(async () => {
    setGenerating(true);
    try {
      const blob = await generateImage();
      if (!blob) { toast.error('Failed to generate card'); return; }

      const file = new File([blob], 'versa-taste-profile.jpg', { type: 'image/jpeg' });

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
        a.download = 'versa-taste-profile.jpg';
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
      <div className="relative rounded-3xl overflow-hidden p-6 text-center text-white"
        style={{
          background: 'linear-gradient(160deg, #0a0f2c 0%, #111b4d 25%, #1a2980 50%, #26348a 75%, #0d1440 100%)',
        }}
      >
        {/* Glow effect */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 50% 45%, rgba(99,102,241,0.2) 0%, transparent 60%)',
          }}
        />

        {/* Decorative orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[
            { size: 160, left: '10%', top: '5%', opacity: 0.06 },
            { size: 220, left: '75%', top: '15%', opacity: 0.04 },
            { size: 120, left: '5%', top: '70%', opacity: 0.05 },
          ].map((o, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: o.size,
                height: o.size,
                left: o.left,
                top: o.top,
                background: `radial-gradient(circle, rgba(255,255,255,${o.opacity * 3}) 0%, transparent 70%)`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10">
          {/* Emoji */}
          <div className="text-5xl mb-2">{emoji}</div>

          <p className="text-[10px] font-bold tracking-[5px] text-white/30 uppercase mb-2">
            My Taste Profile
          </p>

          <h2 className="text-3xl font-display font-bold mb-0.5">{archetype}</h2>

          {personalityName && (
            <p className="text-xs font-semibold text-indigo-300/70 mb-2">{personalityName}</p>
          )}

          <p className="text-sm text-white/65 leading-relaxed mb-5 max-w-[260px] mx-auto">{description}</p>

          <div className="flex justify-center gap-2.5">
            {[
              { label: 'Votes', value: totalVotes, icon: '🗳️' },
              { label: 'Streak', value: `${streak}d`, icon: '🔥' },
              { label: 'Top', value: topCategory, icon: '👑' },
            ].map((s) => (
              <div key={s.label} className="px-3.5 py-2.5 rounded-xl min-w-[72px]"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <div className="text-xs mb-0.5">{s.icon}</div>
                <div className="text-base font-bold">{s.value}</div>
                <div className="text-[8px] font-bold text-white/35 uppercase tracking-widest">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Branded logo — show full image small enough that the middle row dominates */}
          <div className="mt-5 flex justify-center overflow-hidden" style={{ maxHeight: 28 }}>
            <img src={versaLogoImg} alt="Versa" className="h-20 object-cover" 
              style={{ objectPosition: 'center 50%' }} />
          </div>
          <p className="text-[10px] text-white/20 mt-1">getversa.app</p>
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
