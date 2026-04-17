import { useRef, useCallback, useState } from 'react';
import { Share2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export interface DuelSharePoll {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
}

interface ShareDuelResultCardProps {
  duelId: string;
  myName: string;
  otherName: string;
  myChoices: string[];   // ['A','B',...]
  otherChoices: string[];
  polls: DuelSharePoll[];
  matchRate: number;     // 0..100
  matches: number;       // matched count
}

/**
 * Premium 9:16 share card for Versa Arena duel results.
 * Renders to canvas → shares as image via navigator.share / falls back to download + copy.
 */
export default function ShareDuelResultCard({
  duelId,
  myName,
  otherName,
  myChoices,
  otherChoices,
  polls,
  matchRate,
  matches,
}: ShareDuelResultCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);

  const shareUrl = `${window.location.origin}/play/duels/${duelId}`;
  const displayHost = (() => {
    try {
      return new URL(window.location.origin).host;
    } catch {
      return 'getversa.app';
    }
  })();

  const generate = useCallback(async (): Promise<Blob | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const W = 1080;
    const H = 1920;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // === Background: deep premium gradient with subtle grid ===
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0a0a0a');
    bg.addColorStop(0.5, '#141414');
    bg.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let y = 0; y < H; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Soft red glow blob in top corner (Versa accent)
    const glow = ctx.createRadialGradient(W * 0.85, 200, 40, W * 0.85, 200, 600);
    glow.addColorStop(0, 'rgba(232,57,42,0.35)');
    glow.addColorStop(1, 'rgba(232,57,42,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, 700);

    // === Header: VERSA ARENA badge ===
    ctx.fillStyle = 'rgba(232,57,42,0.12)';
    const badgeW = 380;
    const badgeH = 64;
    const badgeX = (W - badgeW) / 2;
    const badgeY = 110;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 32);
    ctx.fill();
    ctx.strokeStyle = 'rgba(232,57,42,0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#E8392A';
    ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚔️  VERSA ARENA  ⚔️', W / 2, badgeY + 42);

    // === Title: vs ===
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
    const left = truncate(myName || 'You', 12);
    const right = truncate(otherName || 'Friend', 12);
    ctx.fillText(`${left}  vs  ${right}`, W / 2, 260);

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '500 30px system-ui, -apple-system, sans-serif';
    ctx.fillText(`${polls.length}-poll head-to-head`, W / 2, 308);

    // === Big match rate hero ===
    const heroY = 520;
    // Outer ring
    ctx.beginPath();
    ctx.arc(W / 2, heroY, 200, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 16;
    ctx.stroke();

    // Progress arc (red accent)
    ctx.beginPath();
    ctx.arc(W / 2, heroY, 200, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * matchRate) / 100);
    ctx.strokeStyle = '#E8392A';
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.lineCap = 'butt';

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 140px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${matchRate}%`, W / 2, heroY + 50);

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '600 28px system-ui, -apple-system, sans-serif';
    ctx.fillText('MATCH RATE', W / 2, heroY + 100);

    // Subline
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '500 30px system-ui, -apple-system, sans-serif';
    ctx.fillText(
      `Matched ${matches} of ${polls.length} polls`,
      W / 2,
      heroY + 200
    );

    // === Per-poll comparison list (max 5 visible) ===
    const listTop = 880;
    const rowH = 130;
    const padX = 80;
    const showCount = Math.min(polls.length, 5);

    for (let i = 0; i < showCount; i++) {
      const p = polls[i];
      const mine = myChoices[i];
      const theirs = otherChoices[i];
      const matched = mine === theirs;
      const rowY = listTop + i * rowH;

      // Row background
      ctx.fillStyle = matched ? 'rgba(232,57,42,0.08)' : 'rgba(255,255,255,0.04)';
      ctx.beginPath();
      ctx.roundRect(padX, rowY, W - padX * 2, rowH - 16, 20);
      ctx.fill();
      ctx.strokeStyle = matched ? 'rgba(232,57,42,0.35)' : 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Index pill
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath();
      ctx.roundRect(padX + 24, rowY + 24, 56, 56, 14);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 30px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}`, padX + 24 + 28, rowY + 64);

      // Question (truncated, single line)
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 26px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      const qMaxW = W - padX * 2 - 220;
      let q = p.question;
      while (ctx.measureText(q).width > qMaxW && q.length > 4) {
        q = q.slice(0, -1);
      }
      if (q.length < p.question.length) q = `${q.slice(0, -1)}…`;
      ctx.fillText(q, padX + 100, rowY + 50);

      // Choices line
      const myLabel = mine === 'A' ? p.option_a : mine === 'B' ? p.option_b : '—';
      const theirLabel = theirs === 'A' ? p.option_a : theirs === 'B' ? p.option_b : '—';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '500 22px system-ui, -apple-system, sans-serif';
      const choicesText = `${truncate(myLabel, 18)}  ·  ${truncate(theirLabel, 18)}`;
      ctx.fillText(choicesText, padX + 100, rowY + 88);

      // Match/Diff pill
      const pillW = 110;
      const pillH = 44;
      const pillX = W - padX - pillW - 24;
      const pillY = rowY + (rowH - 16 - pillH) / 2;
      ctx.fillStyle = matched ? '#E8392A' : 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, 22);
      ctx.fill();
      ctx.fillStyle = matched ? '#ffffff' : 'rgba(255,255,255,0.7)';
      ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(matched ? 'MATCH' : 'DIFF', pillX + pillW / 2, pillY + 30);
    }

    // === Footer CTA ===
    const footerY = H - 200;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '500 30px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Think you can match higher?', W / 2, footerY);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
    ctx.fillText(`Challenge a friend on ${displayHost}`, W / 2, footerY + 50);

    // Brand wordmark
    ctx.font = 'bold 56px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText('VERSA', W / 2, H - 60);

    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.93));
  }, [matchRate, matches, myChoices, myName, otherChoices, otherName, polls, displayHost]);

  const handleShare = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const blob = await generate();
      if (!blob) {
        toast.error('Could not generate share image');
        return;
      }
      const file = new File([blob], 'versa-duel.jpg', { type: 'image/jpeg' });
      const shareText = `${matchRate}% match with ${otherName} on Versa Arena ⚔️ Challenge me 👉 ${shareUrl}`;

      if (navigator.share) {
        try {
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({
              title: 'Versa Arena',
              text: shareText,
              url: shareUrl,
              files: [file],
            });
          } else {
            await navigator.share({
              title: 'Versa Arena',
              text: shareText,
              url: shareUrl,
            });
          }
          return;
        } catch (err) {
          if ((err as Error).name === 'AbortError') return;
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'versa-duel.jpg';
      a.click();
      URL.revokeObjectURL(url);
      try {
        await navigator.clipboard.writeText(shareText);
        toast.success('Image downloaded · link copied');
      } catch {
        toast.success('Image downloaded');
      }
    } catch {
      toast.error('Could not share');
    } finally {
      setBusy(false);
    }
  }, [busy, generate, matchRate, otherName, shareUrl]);

  return (
    <>
      <canvas ref={canvasRef} className="hidden" />
      <button
        onClick={handleShare}
        disabled={busy}
        className="w-full py-3.5 rounded-2xl bg-foreground text-background font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.99] transition-transform disabled:opacity-60"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Generating…
          </>
        ) : (
          <>
            <Share2 className="h-4 w-4" /> Share results
          </>
        )}
      </button>
    </>
  );
}
