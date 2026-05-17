import { Share2, Check, X, Send, Trophy, Sparkles, Flame } from 'lucide-react';
import { toast } from 'sonner';
import PollOptionImage from '@/components/poll/PollOptionImage';
import { usePollReactions } from '@/hooks/usePollReactions';
import { getCategoryColorClass, mapToVersaCategory } from '@/lib/categoryMeta';
import ShareToStoryButton from '@/components/stories/ShareToStoryButton';

export interface DemoTag {
  emoji: string;
  label: string;
  choice: 'A' | 'B';
}

export interface BrowsePoll {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  image_a_url: string | null;
  image_b_url: string | null;
  category: string | null;
  created_at: string;
  expiry_type?: string | null;
  ends_at?: string | null;
  isClosed?: boolean;
  totalVotes: number;
  votesA: number;
  votesB: number;
  percentA: number;
  percentB: number;
  winner: 'A' | 'B';
  winnerPct: number;
  demoTags: DemoTag[];
  egyptPct: number;
}

// Compute up to 3 demographic deviation tags (>10% off national avg for the WINNING option)
export function computeDemoTags(votes: any[], nationalWinnerPct: number, winner: 'A' | 'B'): DemoTag[] {
  if (!votes || votes.length < 8) return [];
  const tags: DemoTag[] = [];
  const threshold = 10;

  const groupPct = (filterFn: (v: any) => boolean): { pct: number; total: number } | null => {
    const subset = votes.filter(filterFn);
    if (subset.length < 4) return null;
    const winCount = subset.filter(v => v.choice === winner).length;
    return { pct: Math.round((winCount / subset.length) * 100), total: subset.length };
  };

  const cities = Array.from(new Set(votes.map(v => v.voter_city).filter(Boolean)));
  let bestCity: { name: string; deviation: number; chose: 'A' | 'B' } | null = null;
  for (const city of cities) {
    const stats = groupPct(v => v.voter_city === city);
    if (!stats) continue;
    const deviation = stats.pct - nationalWinnerPct;
    if (Math.abs(deviation) > threshold && (!bestCity || Math.abs(deviation) > Math.abs(bestCity.deviation))) {
      bestCity = { name: city, deviation, chose: deviation > 0 ? winner : (winner === 'A' ? 'B' : 'A') };
    }
  }
  if (bestCity) tags.push({ emoji: '🏙', label: `${bestCity.name} chose this`, choice: bestCity.chose });

  const genZ = groupPct(v => ['18-24', '13-17'].includes(v.voter_age_range));
  const older = groupPct(v => ['25-34', '35-44', '45-54', '55+'].includes(v.voter_age_range));
  if (genZ && older) {
    const dev = genZ.pct - older.pct;
    if (Math.abs(dev) > threshold) {
      tags.push({
        emoji: '⚡',
        label: dev > 0 ? 'Gen Z chose this' : '25+ chose this',
        choice: dev > 0 ? winner : (winner === 'A' ? 'B' : 'A'),
      });
    }
  }

  const female = groupPct(v => v.voter_gender === 'Female');
  const male = groupPct(v => v.voter_gender === 'Male');
  if (female && male) {
    const dev = female.pct - male.pct;
    if (Math.abs(dev) > threshold) {
      tags.push({
        emoji: dev > 0 ? '👩' : '👨',
        label: dev > 0 ? 'Females chose this' : 'Males chose this',
        choice: dev > 0 ? winner : (winner === 'A' ? 'B' : 'A'),
      });
    }
  }

  return tags.slice(0, 3);
}

export function FireReactionButton({ pollId }: { pollId: string }) {
  const { count, reacted, toggle, canReact } = usePollReactions(pollId);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (!canReact) {
          toast.info('Sign in to react 🔥');
          return;
        }
        toggle();
      }}
      className={`min-w-9 h-9 px-1.5 rounded-full backdrop-blur-sm border flex items-center justify-center gap-1 transition-all ${
        reacted
          ? 'bg-orange-500/20 border-orange-500/40 text-orange-500 scale-110'
          : 'bg-background/80 border-border/50 text-foreground hover:bg-orange-500/10'
      }`}
      aria-label={reacted ? 'Remove fire reaction' : 'Add fire reaction'}
    >
      <Flame className={`h-3.5 w-3.5 ${reacted ? 'fill-current' : ''}`} />
      {count > 0 && (
        <span className="text-[10px] font-bold tabular-nums">
          {count > 999 ? `${(count / 1000).toFixed(1)}k` : count}
        </span>
      )}
    </button>
  );
}

