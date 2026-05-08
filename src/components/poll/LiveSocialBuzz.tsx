/**
 * LiveSocialBuzz — overlays on poll cards showing social energy.
 * Picks one contextual line based on poll stats to make the feed feel alive.
 * Lightweight — no extra queries, uses data already available on the card.
 */
import { useMemo } from 'react';
import { Users, Flame, TrendingUp, Zap } from 'lucide-react';

interface LiveSocialBuzzProps {
  totalVotes: number;
  percentA: number;
  percentB: number;
  category?: string | null;
  isLive?: boolean;
}

const THRESHOLD_HOT = 100;
const THRESHOLD_EXPLODING = 500;

export default function LiveSocialBuzz({ totalVotes, percentA, percentB, category, isLive }: LiveSocialBuzzProps) {
  const buzz = useMemo(() => {
    const gap = Math.abs(percentA - percentB);
    const isClose = gap <= 10;
    const isSplit = gap <= 5;
    const isExploding = totalVotes >= THRESHOLD_EXPLODING;
    const isHot = totalVotes >= THRESHOLD_HOT;

    // Priority: exploding > split > hot > close > trending > default
    if (isExploding) return { icon: Flame, text: `${totalVotes.toLocaleString()} votes — this one's exploding`, color: 'text-orange-500' };
    if (isSplit && isHot) return { icon: Zap, text: 'Egypt is completely split on this', color: 'text-primary' };
    if (isClose && isHot) return { icon: Users, text: `It's neck and neck — ${totalVotes.toLocaleString()} votes`, color: 'text-foreground/70' };
    if (isHot) return { icon: TrendingUp, text: 'Trending in Egypt', color: 'text-primary' };
    if (isLive && totalVotes > 20) return { icon: Users, text: `${totalVotes} voting right now`, color: 'text-foreground/60' };
    if (totalVotes > 30) return { icon: Users, text: `${totalVotes} people have taken a side`, color: 'text-foreground/50' };
    return null;
  }, [totalVotes, percentA, percentB, isLive]);

  if (!buzz) return null;

  const Icon = buzz.icon;
  return (
    <div className={`flex items-center gap-1 ${buzz.color}`}>
      <Icon className="h-3 w-3 flex-shrink-0" />
      <span className="text-[10px] font-medium leading-none">{buzz.text}</span>
    </div>
  );
}
