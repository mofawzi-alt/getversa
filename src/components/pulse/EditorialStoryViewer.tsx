import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { EDITORIAL_STORY_META } from '@/lib/editorialStoryTypes';
import type { EditorialStory } from '@/hooks/useEditorialStories';
import { trackEditorialEvent } from '@/hooks/useEditorialStories';
import { markSeenLocally } from '@/lib/pulseTime';

const DURATION = 4000; // user chose: keep 4s auto-advance everywhere

type Props = {
  open: boolean;
  story: EditorialStory | null;
  onClose: () => void;
  onComplete?: () => boolean | void;
  onPrevious?: () => boolean | void;
};

export default function EditorialStoryViewer({ open, story, onClose, onComplete, onPrevious }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const startedAt = useRef(Date.now());
  const rafRef = useRef<number>();

  const meta = story ? EDITORIAL_STORY_META[story.story_type] : null;
  const cards = story?.cards || {};

  // Resume position
  const storageKey = story ? `editorial:pos:${story.id}` : '';

  useEffect(() => {
    if (!open || !story) return;
    let resume = 0;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) resume = Math.min(4, Math.max(0, parseInt(raw, 10) || 0));
    } catch { /* ignore */ }
    setIndex(resume);
    setProgress(0);
    startedAt.current = Date.now();
    trackEditorialEvent(story.id, 'view');
  }, [open, story?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !story) return;
    try { localStorage.setItem(storageKey, String(index)); } catch { /* ignore */ }
  }, [index, open, story?.id, storageKey]);

  // Resolve CTA poll
  const ctaPollId = story?.cta_poll_id || story?.poll_id || null;
  const { data: ctaPoll } = useQuery({
    queryKey: ['editorial-cta-poll', ctaPollId],
    enabled: !!ctaPollId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, image_a_url, image_b_url')
        .eq('id', ctaPollId!)
        .maybeSingle();
      return data;
    },
  });

  // Has user voted on the CTA poll?
  const { data: userVote } = useQuery({
    queryKey: ['editorial-cta-vote', ctaPollId, user?.id],
    enabled: !!ctaPollId && !!user && open,
    queryFn: async () => {
      const { data } = await supabase
        .from('votes')
        .select('id, choice')
        .eq('poll_id', ctaPollId!)
        .eq('user_id', user!.id)
        .maybeSingle();
      return data;
    },
  });

  // Auto-advance
  useEffect(() => {
    if (!open || paused || !story) return;
    const tick = () => {
      const elapsed = Date.now() - startedAt.current;
      const pct = Math.min(1, elapsed / DURATION);
      setProgress(pct);
      if (pct >= 1) {
        next();
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, open, paused, story?.id]);

  function next() {
    if (!story) return;
    if (index >= 4) {
      trackEditorialEvent(story.id, 'complete');
      try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
      markSeenLocally(`editorial:${story.story_type}`);
      const handled = onComplete?.();
      if (handled !== true) onClose();
      return;
    }
    trackEditorialEvent(story.id, 'dropoff', index + 1);
    setIndex((i) => Math.min(i + 1, 4));
    setProgress(0);
    startedAt.current = Date.now();
  }

  function prev() {
    if (index === 0) {
      const handled = onPrevious?.();
      if (handled === true) return;
      return;
    }
    setIndex((i) => Math.max(i - 1, 0));
    setProgress(0);
    startedAt.current = Date.now();
  }

  function handleTap(e: React.MouseEvent) {
    const w = window.innerWidth;
    if (e.clientX < w / 2) prev();
    else next();
  }

  function handleVote() {
    if (!story || !ctaPollId) return;
    trackEditorialEvent(story.id, 'vote_tap');
    onClose();
    navigate(`/poll/${ctaPollId}`);
  }

  if (!open || !story || !meta) return null;

  const safeIndex = Math.max(0, Math.min(index, 4));

  const content = (
    <AnimatePresence>
      <motion.div
        key="editorial-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] bg-black/95 flex items-center justify-center p-2 sm:p-4"
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => { setPaused(false); startedAt.current = Date.now() - progress * DURATION; }}
        onPointerCancel={() => setPaused(false)}
        onClick={handleTap}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.4}
        onDragEnd={(_, info) => { if (info.offset.y > 100) onClose(); }}
      >
        <div
          className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-[#0a0a0a] shadow-2xl"
          style={{
            height: 'min(calc(100dvh - 32px), calc((100vw - 16px) * 16 / 9))',
            aspectRatio: '9 / 16',
            maxWidth: 'calc(100vw - 16px)',
          }}
        >
          {/* Progress dots */}
          <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-2 pt-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-[width]"
                  style={{ width: i < safeIndex ? '100%' : i === safeIndex ? `${progress * 100}%` : '0%' }}
                />
              </div>
            ))}
          </div>

          {/* Close */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-white/15 backdrop-blur flex items-center justify-center text-white"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Tap-zone affordances (visual only — tap handled by backdrop) */}
          {(safeIndex > 0 || !!onPrevious) && (
            <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/15 backdrop-blur flex items-center justify-center text-white/80 pointer-events-none">
              <ChevronLeft className="w-5 h-5" />
            </div>
          )}
          {(safeIndex < 4 || !!onComplete) && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/15 backdrop-blur flex items-center justify-center text-white/80 pointer-events-none">
              <ChevronRight className="w-5 h-5" />
            </div>
          )}

          {/* Card content */}
          <motion.div
            key={safeIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 pointer-events-none"
          >
            {safeIndex === 0 && <HookCard meta={meta} hook={cards.hook} />}
            {safeIndex === 1 && <DataCard data={cards.data} />}
            {safeIndex === 2 && <InsightCard insight={cards.insight} totalVotes={story.total_real_votes} />}
            {safeIndex === 3 && <ConnectionCard connection={cards.connection} />}
            {safeIndex === 4 && (
              <ActionCard
                ctaLabel={cards.action?.ctaLabel || 'Vote now'}
                poll={ctaPoll || null}
                userVote={userVote || null}
                onVote={handleVote}
              />
            )}
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}

