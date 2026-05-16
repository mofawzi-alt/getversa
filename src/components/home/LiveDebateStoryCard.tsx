import { useMemo, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Users, Send, Share2, Clock } from 'lucide-react';
import { getPollDisplayImageSrc, handlePollImageError } from '@/lib/pollImages';
import CategoryBadge from '@/components/category/CategoryBadge';
import { mapToVersaCategory } from '@/lib/categoryMeta';

export interface LiveDebateStoryPoll {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  image_a_url: string | null;
  image_b_url: string | null;
  category: string | null;
  ends_at?: string | null;
  totalVotes: number;
  percentA: number;
  percentB: number;
}

interface Props {
  poll: LiveDebateStoryPoll;
  hasVoted: boolean;
  userChoice?: string | null;
  topSlot?: ReactNode;
  extraSideAction?: ReactNode;
  onClick: () => void;
  onShare?: () => void;
  onSendToFriend?: () => void;
  eagerImage?: boolean;
  height: string;
}

function formatTimeLeft(ends_at?: string | null): string | null {
  if (!ends_at) return null;
  const ms = new Date(ends_at).getTime() - Date.now();
  if (ms <= 0) return null;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 24) return `${Math.floor(hours / 24)}d left`;
  if (hours >= 1) return `${hours}h left`;
  const mins = Math.floor(ms / 60_000);
  return `${mins}m left`;
}

export default function LiveDebateStoryCard({
  poll,
  hasVoted,
  userChoice,
  topSlot,
  extraSideAction,
  onClick,
  onShare,
  onSendToFriend,
  eagerImage,
  height,
}: Props) {
  // Pick the dominant image (winning side) as the full-bleed background, fallback to either.
  const dominantSide: 'A' | 'B' = poll.percentA >= poll.percentB ? 'A' : 'B';
  const bgImageSrc = useMemo(() => {
    const primary = dominantSide === 'A' ? poll.image_a_url : poll.image_b_url;
    const fallback = dominantSide === 'A' ? poll.image_b_url : poll.image_a_url;
    return getPollDisplayImageSrc({
      imageUrl: primary || fallback,
      option: dominantSide === 'A' ? poll.option_a : poll.option_b,
      question: poll.question,
      side: dominantSide,
    });
  }, [poll, dominantSide]);

  const [imgLoaded, setImgLoaded] = useState(false);
  const timeLeft = formatTimeLeft(poll.ends_at);
  const pctA = Math.round(poll.percentA || 0);
  const pctB = Math.round(poll.percentB || 0);
  const isLandslide = Math.abs(pctA - pctB) >= 30 && poll.totalVotes >= 10;
  const isClose = Math.abs(pctA - pctB) <= 10 && poll.totalVotes >= 10;

  return (
    <div
      style={{ height }}
      className="relative w-full snap-start snap-always overflow-hidden bg-black cursor-pointer select-none"
      onClick={onClick}
    >
      {/* Full-bleed background image */}
      {bgImageSrc && (
        <img
          src={bgImageSrc}
          alt=""
          loading={eagerImage ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setImgLoaded(true)}
          onError={(e) => handlePollImageError(e, { option: dominantSide === 'A' ? poll.option_a : poll.option_b, question: poll.question, side: dominantSide })}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
            imgLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
      {/* Dark gradient overlay for legibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/20 to-black/85 pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/55 to-transparent pointer-events-none" />

      {/* TOP ROW — LIVE pill + category + share-to-story */}
      <div className="absolute inset-x-0 top-0 px-4 pt-[max(env(safe-area-inset-top),12px)] flex items-start justify-between gap-2 z-10">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive text-white text-[11px] font-extrabold uppercase tracking-wider shadow-lg">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
            </span>
            LIVE
          </span>
          {poll.category && (
            <span className="inline-flex">
              <CategoryBadge
                category={mapToVersaCategory(poll.category)}
                variant="pill"
                size="sm"
              />
            </span>
          )}
          {timeLeft && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/15 backdrop-blur-md text-white text-[11px] font-bold">
              <Clock className="w-3 h-3" />
              {timeLeft}
            </span>
          )}
        </div>
        {extraSideAction && <div>{extraSideAction}</div>}
      </div>

      {/* OPTIONAL EYEBROW BADGE (Hot Take, Trending, etc.) */}
      {topSlot && (
        <div className="absolute left-4 top-[calc(max(env(safe-area-inset-top),12px)+44px)] z-10">
          <div className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/15 inline-flex">
            {topSlot}
          </div>
        </div>
      )}

      {/* BOTTOM CONTENT BLOCK */}
      <div className="absolute inset-x-0 bottom-0 px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-6 z-10 flex flex-col gap-3">
        {/* Question */}
        <motion.h2
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-white text-[26px] sm:text-[28px] leading-[1.15] font-extrabold drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]"
        >
          {poll.question}
        </motion.h2>

        {/* Option labels */}
        <div className="grid grid-cols-2 gap-3 text-white/85 text-[13px] font-semibold leading-snug">
          <div className="line-clamp-2">{poll.option_a}</div>
          <div className="line-clamp-2 text-right">{poll.option_b}</div>
        </div>

        {/* Split bar */}
        <div className="w-full h-9 rounded-full overflow-hidden flex bg-white/15 backdrop-blur-md border border-white/15 shadow-lg">
          <motion.div
            initial={{ width: '50%' }}
            animate={{ width: `${pctA}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className={`h-full flex items-center justify-start pl-3 text-[13px] font-extrabold text-white ${
              userChoice === 'A' ? 'ring-2 ring-white/70 ring-inset' : ''
            }`}
            style={{ backgroundColor: 'hsl(var(--option-a))' }}
          >
            {pctA > 12 && `${pctA}%`}
          </motion.div>
          <div
            className={`h-full flex-1 flex items-center justify-end pr-3 text-[13px] font-extrabold text-white ${
              userChoice === 'B' ? 'ring-2 ring-white/70 ring-inset' : ''
            }`}
            style={{ backgroundColor: 'hsl(var(--option-b) / 0.85)' }}
          >
            {pctB > 12 && `${pctB}%`}
          </div>
        </div>

        {/* Voter count + tension tag */}
        <div className="flex items-center justify-between text-white/80 text-[12px] font-semibold">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            <span>
              {poll.totalVotes.toLocaleString()} {poll.totalVotes === 1 ? 'person voted' : 'people voted'}
            </span>
          </div>
          {isClose && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-200 text-[10px] font-extrabold uppercase tracking-wider">
              Too Close
            </span>
          )}
          {isLandslide && (
            <span className="px-2 py-0.5 rounded-full bg-primary/30 text-white text-[10px] font-extrabold uppercase tracking-wider">
              Landslide
            </span>
          )}
        </div>

        {/* CTA row — Vote Now + Send + Share */}
        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className="flex-1 h-12 rounded-full bg-primary text-primary-foreground font-extrabold text-[15px] shadow-[0_6px_24px_hsl(var(--primary)/0.5)] active:scale-[0.98] transition-transform"
          >
            {hasVoted ? 'See Results →' : 'Vote Now →'}
          </button>
          {onSendToFriend && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSendToFriend();
              }}
              aria-label="Send to friend"
              className="h-12 w-12 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white flex items-center justify-center active:scale-95 transition-transform"
            >
              <Send className="w-[18px] h-[18px]" />
            </button>
          )}
          {onShare && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onShare();
              }}
              aria-label="Share"
              className="h-12 w-12 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white flex items-center justify-center active:scale-95 transition-transform"
            >
              <Share2 className="w-[18px] h-[18px]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
