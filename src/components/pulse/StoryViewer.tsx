import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share2, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { trackStoryEvent } from '@/lib/storyAnalytics';
import { markSeenLocally } from '@/lib/pulseTime';
import { toast } from 'sonner';

export type StoryCardData = {
  /** Background image (winning option image, or fallback). */
  backgroundImage?: string | null;
  /** Small label at top — e.g. 'While you were sleeping…' */
  label?: string;
  /** Optional category tag */
  categoryEmoji?: string;
  /** Headline (poll question). */
  headline: string;
  /** Big result text — e.g. 'Pizza wins 73%' */
  primaryText?: string;
  /** Secondary line — e.g. '12,430 votes' */
  secondaryText?: string;
  /** Optional split bar percentages */
  splitA?: { label: string; pct: number };
  splitB?: { label: string; pct: number };
  /** Optional Vote button target (poll id) */
  votePollId?: string;
  /** Optional CTA override (Morning Pulse final card) */
  cta?: { label: string; onClick: () => void };
  /** Whether share button shows */
  shareable?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  topic: string; // e.g. 'morning_pulse', 'egypt_today', 'category:brands'
  cards: StoryCardData[];
  startIndex?: number;
  /** Auto-advance duration per card in ms. Set 0 to disable. */
  autoAdvanceMs?: number;
  /** Override the share button — receives current card index, returns true if handled. */
  onShareOverride?: (cardIndex: number) => boolean | Promise<boolean>;
};

const DEFAULT_DURATION = 4000;

