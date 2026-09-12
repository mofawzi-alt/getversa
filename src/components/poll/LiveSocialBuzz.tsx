/**
 * LiveSocialBuzz — overlays on poll cards showing social energy.
 * Picks one contextual line based on poll stats to make the feed feel alive.
 * Lightweight — no extra queries, uses data already available on the card.
 */
import { useMemo } from 'react';
import { Users, Flame, TrendingUp, Zap } from 'lucide-react';
import { useT } from '@/hooks/useT';

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
  const { t, lang } = useT();
  const buzz = useMemo(() => {
    const gap = Math.abs(percentA - percentB);
    const isClose = gap <= 10;
    const isSplit = gap <= 5;
    const isExploding = totalVotes >= THRESHOLD_EXPLODING;
    const isHot = totalVotes >= THRESHOLD_HOT;

    // Priority: exploding > split > hot > close > trending > default
    if (isExploding) return { icon: Flame, text: t('{n} votes — this one\'s exploding', { n: totalVotes.toLocaleString() }), color: 'text-orange-500' };
    if (isSplit && isHot) return { icon: Zap, text: t('Egypt is completely split on this'), color: 'text-primary' };
    if (isClose && isHot) return { icon: Users, text: t('It\'s neck and neck — {n} votes', { n: totalVotes.toLocaleString() }), color: 'text-foreground/70' };
    if (isHot) return { icon: TrendingUp, text: t('Trending in Egypt'), color: 'text-primary' };
    if (isLive && totalVotes > 20) return { icon: Users, text: t('{n} voting right now', { n: totalVotes }), color: 'text-foreground/60' };
    if (totalVotes > 30) return { icon: Users, text: t('{n} people have taken a side', { n: totalVotes }), color: 'text-foreground/50' };
    return null;
  }, [totalVotes, percentA, percentB, isLive, lang]);

  if (!buzz) return null;

  const Icon = buzz.icon;
  return (
    <div className={`flex items-center gap-1 ${buzz.color}`}>
      <Icon className="h-3 w-3 flex-shrink-0" />
      <span className="text-[10px] font-medium leading-none">{buzz.text}</span>
    </div>
  );
}
