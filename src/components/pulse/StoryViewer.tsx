import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share2, ChevronRight, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { trackStoryEvent } from '@/lib/storyAnalytics';
import { markSeenLocally } from '@/lib/pulseTime';
import { toast } from 'sonner';

const isVideoUrl = (url?: string | null) =>
  !!url && /\.(mp4|webm|mov|ogg)(\?|$)/i.test(url);

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
  /** Optional category to theme the gradient backdrop. */
  category?: string | null;
  startIndex?: number;
  /** Auto-advance duration per card in ms. Set 0 to disable. */
  autoAdvanceMs?: number;
  /** Override the share button — receives current card index, returns true if handled. */
  onShareOverride?: (cardIndex: number) => boolean | Promise<boolean>;
  /** Called when the last card finishes. Return true to suppress auto-close (e.g. flipping to next story). */
  onComplete?: () => boolean | void;
  /** Called when user taps back on the first card. Return true to suppress no-op (e.g. flipping to previous story). */
  onPrevious?: () => boolean | void;
};

const DEFAULT_DURATION = 4000;

// Per-topic / per-category gradient themes so each story feels visually distinct.
// Uses raw HSL pairs (rich, saturated) to give each story its own mood.
const TOPIC_THEMES: Record<string, { from: string; via: string; to: string; accent: string }> = {
  morning_pulse:    { from: '#ff8a3d', via: '#ff4d6d', to: '#1a0b2e', accent: '#ffb86b' }, // sunrise
  evening_verdict:  { from: '#4338ca', via: '#7e22ce', to: '#0b0420', accent: '#a78bfa' }, // dusk
  egypt_today:      { from: '#dc2626', via: '#0f172a', to: '#000000', accent: '#fbbf24' }, // news
  brands:           { from: '#f97316', via: '#7c2d12', to: '#0a0a0a', accent: '#fb923c' },
  entertainment:    { from: '#ec4899', via: '#7c3aed', to: '#1e1b4b', accent: '#f0abfc' },
  sports:           { from: '#16a34a', via: '#065f46', to: '#022c22', accent: '#4ade80' },
  food:             { from: '#f59e0b', via: '#dc2626', to: '#451a03', accent: '#fcd34d' },
  'food & drinks':  { from: '#f59e0b', via: '#dc2626', to: '#451a03', accent: '#fcd34d' },
  beauty:           { from: '#f472b6', via: '#be185d', to: '#3b0764', accent: '#fbcfe8' },
  style:            { from: '#a855f7', via: '#581c87', to: '#0c0a1f', accent: '#d8b4fe' },
  'style & design': { from: '#a855f7', via: '#581c87', to: '#0c0a1f', accent: '#d8b4fe' },
  fintech:          { from: '#facc15', via: '#854d0e', to: '#0a0a0a', accent: '#fde047' },
  'fintech & money':{ from: '#facc15', via: '#854d0e', to: '#0a0a0a', accent: '#fde047' },
  wellness:         { from: '#fb7185', via: '#9f1239', to: '#1e0a14', accent: '#fda4af' },
  'wellness & habits':{ from: '#fb7185', via: '#9f1239', to: '#1e0a14', accent: '#fda4af' },
  telecom:          { from: '#0ea5e9', via: '#1e3a8a', to: '#020617', accent: '#7dd3fc' },
  relationships:    { from: '#f43f5e', via: '#9f1239', to: '#1c0410', accent: '#fda4af' },
  personality:      { from: '#6366f1', via: '#3730a3', to: '#020617', accent: '#a5b4fc' },
  lifestyle:        { from: '#a78bfa', via: '#6d28d9', to: '#1e1b4b', accent: '#c4b5fd' },
  'business & startups': { from: '#3b82f6', via: '#1e40af', to: '#0a0a23', accent: '#93c5fd' },
};

const FALLBACK_THEMES = [
  { from: '#0ea5e9', via: '#7c3aed', to: '#020617', accent: '#a78bfa' },
  { from: '#f59e0b', via: '#b91c1c', to: '#0a0a0a', accent: '#fbbf24' },
  { from: '#10b981', via: '#065f46', to: '#022c22', accent: '#6ee7b7' },
  { from: '#ec4899', via: '#7c3aed', to: '#1e1b4b', accent: '#f0abfc' },
  { from: '#22d3ee', via: '#0e7490', to: '#022c22', accent: '#67e8f9' },
];

function pickTheme(topic: string, category?: string | null) {
  // Direct topic key
  const topicKey = topic.toLowerCase();
  if (TOPIC_THEMES[topicKey]) return TOPIC_THEMES[topicKey];

  // category:<name> prefix on topic
  const catFromTopic = topicKey.startsWith('category:') ? topicKey.slice(9) : null;
  const lookup = (category || catFromTopic || '').toLowerCase().trim();
  if (lookup && TOPIC_THEMES[lookup]) return TOPIC_THEMES[lookup];

  // Stable hash → fallback palette
  let h = 0;
  for (let i = 0; i < topicKey.length; i++) h = (h * 31 + topicKey.charCodeAt(i)) >>> 0;
  return FALLBACK_THEMES[h % FALLBACK_THEMES.length];
}

export default function StoryViewer({
  open,
  onClose,
  topic,
  cards,
  category,
  startIndex = 0,
  autoAdvanceMs = DEFAULT_DURATION,
  onShareOverride,
  onComplete,
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
      const handled = onComplete?.();
      if (handled === true) return;
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
    // IG-style: split the entire viewport in half — left = back, right = forward
    const w = window.innerWidth;
    const x = e.clientX;
    if (x < w / 2) prev();
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
  const theme = pickTheme(topic, category);

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
        onClick={handleTap}
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

          {/* Tap-zone affordances (visual only — actual tap handled by backdrop) */}
          {safeIndex > 0 && (
            <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/15 backdrop-blur flex items-center justify-center text-white/80 pointer-events-none">
              <ChevronLeft className="w-5 h-5" />
            </div>
          )}
          {safeIndex < cards.length - 1 && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/15 backdrop-blur flex items-center justify-center text-white/80 pointer-events-none">
              <ChevronRight className="w-5 h-5" />
            </div>
          )}

          <motion.div
            key={index}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 pointer-events-none"
          >
            {/* Solid black base — image carries the visual identity */}
            <div className="absolute inset-0 bg-black" />
            {card.backgroundImage && (card.backgroundImage.startsWith('/') || /^https?:\/\//i.test(card.backgroundImage)) ? (
              isVideoUrl(card.backgroundImage) ? (
                <video
                  src={card.backgroundImage}
                  className="absolute inset-0 w-full h-full object-cover"
                  autoPlay
                  loop
                  muted
                  playsInline
                  onError={(e) => { (e.currentTarget as HTMLVideoElement).style.display = 'none'; }}
                />
              ) : (
              <img
                src={card.backgroundImage}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
              )
            ) : (
              /* Themed gradient fallback only when no image */
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(135deg, ${theme.from} 0%, ${theme.via} 55%, ${theme.to} 100%)`,
                }}
              />
            )}
            {/* Bottom darken for legibility */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/90" />

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

            {card.cta ? (
              <div className="absolute bottom-6 left-0 right-0 px-5 pointer-events-auto">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    card.cta!.onClick();
                  }}
                  className="w-full h-12 rounded-full bg-white text-black font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  {card.cta.label}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ) : card.votePollId ? (
              <div className="absolute bottom-6 left-0 right-0 px-5 pointer-events-auto">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleVote(card);
                  }}
                  className="w-full h-12 rounded-full bg-white text-black font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  Open poll
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ) : null}
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