// ─── Card 1: Hook ───
function HookCard({
  meta,
  hook,
}: {
  meta: typeof EDITORIAL_STORY_META[keyof typeof EDITORIAL_STORY_META];
  hook?: EditorialStory['cards']['hook'];
}) {
  return (
    <div className="absolute inset-0 bg-[#0a0a0a] flex flex-col p-6 pt-14">
      <div
        className="self-start text-xs font-semibold px-2.5 py-1 rounded-full"
        style={{ backgroundColor: meta.bgTint, color: meta.color }}
      >
        {meta.emoji} {meta.label}
      </div>
      <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
        <h2 className="text-white font-bold text-[24px] leading-tight mb-8 text-balance">
          {hook?.headline || 'Story headline'}
        </h2>
        <div className="text-[64px] font-extrabold tracking-tight leading-none mb-3" style={{ color: meta.color }}>
          {hook?.bigStat || '—'}
        </div>
        {hook?.subtext && <p className="text-sm text-gray-400 text-balance">{hook.subtext}</p>}
      </div>
      <div className="flex items-center justify-center gap-1.5 text-white/50 text-xs pb-2">
        swipe for the data <ArrowRight className="w-3 h-3" />
      </div>
    </div>
  );
}

// ─── Card 2: Data ───
function DataCard({ data }: { data?: EditorialStory['cards']['data'] }) {
  if (!data) return <div className="absolute inset-0 bg-[#0a0a0a] flex items-center justify-center text-white/60 text-sm">No data</div>;
  const aWins = data.pct_a >= data.pct_b;
  return (
    <div className="absolute inset-0 bg-[#0a0a0a] flex flex-col p-6 pt-14">
      <h3 className="text-white font-bold text-[18px] leading-snug mb-6 text-balance">{data.question}</h3>
      <div className="space-y-4">
        <Bar label={data.option_a} pct={data.pct_a} blue highlight={aWins} />
        <Bar label={data.option_b} pct={data.pct_b} blue={false} highlight={!aWins} />
      </div>
      {data.demographic_split && (
        <div className="mt-6 pt-6 border-t border-white/10">
          <p className="text-white/60 text-xs uppercase tracking-wide mb-3">{data.demographic_split.label}</p>
          <div className="space-y-2">
            <MiniSplit label={data.demographic_split.a_value} pct={data.demographic_split.a_pct} />
            <MiniSplit label={data.demographic_split.b_value} pct={data.demographic_split.b_pct} />
          </div>
        </div>
      )}
      <div className="mt-auto text-center text-gray-500 text-xs pt-4">
        {data.total_votes.toLocaleString()} total votes
      </div>
    </div>
  );
}
function Bar({ label, pct, blue, highlight }: { label: string; pct: number; blue: boolean; highlight: boolean }) {
  const fillColor = blue ? '#2563EB' : 'rgba(255,255,255,0.95)';
  const textColor = blue ? '#fff' : '#0a0a0a';
  return (
    <div>
      <div className="flex justify-between items-end mb-1.5">
        <span className={`text-sm font-semibold ${highlight ? 'text-white' : 'text-white/70'} truncate pr-2`}>{label}</span>
      </div>
      <div className="relative h-10 rounded-lg bg-white/10 overflow-hidden">
        <div
          className="h-full transition-all duration-700 flex items-center justify-end px-3"
          style={{ width: `${Math.max(pct, 8)}%`, backgroundColor: fillColor }}
        >
          <span className="text-sm font-bold" style={{ color: textColor }}>{pct}%</span>
        </div>
      </div>
    </div>
  );
}
function MiniSplit({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-white/80 text-xs w-20 truncate">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full bg-white/70 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-white text-xs font-semibold w-10 text-right">{pct}%</span>
    </div>
  );
}