export interface BrowseCardProps {
  poll: BrowsePoll;
  userChoice: string | null;
  isActive: boolean;
  isSignedIn: boolean;
  onVote?: () => void;
  onShare?: () => void;
  onSendToFriend?: () => void;
  hideVotePrompt?: boolean;
  /** 'dark' (Browse default) or 'light' (Home Live Debate) */
  theme?: 'dark' | 'light';
  /** Optional eyebrow content rendered above the question (e.g. badges, friends voted) */
  topSlot?: React.ReactNode;
  /** Optional extra side-action button rendered above Send / Fire (e.g. add to story) */
  extraSideAction?: React.ReactNode;
  /** Eager-load poll images (first cards in a feed) for instant first paint. */
  eagerImages?: boolean;
  /** Adds native iOS safe-area room when the card is pinned to the top of the screen. */
  safeAreaTop?: boolean;
}

export default function BrowseCard({
  poll,
  userChoice,
  isSignedIn,
  onVote,
  onShare,
  onSendToFriend,
  hideVotePrompt = false,
  theme = 'dark',
  topSlot,
  extraSideAction,
  eagerImages = false,
  safeAreaTop = false,
}: BrowseCardProps) {
  const imgLoading: 'eager' | 'lazy' = eagerImages ? 'eager' : 'lazy';
  const winnerLabel = poll.winner === 'A' ? poll.option_a : poll.option_b;
  const winnerImg = poll.winner === 'A' ? poll.image_a_url : poll.image_b_url;
  const loserLabel = poll.winner === 'A' ? poll.option_b : poll.option_a;
  const loserPct = poll.winner === 'A' ? poll.percentB : poll.percentA;

  const userPickedWinner = userChoice ? userChoice === poll.winner : null;
  const userVoted = !!userChoice;
  const userPct = userChoice ? (userChoice === 'A' ? poll.percentA : poll.percentB) : null;
  const userLabel = userChoice ? (userChoice === 'A' ? poll.option_a : poll.option_b) : null;

  const independentPct = !userPickedWinner && userPct != null ? Math.max(5, Math.round(userPct / 5) * 5) : null;

  const isDivided = poll.winnerPct >= 45 && poll.winnerPct <= 55;
  const verdictLabel =
    poll.winnerPct >= 80 ? 'Egypt overwhelmingly chose this'
    : poll.winnerPct >= 65 ? 'Egypt chose this'
    : poll.winnerPct >= 56 ? 'Slight majority chose this'
    : 'Egypt chose this';
  const dividedGap = Math.abs(poll.percentA - poll.percentB);

  const isLight = true; // Force light surface + black text for readability across all card images
  const surfaceBg = isLight ? 'bg-background' : 'bg-[#0B0B0C]';
  const titleColor = isLight ? 'text-foreground' : 'text-white';
  const chipBg = isLight ? 'bg-muted text-foreground/80' : 'bg-white/10 text-white/85';
  const subText = isLight ? 'text-muted-foreground' : 'text-white/55';
  const borderTop = isLight ? 'border-border/40' : 'border-white/5';
  const tagBg = isLight ? 'bg-muted text-foreground/80' : 'bg-white/8 text-white/90';
  const loserText = isLight ? 'text-foreground' : 'text-foreground';
  const loserPrefix = isLight ? 'text-foreground/70' : 'text-foreground/70';
  const shareBtn = isLight
    ? 'bg-muted text-foreground hover:bg-muted/80'
    : 'bg-white/10 backdrop-blur-md text-white';
  const topInset = safeAreaTop ? 'env(safe-area-inset-top, 0px)' : '0px';

  // Image used to bleed into the card surface (so the pic feels like the whole card)
  const surfaceImg = poll.image_a_url || poll.image_b_url || winnerImg;
  const categoryColorClass = poll.category ? getCategoryColorClass(mapToVersaCategory(poll.category)) : chipBg;

  return (
    <div
      className={`h-full w-full flex flex-col relative overflow-hidden`}
      style={{
        WebkitFontSmoothing: 'antialiased',
        // @ts-ignore
        MozOsxFontSmoothing: 'grayscale',
      }}
    >
      {/* Blurred image background — makes the picture feel like it fills the whole card */}
      {surfaceImg ? (
        <div aria-hidden className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <div
            className="absolute inset-0 scale-125"
            style={{
              backgroundImage: `url(${surfaceImg})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(40px) saturate(1.25)',
              opacity: 0.6,
            }}
          />
          <div className={`absolute inset-0 ${isLight ? 'bg-background/72' : 'bg-[#0B0B0C]/78'} backdrop-blur-2xl`} />
        </div>
      ) : (
        <div className={`absolute inset-0 z-0 ${surfaceBg}`} />
      )}

      {/* Optional eyebrow row (badges, friends voted, etc.) */}
      {topSlot && (
        <div className={`shrink-0 px-4 z-20 relative`} style={{ paddingTop: `calc(${topInset} + 12px)` }}>
          {topSlot}
        </div>
      )}

      {/* TOP BAR */}
      <div
        className={`shrink-0 px-4 pb-3 z-20 relative`}
        style={{ paddingTop: topSlot ? '8px' : `calc(${topInset} + 16px)` }}
      >
        <p
          className={`font-display font-bold text-[22px] leading-[1.15] ${titleColor} pr-12`}
          style={{ letterSpacing: '-0.01em' }}
        >
          {poll.question}
        </p>
        <div className="flex items-center gap-2 mt-2">
          {poll.category && (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full ${categoryColorClass} text-[12px] font-semibold tracking-wide`}>
              {poll.category}
            </span>
          )}
          {poll.isClosed && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full ${chipBg} text-[12px] font-semibold`}>
              🔒 Closed
            </span>
          )}
          <span className={`ml-auto text-[12px] font-semibold ${subText} tabular-nums`}>
            {poll.totalVotes.toLocaleString()} votes
          </span>
        </div>

        {onShare && (
          <button
            onClick={(e) => { e.stopPropagation(); onShare(); }}
            className={`absolute right-3 w-9 h-9 rounded-full ${shareBtn} flex items-center justify-center active:scale-95 transition-transform`}
            style={{ top: topSlot ? '4px' : `calc(${topInset} + 14px)` }}
            aria-label="Share"
          >
            <Share2 className="h-[14px] w-[14px]" />
          </button>
        )}
      </div>

      {/* MIDDLE */}
      <div className="flex-1 relative overflow-hidden min-h-0 bg-black z-10">
        {isDivided ? (
          <>
            <div className="absolute inset-0 flex">
              <div className="w-1/2 h-full relative overflow-hidden">
                <PollOptionImage
                  imageUrl={poll.image_a_url}
                  option={poll.option_a}
                  question={poll.question}
                  side="A"
                  maxLogoSize="80%"
                  loading={imgLoading}
                  variant="browse"
                />
                <div className="absolute inset-x-0 bottom-0 px-3 pt-12 pb-12 bg-gradient-to-t from-black/95 via-black/65 to-transparent">
                  <p className="text-white font-semibold text-[15px] line-clamp-2 leading-snug" style={{ textShadow: '0 1px 3px rgba(0,0,0,.45)' }}>
                    {poll.option_a}
                  </p>
                  <p className="text-white font-display font-extrabold text-[34px] leading-none mt-1 tabular-nums" style={{ textShadow: '0 2px 6px rgba(0,0,0,.5)' }}>
                    {poll.percentA}<span className="text-[20px] font-bold">%</span>
                  </p>
                </div>
              </div>
              <div className="w-px bg-white/25 z-10" />
              <div className="w-1/2 h-full relative overflow-hidden">
                <PollOptionImage
                  imageUrl={poll.image_b_url}
                  option={poll.option_b}
                  question={poll.question}
                  side="B"
                  maxLogoSize="80%"
                  loading={imgLoading}
                  variant="browse"
                />
                <div className="absolute inset-x-0 bottom-0 px-3 pt-12 pb-12 bg-gradient-to-t from-black/95 via-black/65 to-transparent">
                  <p className="text-white font-semibold text-[15px] line-clamp-2 leading-snug" style={{ textShadow: '0 1px 3px rgba(0,0,0,.45)' }}>
                    {poll.option_b}
                  </p>
                  <p className="text-white font-display font-extrabold text-[34px] leading-none mt-1 tabular-nums" style={{ textShadow: '0 2px 6px rgba(0,0,0,.5)' }}>
                    {poll.percentB}<span className="text-[20px] font-bold">%</span>
                  </p>
                </div>
              </div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
              <div className="bg-black/75 backdrop-blur-xl px-5 py-3 rounded-2xl text-center border border-white/20 shadow-2xl flex items-center gap-2.5">
                <span className="text-2xl">⚖️</span>
                <div className="text-left">
                  <p className="text-white font-display font-bold text-[18px] leading-tight">Egypt is split</p>
                  <p className="text-white/70 text-[13px] leading-tight">Only {dividedGap}% apart</p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div
              className="absolute inset-0"
              style={{ filter: userVoted && !userPickedWinner ? 'brightness(0.65)' : 'none' }}
            >
              <PollOptionImage
                imageUrl={winnerImg}
                option={winnerLabel}
                question={poll.question}
                side={poll.winner}
                maxLogoSize="80%"
                loading={imgLoading}
                variant="browse"
              />
            </div>

            <div
              className="absolute inset-x-0 bottom-0 flex flex-col justify-end px-4 pb-14 pt-16"
              style={{
                background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.78) 40%, rgba(0,0,0,0.35) 75%, rgba(0,0,0,0) 100%)',
              }}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <Trophy className="h-3.5 w-3.5 text-yellow-400" />
                <p className="text-yellow-400 text-[11px] font-bold uppercase tracking-[0.08em]" style={{ textShadow: '0 1px 2px rgba(0,0,0,.5)' }}>
                  {verdictLabel}
                </p>
              </div>

              <div className="flex items-end gap-3" style={{ textShadow: '0 2px 6px rgba(0,0,0,.55)' }}>
                <span className="text-white font-display font-extrabold text-[56px] leading-none tabular-nums">
                  {poll.winnerPct}<span className="text-[28px] font-bold">%</span>
                </span>
                <span className="text-white font-bold text-[18px] leading-tight pb-1.5 line-clamp-2 flex-1">
                  {winnerLabel}
                </span>
              </div>

              {userVoted && (
                <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/15">
                  {userPickedWinner ? (
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                      <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center shrink-0">
                      <X className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                    </div>
                  )}
                  <span className="text-[14px] font-semibold text-white/90 leading-tight">
                    {userPickedWinner ? 'You agreed' : 'You picked'} — {userLabel} · <span className="tabular-nums">{userPct}%</span>
                  </span>
                </div>
              )}
            </div>
          </>
        )}


        {!isDivided && independentPct != null && (
          <div className="absolute top-3 left-3 z-20">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-xl border border-white/20">
              <Sparkles className="h-3.5 w-3.5" />
              <span className="text-[12px] font-bold tracking-tight">Top {independentPct}% independent</span>
            </div>
          </div>
        )}

        {/* % split bar — merged onto the picture itself, edge-to-edge */}
        <div className="absolute inset-x-0 bottom-0 z-20 pointer-events-none">
          <div className="flex items-center justify-between px-3 pb-1.5">
            <span className="text-[13px] font-extrabold tabular-nums text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,.6)' }}>
              <span className="text-option-a">●</span> {poll.percentA}%
            </span>
            <span className="text-[13px] font-extrabold tabular-nums text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,.6)' }}>
              {poll.percentB}% <span className="text-option-b">●</span>
            </span>
          </div>
          <div className="h-3 w-full flex overflow-hidden">
            <div
              className="h-full bg-option-a transition-all duration-700"
              style={{ width: `${poll.percentA}%` }}
            />
            <div
              className="h-full bg-option-b transition-all duration-700"
              style={{ width: `${poll.percentB}%` }}
            />
          </div>
        </div>
      </div>

      {/* BOTTOM */}
      <div className={`shrink-0 relative z-10 px-4 pt-2 pb-2 space-y-1.5 border-t ${borderTop}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-2">
            {poll.demoTags.length > 0 ? (
              <div className="flex flex-wrap gap-x-2.5 gap-y-1.5">
                {poll.demoTags.map((tag, i) => (
                  <span
                    key={i}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full ${tagBg} text-[13px] font-medium leading-snug`}
                  >
                    <span className="text-[14px]">{tag.emoji}</span>
                    {tag.label}
                  </span>
                ))}
              </div>
            ) : (
              <span className={`inline-flex items-center gap-1.5 text-[14px] font-medium ${isLight ? 'text-foreground/85' : 'text-white/85'}`}>
                🇪🇬 Egypt chose this — <span className="font-bold tabular-nums">{poll.winnerPct}%</span>
              </span>
            )}

          </div>

          <div className="shrink-0 flex flex-row items-center gap-1.5 pt-0.5">
            {extraSideAction}
            {isSignedIn && (
              <ShareToStoryButton
                variant="icon"
                storyType="poll_result"
                imageUrl={winnerImg}
                content={{
                  poll_id: poll.id,
                  question: poll.question,
                  option_a: poll.option_a,
                  option_b: poll.option_b,
                  image_a_url: poll.image_a_url,
                  image_b_url: poll.image_b_url,
                  winner: poll.winner,
                  winner_pct: poll.winnerPct,
                  user_choice: userChoice,
                }}
                className="w-7 h-7 bg-muted hover:bg-muted/80"
              />
            )}
            {isSignedIn && onSendToFriend && (
              <button
                onClick={(e) => { e.stopPropagation(); onSendToFriend(); }}
                className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm active:scale-95 transition-transform"
                aria-label="Send in chat"
              >
                <Send className="h-3 w-3" />
              </button>
            )}
            <FireReactionButton pollId={poll.id} />
          </div>
        </div>

        {!userVoted && !poll.isClosed && !hideVotePrompt && onVote && (
          <button
            onClick={(e) => { e.stopPropagation(); onVote(); }}
            className={`w-full text-center text-[13px] font-semibold ${isLight ? 'text-primary active:text-primary/80' : 'text-blue-400 active:text-blue-300'} transition-colors pt-0.5`}
          >
            Vote on today's battles from Home →
          </button>
        )}
      </div>
    </div>
  );
}
