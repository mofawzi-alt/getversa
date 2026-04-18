import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import { X, Download, Share2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { BreakdownFinding } from '@/hooks/useBreakdownFindings';

type Format = 'story' | 'square';

type Props = {
  open: boolean;
  finding: BreakdownFinding | null;
  onClose: () => void;
};

/**
 * Premium html2canvas share card for The Breakdown findings.
 * Renders a hidden 1080x1920 (Stories) or 1080x1080 (Square) DOM node,
 * snapshots it to PNG, and offers native share / download.
 */
export default function BreakdownShareCard({ open, finding, onClose }: Props) {
  const [format, setFormat] = useState<Format>('story');
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const renderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setPreviewUrl(null);
      setFormat('story');
    }
  }, [open]);

  // Auto-generate preview when format changes
  useEffect(() => {
    if (!open || !finding) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const url = await renderToDataUrl();
      if (!cancelled) setPreviewUrl(url);
    }, 100);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, finding, format]);

  async function renderToDataUrl(): Promise<string | null> {
    if (!renderRef.current) return null;
    try {
      const canvas = await html2canvas(renderRef.current, {
        backgroundColor: '#0a0a0a',
        scale: 1,
        useCORS: true,
        allowTaint: true,
        logging: false,
        width: format === 'story' ? 1080 : 1080,
        height: format === 'story' ? 1920 : 1080,
      });
      return canvas.toDataURL('image/png', 0.95);
    } catch (e) {
      console.error('Breakdown share render failed', e);
      return null;
    }
  }

  async function handleShare() {
    if (!finding) return;
    setBusy(true);
    try {
      const url = await renderToDataUrl();
      if (!url) throw new Error('render failed');
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], `versa-breakdown-${format}.png`, { type: 'image/png' });
      const nav = navigator as any;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({
          files: [file],
          title: 'Versa — The Breakdown',
          text: finding.headline,
        });
      } else {
        triggerDownload(url);
        toast.success('Image downloaded — share it on your stories');
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') toast.error('Could not share');
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload() {
    setBusy(true);
    try {
      const url = await renderToDataUrl();
      if (!url) throw new Error('render failed');
      triggerDownload(url);
      toast.success('Saved to your device');
    } catch {
      toast.error('Could not download');
    } finally {
      setBusy(false);
    }
  }

  function triggerDownload(url: string) {
    const a = document.createElement('a');
    a.href = url;
    a.download = `versa-breakdown-${format}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  if (!open || !finding) return null;

  const content = (
    <div className="fixed inset-0 z-[400] bg-black/95 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3 text-white">
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        <p className="text-sm font-semibold tracking-wide uppercase">Share</p>
        <div className="w-10" />
      </div>

      {/* Format toggle */}
      <div className="px-4 pb-3 flex justify-center">
        <div className="inline-flex rounded-full bg-white/10 p-1 backdrop-blur">
          <button
            type="button"
            onClick={() => setFormat('story')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
              format === 'story' ? 'bg-white text-black' : 'text-white/80'
            }`}
          >
            Story · 9:16
          </button>
          <button
            type="button"
            onClick={() => setFormat('square')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
              format === 'square' ? 'bg-white text-black' : 'text-white/80'
            }`}
          >
            Square · 1:1
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="flex-1 overflow-y-auto flex items-center justify-center p-4">
        <div
          className="rounded-2xl overflow-hidden shadow-2xl bg-[#0a0a0a]"
          style={{
            aspectRatio: format === 'story' ? '9 / 16' : '1 / 1',
            width: format === 'story' ? 'min(90vw, 360px)' : 'min(90vw, 480px)',
          }}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="Share preview" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/50">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 flex gap-3">
        <button
          type="button"
          onClick={handleDownload}
          disabled={busy}
          className="flex-1 h-12 rounded-full bg-white/10 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Download className="w-4 h-4" /> Save
        </button>
        <button
          type="button"
          onClick={handleShare}
          disabled={busy}
          className="flex-[2] h-12 rounded-full bg-white text-black font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
          Share to Stories
        </button>
      </div>

      {/* Hidden render target — full 1080px canvas */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: '-99999px',
          width: 1080,
          height: format === 'story' ? 1920 : 1080,
          pointerEvents: 'none',
        }}
        aria-hidden
      >
        <div ref={renderRef} style={{ width: 1080, height: format === 'story' ? 1920 : 1080 }}>
          <ShareCardArt finding={finding} format={format} />
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}

/* ─────────────────────────────────────────────────────────── */
/* The actual visual card — rendered at 1080px, premium look   */
/* ─────────────────────────────────────────────────────────── */

function ShareCardArt({ finding, format }: { finding: BreakdownFinding; format: Format }) {
  const d = finding.detail || {};
  const isStory = format === 'story';
  const H = isStory ? 1920 : 1080;

  // Resolve two segments to compare
  const { leftLabel, leftPct, rightLabel, rightPct, optionWord } = resolveSegments(finding);

  return (
    <div
      style={{
        width: 1080,
        height: H,
        background: '#0a0a0a',
        color: '#fff',
        position: 'relative',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Subtle ambient gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at top right, rgba(99,102,241,0.18), transparent 55%), radial-gradient(ellipse at bottom left, rgba(232,57,42,0.10), transparent 60%)',
        }}
      />
      {/* Faint grid texture */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />

      {/* TOP: logo + label */}
      <div
        style={{
          position: 'absolute',
          top: isStory ? 80 : 60,
          left: 80,
          right: 80,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              fontSize: 36,
              fontWeight: 900,
              letterSpacing: '-0.02em',
              color: '#fff',
            }}
          >
            Versa
          </div>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: '#E8392A',
              boxShadow: '0 0 16px rgba(232,57,42,0.7)',
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 18px',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 999,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.85)',
          }}
        >
          <span style={{ color: '#a78bfa' }}>📊</span> The Breakdown
        </div>
      </div>

      {/* CENTER: headline + bars */}
      <div
        style={{
          position: 'absolute',
          left: 80,
          right: 80,
          top: isStory ? 360 : 220,
          bottom: isStory ? 320 : 220,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: isStory ? 80 : 40,
        }}
      >
        <h1
          style={{
            fontSize: isStory ? 96 : 76,
            lineHeight: 1.04,
            fontWeight: 900,
            letterSpacing: '-0.035em',
            margin: 0,
            textWrap: 'balance' as any,
          }}
        >
          {finding.headline}
        </h1>

        {/* Bars */}
        {leftLabel && rightLabel && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: isStory ? 36 : 24 }}>
            <Bar label={leftLabel} pct={leftPct} accent="#E8392A" />
            <Bar label={rightLabel} pct={rightPct} accent="#3b82f6" />
            {optionWord && (
              <div
                style={{
                  fontSize: 26,
                  color: 'rgba(255,255,255,0.55)',
                  marginTop: 8,
                  fontWeight: 500,
                }}
              >
                Voting on “{optionWord}”
              </div>
            )}
          </div>
        )}
      </div>

      {/* BOTTOM: source + url */}
      <div
        style={{
          position: 'absolute',
          left: 80,
          right: 80,
          bottom: isStory ? 100 : 70,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
        }}
      >
        <div
          style={{
            width: '100%',
            height: 1,
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)',
          }}
        />
        <div
          style={{
            fontSize: 24,
            color: 'rgba(255,255,255,0.65)',
            fontWeight: 500,
            letterSpacing: '0.01em',
            textAlign: 'center',
          }}
        >
          Based on {finding.total_votes.toLocaleString()} votes · Verified by Versa
        </div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: '#60a5fa',
            letterSpacing: '0.02em',
          }}
        >
          getversa.app
        </div>
      </div>
    </div>
  );
}

function Bar({ label, pct, accent }: { label: string; pct: number; accent: string }) {
  const safePct = Math.max(2, Math.min(100, Math.round(pct || 0)));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          fontSize: 32,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.92)',
        }}
      >
        <span style={{ letterSpacing: '-0.01em' }}>{label}</span>
        <span style={{ fontSize: 44, fontWeight: 900, color: accent, letterSpacing: '-0.02em' }}>
          {safePct}%
        </span>
      </div>
      <div
        style={{
          height: 28,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${safePct}%`,
            background: `linear-gradient(90deg, ${accent}, ${accent}cc)`,
            borderRadius: 999,
            boxShadow: `0 0 24px ${accent}55`,
          }}
        />
      </div>
    </div>
  );
}