export default function StoryViewer({
  open,
  onClose,
  topic,
  cards,
  startIndex = 0,
  autoAdvanceMs = DEFAULT_DURATION,
  onShareOverride,
}: Props) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const startedAt = useRef<number>(Date.now());
  const rafRef = useRef<number>();

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setIndex(Math.max(0, Math.min(startIndex, cards.length - 1)));
    setProgress(0);
    startedAt.current = Date.now();
    trackStoryEvent(topic, 'cards_viewed');
  }, [open, startIndex, topic, cards.length]);

  // Clamp index if cards array changes while viewer is open
  useEffect(() => {
    if (!open || cards.length === 0) return;
    setIndex((current) => Math.max(0, Math.min(current, cards.length - 1)));
  }, [open, cards.length]);

  // Track each new card view
  useEffect(() => {
    if (!open) return;
    if (index === 0) return; // first card already tracked on open
    trackStoryEvent(topic, 'cards_viewed');
  }, [index, open, topic]);

  // Auto-advance progress
  useEffect(() => {
    if (!open || paused || autoAdvanceMs <= 0 || cards.length === 0) return;
    let frame = 0;
    const tick = () => {
      const elapsed = Date.now() - startedAt.current;
      const pct = Math.min(1, elapsed / autoAdvanceMs);
      setProgress(pct);
      if (pct >= 1) {
        next();
      } else {
        frame = requestAnimationFrame(tick);
        rafRef.current = frame;
      }
    };
    frame = requestAnimationFrame(tick);
    rafRef.current = frame;
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, open, paused, autoAdvanceMs, cards.length]);

  function next() {
    if (index >= cards.length - 1) {
      markSeenLocally(topic);
      trackStoryEvent(topic, null, { completed: true });
      onClose();
      return;
    }
    setIndex((i) => Math.min(i + 1, cards.length - 1));
    setProgress(0);
    startedAt.current = Date.now();
  }

  function prev() {
    if (index === 0) return;
    setIndex((i) => Math.max(i - 1, 0));
    setProgress(0);
    startedAt.current = Date.now();
  }

  function handleTap(e: React.MouseEvent) {
    const w = e.currentTarget.clientWidth;
    const x = e.nativeEvent.offsetX;
    if (x < w / 3) prev();
    else next();
  }

  async function handleShare(card: StoryCardData) {
    trackStoryEvent(topic, 'share_taps');
    if (onShareOverride) {
      try {
        const idx = Math.max(0, Math.min(index, cards.length - 1));
        const handled = await onShareOverride(idx);
        if (handled) return;
      } catch { /* fall through */ }
    }
    const shareData = {
      title: 'Versa',
      text: card.headline + (card.primaryText ? ` — ${card.primaryText}` : ''),
      url: card.votePollId ? `${window.location.origin}/poll/${card.votePollId}` : window.location.origin,
    };
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try { await (navigator as any).share(shareData); return; } catch { /* user cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Could not share');
    }
  }

  function handleVote(card: StoryCardData) {
    if (!card.votePollId) return;
    trackStoryEvent(topic, 'vote_taps');
    markSeenLocally(topic);
    onClose();
    navigate(`/poll/${card.votePollId}`);
  }

  if (!open || cards.length === 0) return null;
  const safeIndex = Math.max(0, Math.min(index, cards.length - 1));
  const card = cards[safeIndex];
  if (!card) return null;

  const content = (
    <AnimatePresence>
      <motion.div
        key="story-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] bg-black/95 flex items-center justify-center p-2 sm:p-4"
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => { setPaused(false); startedAt.current = Date.now() - progress * autoAdvanceMs; }}
        onPointerCancel={() => setPaused(false)}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.4}
        onDragEnd={(_, info) => { if (info.offset.y > 100) { onClose(); } }}
      >
        <div
          className="relative w-auto rounded-2xl sm:rounded-3xl overflow-hidden bg-black shadow-2xl"
          style={{
            height: 'min(calc(100dvh - 32px), calc((100vw - 16px) * 16 / 9))',
            aspectRatio: '9 / 16',
            maxWidth: 'calc(100vw - 16px)',
          }}
        >
          <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-2 pt-3">
            {cards.map((_, i) => (
              <div key={i} className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-[width]"
                  style={{
                    width: i < index ? '100%' : i === index ? `${progress * 100}%` : '0%',
                  }}
                />
              </div>
            ))}
          </div>

          <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
            {card.shareable !== false && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleShare(card); }}
                className="w-9 h-9 rounded-full bg-white/15 backdrop-blur flex items-center justify-center text-white"
                aria-label="Share"
              >
                <Share2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="w-9 h-9 rounded-full bg-white/15 backdrop-blur flex items-center justify-center text-white"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="absolute inset-0" onClick={handleTap} />

          <motion.div
            key={index}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 pointer-events-none"
          >
            {card.backgroundImage ? (
              <img
                src={card.backgroundImage}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary/40 to-black" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/85" />

            {card.label && (
              <div className="absolute top-12 left-0 right-0 text-center px-5 pointer-events-none">
                <p className="text-white/90 text-sm font-medium tracking-wide uppercase">
                  {card.categoryEmoji ? `${card.categoryEmoji} ` : ''}{card.label}
                </p>
              </div>
            )}

            <div className="absolute inset-x-0 bottom-24 px-5 text-white text-center">
              <h2 className="text-[clamp(1.6rem,4vw,2.25rem)] font-bold leading-tight mb-3 drop-shadow-lg text-balance">
                {card.headline}
              </h2>
              {card.primaryText && (
                <p className="text-[clamp(2rem,6vw,3.25rem)] font-extrabold tracking-tight mb-2 drop-shadow-lg text-balance">
                  {card.primaryText}
                </p>
              )}
              {card.secondaryText && (
                <p className="text-sm text-white/80 text-balance">{card.secondaryText}</p>
              )}

              {(card.splitA && card.splitB) && (
                <div className="mt-4 space-y-2 pointer-events-none">
                  <SplitBar label={card.splitA.label} pct={card.splitA.pct} highlight={card.splitA.pct >= card.splitB.pct} />
                  <SplitBar label={card.splitB.label} pct={card.splitB.pct} highlight={card.splitB.pct > card.splitA.pct} />
                </div>
              )}
            </div>

            {(card.cta || card.votePollId) && (
              <div className="absolute bottom-6 left-0 right-0 px-5 pointer-events-auto">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (card.cta) { card.cta.onClick(); return; }
                    handleVote(card);
                  }}
                  className="w-full h-12 rounded-full bg-white text-black font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  {card.cta?.label || 'Vote Now'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}

function SplitBar({ label, pct, highlight }: { label: string; pct: number; highlight: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-7 rounded-full bg-white/20 overflow-hidden relative">
        <div
          className={`h-full transition-all duration-700 ${highlight ? 'bg-emerald-400' : 'bg-white/50'}`}
          style={{ width: `${Math.max(pct, 4)}%` }}
        />
        <div className="absolute inset-0 flex items-center px-3 text-sm font-semibold">
          <span className="truncate">{label}</span>
        </div>
      </div>
      <span className="text-sm font-semibold w-10 text-right">{pct}%</span>
    </div>
  );
}
