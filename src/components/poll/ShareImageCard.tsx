import { useRef, useCallback } from 'react';
import { Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface ShareImageCardProps {
  pollId: string;
  question: string;
  optionA: string;
  optionB: string;
  percentA: number;
  percentB: number;
  imageAUrl?: string | null;
  imageBUrl?: string | null;
  choice: 'A' | 'B';
}

export default function ShareImageCard({
  pollId,
  question,
  optionA,
  optionB,
  percentA,
  percentB,
  imageAUrl,
  imageBUrl,
  choice,
}: ShareImageCardProps) {
  const { profile } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const shareBaseUrl = window.location.origin;
  const sharerName = profile?.username?.trim();
  const shareParams = new URLSearchParams({ c: choice });
  if (sharerName) {
    shareParams.set('by', sharerName);
  }
  const pollUrl = `${shareBaseUrl}/poll/${pollId}?${shareParams.toString()}`;
  const displayHost = (() => {
    try {
      return new URL(shareBaseUrl).host;
    } catch {
      return 'getversa.app';
    }
  })();

  const generateImage = useCallback(async (): Promise<Blob | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const W = 1080;
    const H = 1920;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0a0a0a');
    grad.addColorStop(0.5, '#111111');
    grad.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let y = 0; y < H; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Load images via fetch+blob to avoid CORS tainting the canvas
    const loadImg = async (url: string): Promise<HTMLImageElement | null> => {
      try {
        const resp = await fetch(url, { mode: 'cors' });
        if (!resp.ok) return null;
        const blob = await resp.blob();
        const objectUrl = URL.createObjectURL(blob);
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(img);
          };
          img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(null);
          };
          img.src = objectUrl;
        });
      } catch {
        // Fallback: try crossOrigin attribute
        return new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = url;
        });
      }
    };

    const [imgA, imgB] = await Promise.all([
      imageAUrl ? loadImg(imageAUrl) : null,
      imageBUrl ? loadImg(imageBUrl) : null,
    ]);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 56px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    const words = question.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const test = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(test).width > W - 160) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = test;
      }
    }
    if (currentLine) lines.push(currentLine);

    let y = 260;
    for (const line of lines) {
      ctx.fillText(line, W / 2, y);
      y += 70;
    }

    const imgY = y + 40;
    const imgW = 460;
    const imgH = 520;
    const gap = 40;

    const ax = W / 2 - imgW - gap / 2;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(ax, imgY, imgW, imgH, 24);
    ctx.clip();
    if (imgA) {
      const scale = Math.max(imgW / imgA.width, imgH / imgA.height);
      const sw = imgA.width * scale;
      const sh = imgA.height * scale;
      ctx.drawImage(imgA, ax + (imgW - sw) / 2, imgY + (imgH - sh) / 2, sw, sh);
    } else {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(ax, imgY, imgW, imgH);
    }
    ctx.restore();

    if (choice === 'A') {
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(ax, imgY, imgW, imgH, 24);
      ctx.stroke();
    }

    const bx = W / 2 + gap / 2;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(bx, imgY, imgW, imgH, 24);
    ctx.clip();
    if (imgB) {
      const scale = Math.max(imgW / imgB.width, imgH / imgB.height);
      const sw = imgB.width * scale;
      const sh = imgB.height * scale;
      ctx.drawImage(imgB, bx + (imgW - sw) / 2, imgY + (imgH - sh) / 2, sw, sh);
    } else {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(bx, imgY, imgW, imgH);
    }
    ctx.restore();

    if (choice === 'B') {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(bx, imgY, imgW, imgH, 24);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2, imgY);
    ctx.lineTo(W / 2, imgY + imgH);
    ctx.stroke();

    const labelY = imgY + imgH + 50;
    ctx.font = 'bold 44px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(optionA.length > 18 ? `${optionA.slice(0, 18)}…` : optionA, ax + imgW / 2, labelY);
    ctx.fillText(optionB.length > 18 ? `${optionB.slice(0, 18)}…` : optionB, bx + imgW / 2, labelY);

    const barY = labelY + 50;
    const barH = 60;

    ctx.font = 'bold 72px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#22c55e';
    ctx.fillText(`${percentA}%`, ax + imgW / 2, barY + barH);

    ctx.fillStyle = '#f59e0b';
    ctx.fillText(`${percentB}%`, bx + imgW / 2, barY + barH);

    const pbY = barY + barH + 30;
    const pbW = W - 160;
    const pbH = 16;
    const pbX = 80;

    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.roundRect(pbX, pbY, pbW, pbH, 8);
    ctx.fill();

    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.roundRect(pbX, pbY, pbW * (percentA / 100), pbH, 8);
    ctx.fill();

    ctx.font = '32px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.textAlign = 'center';
    ctx.fillText('What would you choose?', W / 2, pbY + 70);

    ctx.font = 'bold 30px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.fillText(`Vote on Versa → ${displayHost}`, W / 2, H - 120);

    ctx.font = 'bold 48px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('VERSA', W / 2, H - 72);

    ctx.font = '24px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.24)';
    ctx.fillText('Open the shared link to vote on this poll', W / 2, H - 34);

    try {
      return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    } catch {
      // Canvas tainted — return null so we fall back to text-only share
      return null;
    }
  }, [choice, displayHost, imageAUrl, imageBUrl, optionA, optionB, percentA, percentB, question]);

  const handleShare = useCallback(async () => {
    try {
      const blob = await generateImage();

      const shareText = `What would you choose? Vote on Versa 👉 ${pollUrl}`;

      // If image generation failed, share text-only instead of showing error
      if (!blob) {
        if (navigator.share) {
          await navigator.share({
            title: 'VERSA Poll',
            text: shareText,
            url: pollUrl,
          });
        } else {
          await navigator.clipboard.writeText(`${shareText}\n${pollUrl}`);
          toast.success('Link copied to clipboard!');
        }
        return;
      }

      const file = new File([blob], 'versa-poll.jpg', { type: 'image/jpeg' });

      if (navigator.share) {
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            title: 'VERSA Poll',
            text: shareText,
            url: pollUrl,
            files: [file],
          });
        } else {
          await navigator.share({
            title: 'VERSA Poll',
            text: shareText,
            url: pollUrl,
          });
        }
        return;
      }

      // Desktop fallback: download image + copy link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'versa-poll.jpg';
      a.click();
      URL.revokeObjectURL(url);

      try {
        await navigator.clipboard.writeText(shareText);
        toast.success('Image downloaded and link copied');
      } catch {
        toast.success('Image downloaded. Share it with the Versa link.');
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        // Final fallback: just copy the link
        try {
          await navigator.clipboard.writeText(pollUrl);
          toast.success('Link copied to clipboard!');
        } catch {
          toast.error('Could not share. Try copying the link manually.');
        }
      }
    }
  }, [generateImage, pollUrl]);

  return (
    <>
      <canvas ref={canvasRef} className="hidden" />
      <Button
        onClick={handleShare}
        className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-display font-bold text-base gap-2 shadow-glow"
      >
        <Share2 className="h-5 w-5" />
        Share Result
      </Button>
    </>
  );
}
