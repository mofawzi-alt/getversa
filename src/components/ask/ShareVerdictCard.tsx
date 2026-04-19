import { useRef, useCallback, useState } from 'react';
import { Share2 } from 'lucide-react';
import { toast } from 'sonner';
import versaLogoImg from '@/assets/versa-logo.png';
import type { Verdict } from './VerdictCard';

interface Props {
  verdict: Verdict;
}

export default function ShareVerdictCard({ verdict }: Props) {
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

    // Background gradient — Versa brand
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#0d1b3e');
    grad.addColorStop(0.4, '#1a237e');
    grad.addColorStop(0.7, '#283593');
    grad.addColorStop(1, '#0d1b3e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Decorative circles
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) {
      const x = 100 + i * 240;
      const y = 200 + Math.sin(i) * 180;
      ctx.beginPath();
      ctx.arc(x, y, 180 + i * 20, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';

    // "VERSA SAYS" eyebrow
    ctx.font = '600 26px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText('★  VERSA SAYS  ★', W / 2, 280);

    // Question (wrap)
    ctx.font = '500 38px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const qWords = verdict.question.split(' ');
    let qLine = '';
    let qY = 380;
    const qMax = 880;
    const qLines: string[] = [];
    for (const w of qWords) {
      const test = qLine + w + ' ';
      if (ctx.measureText(test).width > qMax && qLine) {
        qLines.push(qLine.trim());
        qLine = w + ' ';
      } else {
        qLine = test;
      }
    }
    if (qLine.trim()) qLines.push(qLine.trim());
    const qLinesShown = qLines.slice(0, 3);
    qLinesShown.forEach((l) => {
      ctx.fillText(l, W / 2, qY);
      qY += 52;
    });

    // PICK X — hero
    const pickY = 720;
    ctx.font = '600 32px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('Pick', W / 2, pickY);

    // Winner label (auto-fit)
    let winnerSize = 130;
    ctx.font = `bold ${winnerSize}px "Space Grotesk", sans-serif`;
    while (ctx.measureText(verdict.winner_label).width > 920 && winnerSize > 60) {
      winnerSize -= 8;
      ctx.font = `bold ${winnerSize}px "Space Grotesk", sans-serif`;
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillText(verdict.winner_label, W / 2, pickY + winnerSize + 10);

    // % bar
    const barY = pickY + winnerSize + 110;
    const barX = 140;
    const barW = W - barX * 2;
    const barH = 72;

    // bar background
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 36);
    ctx.fill();

    // winner fill
    const fillW = (verdict.winner_pct / 100) * barW;
    const fillGrad = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
    fillGrad.addColorStop(0, '#ffffff');
    fillGrad.addColorStop(1, '#e0e7ff');
    ctx.fillStyle = fillGrad;
    ctx.beginPath();
    ctx.roundRect(barX, barY, fillW, barH, 36);
    ctx.fill();

    // winner % inside bar
    ctx.font = 'bold 38px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#0d1b3e';
    ctx.textAlign = 'left';
    ctx.fillText(`${verdict.winner_pct}%`, barX + 28, barY + 48);

    // loser % on right
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText(`${verdict.loser_pct}%`, barX + barW - 28, barY + 48);

    ctx.textAlign = 'center';

    // Option labels under bar
    ctx.font = '600 22px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textAlign = 'left';
    const winnerOpt = verdict.winner_side === 'A' ? verdict.option_a : verdict.option_b;
    const loserOpt = verdict.winner_side === 'A' ? verdict.option_b : verdict.option_a;
    ctx.fillText(truncate(winnerOpt, 22), barX + 8, barY + barH + 38);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(truncate(loserOpt, 22), barX + barW - 8, barY + barH + 38);
    ctx.textAlign = 'center';

    // Sample size
    ctx.font = '500 24px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(
      `Based on ${verdict.total_votes.toLocaleString()} Egyptian votes`,
      W / 2,
      barY + barH + 110,
    );

    // Viewer line (if any)
    if (verdict.viewer_line) {
      ctx.font = '600 26px "Inter", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`👥  ${verdict.viewer_line}`, W / 2, barY + barH + 170);
    }

    // Reason quote
    if (verdict.reason) {
      ctx.font = 'italic 28px "Inter", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      const rWords = verdict.reason.split(' ');
      let rLine = '';
      let rY = 1490;
      const rMax = 880;
      const rLines: string[] = [];
      for (const w of rWords) {
        const test = rLine + w + ' ';
        if (ctx.measureText(test).width > rMax && rLine) {
          rLines.push(rLine.trim());
          rLine = w + ' ';
        } else {
          rLine = test;
        }
      }
      if (rLine.trim()) rLines.push(rLine.trim());
      rLines.slice(0, 3).forEach((l) => {
        ctx.fillText(`“${l}”`, W / 2, rY);
        rY += 42;
      });
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
      ctx.filter = 'invert(1)';
      ctx.drawImage(logo, (W - logoW) / 2, H - 220, logoW, logoH);
      ctx.filter = 'none';
    } catch {
      ctx.font = 'bold 40px "Space Grotesk", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText('VERSA', W / 2, H - 200);
    }

    ctx.font = '500 26px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('Ask Versa · getversa.app', W / 2, H - 140);

    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }, [verdict]);

  const handleShare = useCallback(async () => {
    setGenerating(true);
    try {
      const blob = await generateImage();
      if (!blob) {
        toast.error('Failed to generate card');
        return;
      }
      const file = new File([blob], 'versa-verdict.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Versa says: pick ${verdict.winner_label}`,
          text: `${verdict.winner_pct}% of Egyptians pick ${verdict.winner_label}. ${verdict.question}`,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'versa-verdict.png';
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Verdict card saved! Share it 📲');
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') toast.error('Share failed');
    } finally {
      setGenerating(false);
    }
  }, [generateImage, verdict]);

  return (
    <>
      <button
        onClick={handleShare}
        disabled={generating}
        className="w-full h-10 rounded-full border border-border bg-card text-foreground text-sm font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition disabled:opacity-50"
      >
        <Share2 className="h-4 w-4" />
        {generating ? 'Generating…' : 'Share verdict'}
      </button>
      <canvas ref={canvasRef} className="hidden" />
    </>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