function resolveSegments(f: BreakdownFinding): {
  leftLabel: string;
  leftPct: number;
  rightLabel: string;
  rightPct: number;
  optionWord: string;
} {
  const d = f.detail || {};
  const poll = d.poll || {};
  const optionWord = poll.option_a || '';
  if (f.finding_type === 'gender_split' && d.female && d.male) {
    return {
      leftLabel: 'Women',
      leftPct: d.female.pct_a,
      rightLabel: 'Men',
      rightPct: d.male.pct_a,
      optionWord,
    };
  }
  if (f.finding_type === 'age_gap' && d.young && d.old) {
    return {
      leftLabel: '18–24',
      leftPct: d.young.pct_a,
      rightLabel: '35+',
      rightPct: d.old.pct_a,
      optionWord,
    };
  }
  if (f.finding_type === 'city_war' && d.cairo && d.alexandria) {
    return {
      leftLabel: 'Cairo',
      leftPct: d.cairo.pct_a,
      rightLabel: 'Alexandria',
      rightPct: d.alexandria.pct_a,
      optionWord,
    };
  }
  if (f.finding_type === 'dominant_demo' && d.segment && d.overall) {
    return {
      leftLabel: d.demo_label || 'Segment',
      leftPct: d.segment.pct_a,
      rightLabel: 'Everyone else',
      rightPct: d.overall.pct_a,
      optionWord,
    };
  }
  return { leftLabel: '', leftPct: 0, rightLabel: '', rightPct: 0, optionWord };
}