// ─── Card 3: Insight ───
function InsightCard({
  insight,
  totalVotes,
}: {
  insight?: EditorialStory['cards']['insight'];
  totalVotes: number;
}) {
  return (
    <div className="absolute inset-0 bg-[#111111] flex flex-col p-6 pt-14">
      <div className="text-center text-3xl mb-4">{insight?.emoji || '✨'}</div>
      <p
        className="text-white text-[16px] font-medium text-balance flex-1 flex items-center"
        style={{ lineHeight: '26px' }}
      >
        {insight?.text || 'No insight provided.'}
      </p>
      <p className="text-center text-gray-500 italic text-xs">
        Based on {(insight?.basedOnVotes ?? totalVotes).toLocaleString()} real Versa votes
      </p>
    </div>
  );
}

// ─── Card 4: Connection ───
function ConnectionCard({ connection }: { connection?: EditorialStory['cards']['connection'] }) {
  return (
    <div className="absolute inset-0 bg-[#0a0a0a] flex flex-col p-6 pt-14">
      <h3 className="text-white/70 text-xs uppercase tracking-wider mb-4">The connection</h3>
      <p className="text-white text-[17px] font-medium leading-relaxed text-balance flex-1">
        {connection?.text || 'No connection provided.'}
      </p>
      {connection?.trend && (
        <div className="my-6">
          <TrendChart from={connection.trend.from_pct} to={connection.trend.to_pct} label={connection.trend.label} />
        </div>
      )}
      {connection?.sourceName && (
        <div className="mt-auto">
          {connection.sourceUrl ? (
            <a
              href={connection.sourceUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center text-xs text-white/60 bg-white/10 px-2.5 py-1 rounded-full pointer-events-auto"
            >
              📰 {connection.sourceName}
            </a>
          ) : (
            <span className="inline-flex items-center text-xs text-white/60 bg-white/10 px-2.5 py-1 rounded-full">
              📰 {connection.sourceName}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
function TrendChart({ from, to, label }: { from: number; to: number; label?: string }) {
  const up = to >= from;
  return (
    <div className="bg-white/5 rounded-xl p-4">
      <div className="flex items-end justify-between gap-3 h-20">
        <div className="flex-1 flex flex-col items-center justify-end">
          <div className="w-full bg-white/30 rounded-t" style={{ height: `${Math.max(from, 5)}%` }} />
          <span className="text-white/60 text-xs mt-2">{from}%</span>
          <span className="text-white/40 text-[10px]">30d ago</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-end">
          <div
            className="w-full rounded-t"
            style={{ height: `${Math.max(to, 5)}%`, backgroundColor: up ? '#2563EB' : '#DC2626' }}
          />
          <span className="text-white text-xs mt-2 font-semibold">{to}%</span>
          <span className="text-white/40 text-[10px]">today</span>
        </div>
      </div>
      {label && <p className="text-center text-white/50 text-xs mt-3">{label}</p>}
    </div>
  );
}

// ─── Card 5: Action ───
function ActionCard({
  ctaLabel,
  poll,
  userVote,
  onVote,
}: {
  ctaLabel: string;
  poll: any | null;
  userVote: { choice: string } | null;
  onVote: () => void;
}) {
  if (!poll) {
    return (
      <div className="absolute inset-0 bg-[#0a0a0a] flex items-center justify-center text-white/60 text-sm">
        No poll attached
      </div>
    );
  }
  return (
    <div className="absolute inset-0 bg-[#0a0a0a] flex flex-col p-6 pt-14">
      <h3 className="text-white font-bold text-[18px] mb-5 text-balance">{poll.question}</h3>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <PollSide label={poll.option_a} img={poll.image_a_url} chosen={userVote?.choice === 'A'} />
        <PollSide label={poll.option_b} img={poll.image_b_url} chosen={userVote?.choice === 'B'} />
      </div>
      <div className="mt-auto pointer-events-auto">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onVote(); }}
          className="w-full h-14 rounded-full bg-[#2563EB] text-white font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          {userVote ? 'Vote on related polls' : ctaLabel}
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
function PollSide({ label, img, chosen }: { label: string; img?: string | null; chosen: boolean }) {
  return (
    <div className={`relative aspect-[4/5] rounded-xl overflow-hidden ${chosen ? 'ring-2 ring-[#2563EB]' : 'ring-1 ring-white/10'}`}>
      {img ? (
        <img src={img} alt={label} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-white/5" />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
        <p className="text-white text-xs font-semibold truncate">{label}</p>
      </div>
      {chosen && (
        <div className="absolute top-2 right-2 bg-[#2563EB] text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
          Your pick
        </div>
      )}
    </div>
  );
}
