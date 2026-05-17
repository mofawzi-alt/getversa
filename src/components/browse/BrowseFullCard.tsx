import { Share2, Send, Users, Check, X as XIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import PollOptionImage from '@/components/poll/PollOptionImage';
import { FireReactionButton, type BrowsePoll } from './BrowseCard';

export interface BrowseFullCardProps {
  poll: BrowsePoll;
  userChoice: string | null;
  isSignedIn: boolean;
  onShare?: () => void;
  onSendToFriend?: () => void;
  eagerImages?: boolean;
}

/**
 * Browse card styled exactly like LiveDebate's full-screen card:
 * - Edge-to-edge split images A | B
 * - Question overlay at top
 * - Centered results overlay at bottom (percentages + animated bar)
 * Browse-specific extras: demo tags, fire reaction, share & send-to-friend.
 * Results-only — no voting (vote happens on Home).
 */
export default function BrowseFullCard({
  poll,
  userChoice,
  isSignedIn,
  onShare,
  onSendToFriend,
  eagerImages = false,
}: BrowseFullCardProps) {
  const loading: 'eager' | 'lazy' = eagerImages ? 'eager' : 'lazy';
  const userVoted = !!userChoice;
  const userPickedWinner = userChoice ? userChoice === poll.winner : null;
  const userLabel = userChoice ? (userChoice === 'A' ? poll.option_a : poll.option_b) : null;
  const userPct = userChoice ? (userChoice === 'A' ? poll.percentA : poll.percentB) : null;

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {/* Split images — edge to edge */}
      <div className="absolute inset-0 flex">
        <div className="w-1/2 h-full relative overflow-hidden">
          <PollOptionImage
            imageUrl={poll.image_a_url}
            option={poll.option_a}
            question={poll.question}
            side="A"
            maxLogoSize="65%"
            loading={loading}
            draggable={false}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
          <div className="absolute bottom-44 left-4 right-1">
            <p className="text-white text-lg font-bold drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
              {poll.option_a}
            </p>
          </div>
        </div>
        <div className="absolute inset-y-0 left-1/2 w-[2px] bg-white/20 z-10" />
        <div className="w-1/2 h-full relative overflow-hidden">
          <PollOptionImage
            imageUrl={poll.image_b_url}
            option={poll.option_b}
            question={poll.question}
            side="B"
            maxLogoSize="65%"
            loading={loading}
            draggable={false}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
          <div className="absolute bottom-44 left-1 right-4 text-right">
            <p className="text-white text-lg font-bold drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
              {poll.option_b}
            </p>
          </div>
        </div>
      </div>

      {/* Question overlay at top */}
      <div className="absolute top-4 inset-x-0 px-6 z-20 pointer-events-none">
        <p className="text-white text-xl font-display font-bold drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] text-center leading-snug">
          {poll.question}
        </p>
        {poll.category && (
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/10 backdrop-blur-md text-white/85 text-[10px] font-bold uppercase tracking-wider">
              {poll.category}
            </span>
            {poll.isClosed && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/10 backdrop-blur-md text-white/85 text-[10px] font-bold">
                🔒 Closed
              </span>
            )}
          </div>
        )}
      </div>

      {/* Side action stack (Share / Send / Fire) — TikTok-style */}
      <div className="absolute right-3 bottom-52 z-30 flex flex-col items-center gap-3">
        {onShare && (
          <button
            onClick={(e) => { e.stopPropagation(); onShare(); }}
            className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center active:scale-95 transition-transform"
            aria-label="Share"
          >
            <Share2 className="h-4 w-4 text-white" />
          </button>
        )}
        {isSignedIn && onSendToFriend && (
          <button
            onClick={(e) => { e.stopPropagation(); onSendToFriend(); }}
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-glow active:scale-95 transition-transform"
            aria-label="Send to friend"
          >
            <Send className="h-4 w-4" />
          </button>
        )}
        <FireReactionButton pollId={poll.id} />
      </div>

      {/* Centered results overlay at bottom (LiveDebate-style) */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute inset-x-0 bottom-0 z-20 px-6 pb-24 pt-24 flex flex-col items-center bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none"
      >
        <div className="flex flex-col items-center gap-3 max-w-xs w-full">
          {/* Percentages */}
          <div className="flex items-center gap-8">
            <div className="flex flex-col items-center">
              <span className={`text-4xl font-bold ${poll.winner === 'A' ? 'text-option-a' : 'text-white/70'} drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]`}>
                {poll.percentA}%
              </span>
              <span className="text-white/60 text-xs mt-1 truncate max-w-[110px] text-center">{poll.option_a}</span>
              {userChoice === 'A' && (
                <span className="text-option-a text-[10px] font-bold mt-0.5">Your vote</span>
              )}
            </div>
            <div className="w-px h-14 bg-white/20" />
            <div className="flex flex-col items-center">
              <span className={`text-4xl font-bold ${poll.winner === 'B' ? 'text-option-b' : 'text-white/70'} drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]`}>
                {poll.percentB}%
              </span>
              <span className="text-white/60 text-xs mt-1 truncate max-w-[110px] text-center">{poll.option_b}</span>
              {userChoice === 'B' && (
                <span className="text-option-b text-[10px] font-bold mt-0.5">Your vote</span>
              )}
            </div>
          </div>

          {/* Animated bar */}
          <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden flex">
            <motion.div
              initial={{ width: '50%' }}
              animate={{ width: `${poll.percentA}%` }}
              transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="h-full bg-option-a rounded-l-full"
            />
            <motion.div
              initial={{ width: '50%' }}
              animate={{ width: `${poll.percentB}%` }}
              transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="h-full bg-option-b rounded-r-full"
            />
          </div>

          {/* Vote count */}
          <span className="text-white/55 text-xs flex items-center gap-1">
            <Users className="h-3 w-3" /> {poll.totalVotes.toLocaleString()} votes
          </span>

          {/* "You voted" pill */}
          {userVoted && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15">
              {userPickedWinner ? (
                <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shrink-0">
                  <XIcon className="h-3 w-3 text-white" strokeWidth={3} />
                </div>
              )}
              <span className="text-[11px] font-semibold text-white/90">
                {userPickedWinner ? 'You agreed' : 'You picked'} {userLabel} · {userPct}%
              </span>
            </div>
          )}

          {/* Demo tags */}
          {poll.demoTags.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 mt-1">
              {poll.demoTags.map((tag, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 backdrop-blur-md text-white/85 text-[10px] font-medium"
                >
                  <span className="text-[12px]">{tag.emoji}</span>
                  {tag.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
