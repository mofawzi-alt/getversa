import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, Calendar, TrendingUp, X } from 'lucide-react';
import { getPollImageProps } from '@/lib/pollImageProps';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface TopPoll {
  id: string;
  question: string;
  totalVotes: number;
  category: string | null;
  option_a: string;
  option_b: string;
  image_a_url: string | null;
  image_b_url: string | null;
  votes_a: number;
  votes_b: number;
}

interface BestPollsData {
  yesterday: TopPoll | null;
  weekly: TopPoll | null;
  monthly: TopPoll | null;
}

type HighlightType = 'yesterday' | 'weekly' | 'monthly' | null;

export default function BestPollsHighlights() {
  const [activeHighlight, setActiveHighlight] = useState<HighlightType>(null);

  const { data: bestPolls, isLoading } = useQuery({
    queryKey: ['best-polls-highlights'],
    queryFn: async (): Promise<BestPollsData> => {
      const now = new Date();
      
      const yesterdayStart = new Date(now);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      yesterdayStart.setHours(0, 0, 0, 0);
      
      const yesterdayEnd = new Date(now);
      yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
      yesterdayEnd.setHours(23, 59, 59, 999);
      
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - 7);
      weekStart.setHours(0, 0, 0, 0);
      
      const monthStart = new Date(now);
      monthStart.setDate(monthStart.getDate() - 30);
      monthStart.setHours(0, 0, 0, 0);

      const { data: polls } = await supabase
        .from('polls')
        .select('id, question, category, created_at, option_a, option_b, image_a_url, image_b_url')
        .gte('created_at', monthStart.toISOString())
        .order('created_at', { ascending: false });

      if (!polls || polls.length === 0) {
        return { yesterday: null, weekly: null, monthly: null };
      }

      const pollIds = polls.map(p => p.id);
      const { data: votes } = await supabase
        .from('votes')
        .select('poll_id, choice')
        .in('poll_id', pollIds);

      // Count votes per poll and per choice
      const voteCounts: Record<string, { total: number; a: number; b: number }> = {};
      (votes || []).forEach(v => {
        if (!voteCounts[v.poll_id]) {
          voteCounts[v.poll_id] = { total: 0, a: 0, b: 0 };
        }
        voteCounts[v.poll_id].total++;
        if (v.choice === 'A') voteCounts[v.poll_id].a++;
        else voteCounts[v.poll_id].b++;
      });

      const pollsWithVotes = polls.map(p => ({
        ...p,
        totalVotes: voteCounts[p.id]?.total || 0,
        votes_a: voteCounts[p.id]?.a || 0,
        votes_b: voteCounts[p.id]?.b || 0
      }));

      const findBest = (filteredPolls: typeof pollsWithVotes): TopPoll | null => {
        if (filteredPolls.length === 0) return null;
        const sorted = [...filteredPolls].sort((a, b) => b.totalVotes - a.totalVotes);
        const best = sorted[0];
        if (best.totalVotes === 0) return null;
        return {
          id: best.id,
          question: best.question,
          totalVotes: best.totalVotes,
          category: best.category,
          option_a: best.option_a,
          option_b: best.option_b,
          image_a_url: best.image_a_url,
          image_b_url: best.image_b_url,
          votes_a: best.votes_a,
          votes_b: best.votes_b
        };
      };

      const yesterdayPolls = pollsWithVotes.filter(p => {
        const createdAt = new Date(p.created_at);
        return createdAt >= yesterdayStart && createdAt <= yesterdayEnd;
      });

      const weeklyPolls = pollsWithVotes.filter(p => {
        const createdAt = new Date(p.created_at);
        return createdAt >= weekStart;
      });

      return {
        yesterday: findBest(yesterdayPolls),
        weekly: findBest(weeklyPolls),
        monthly: findBest(pollsWithVotes)
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex gap-2 mb-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>
    );
  }

  const hasAnyPoll = bestPolls?.yesterday || bestPolls?.weekly || bestPolls?.monthly;

  if (!hasAnyPoll) {
    return null;
  }

  const highlights = [
    {
      key: 'yesterday' as const,
      poll: bestPolls?.yesterday,
      label: "Yesterday's Best",
      shortLabel: 'Yesterday',
      icon: Calendar,
      bgClass: 'bg-emerald-500/20 hover:bg-emerald-500/30',
      activeBgClass: 'bg-emerald-500',
      textClass: 'text-emerald-400',
      activeTextClass: 'text-emerald-950',
      gradientClass: 'from-emerald-500/20 to-emerald-600/10'
    },
    {
      key: 'weekly' as const,
      poll: bestPolls?.weekly,
      label: 'Weekly Best',
      shortLabel: 'Week',
      icon: TrendingUp,
      bgClass: 'bg-blue-500/20 hover:bg-blue-500/30',
      activeBgClass: 'bg-blue-500',
      textClass: 'text-blue-400',
      activeTextClass: 'text-blue-950',
      gradientClass: 'from-blue-500/20 to-blue-600/10'
    },
    {
      key: 'monthly' as const,
      poll: bestPolls?.monthly,
      label: 'Monthly Best',
      shortLabel: 'Month',
      icon: Trophy,
      bgClass: 'bg-amber-500/20 hover:bg-amber-500/30',
      activeBgClass: 'bg-amber-500',
      textClass: 'text-amber-400',
      activeTextClass: 'text-amber-950',
      gradientClass: 'from-amber-500/20 to-amber-600/10'
    }
  ];

  const activeData = highlights.find(h => h.key === activeHighlight);

  const getPercentage = (poll: TopPoll, choice: 'a' | 'b') => {
    if (poll.totalVotes === 0) return 0;
    return Math.round((choice === 'a' ? poll.votes_a : poll.votes_b) / poll.totalVotes * 100);
  };

  return (
    <>
      <div className="mb-4">
        {/* Icon buttons row */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground mr-1">🏆 Top:</span>
          {highlights.map(({ key, poll, shortLabel, icon: Icon, bgClass, activeBgClass, textClass, activeTextClass }) => {
            if (!poll) return null;
            const isActive = activeHighlight === key;
            
            return (
              <button
                key={key}
                onClick={() => setActiveHighlight(key)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isActive 
                    ? `${activeBgClass} ${activeTextClass}` 
                    : `${bgClass} ${textClass}`
                }`}
                title={`View ${shortLabel}'s best poll`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Poll Modal */}
      <Dialog open={!!activeHighlight} onOpenChange={(open) => !open && setActiveHighlight(null)}>
        <DialogContent className="max-w-sm mx-auto">
          {activeData?.poll && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <activeData.icon className={`h-5 w-5 ${activeData.textClass}`} />
                  <DialogTitle className={`text-base ${activeData.textClass}`}>
                    {activeData.label}
                  </DialogTitle>
                </div>
                <p className="text-xs text-muted-foreground">
                  {activeData.poll.totalVotes} total votes
                  {activeData.poll.category && ` • ${activeData.poll.category}`}
                </p>
              </DialogHeader>

              <div className="space-y-4 pt-2">
                {/* Question */}
                <p className="text-lg font-semibold text-foreground text-center">
                  {activeData.poll.question}
                </p>

                {/* Options with results */}
                <div className="grid grid-cols-2 gap-3">
                  {(() => { const p = getPollImageProps({ imageUrl: activeData.poll.image_a_url, option: activeData.poll.option_a, side: 'A' }); return (
                  <div className={`relative overflow-hidden rounded-xl border border-option-a/30 ${p.isBrand ? '' : 'bg-option-a/10'}`}>
                    {activeData.poll.image_a_url ? (
                      p.isBrand ? (
                        <div className="w-full aspect-square flex items-center justify-center" style={p.containerStyle}>
                          <img src={activeData.poll.image_a_url} alt={activeData.poll.option_a} className="max-w-[50%] max-h-[50%] object-contain" />
                        </div>
                      ) : (
                        <img src={activeData.poll.image_a_url} alt={activeData.poll.option_a} className="w-full aspect-square object-cover" />
                      )
                    ) : (
                      <div className="w-full aspect-square flex items-center justify-center p-3 bg-option-a/5">
                        <span className="text-sm text-center text-foreground/80">{activeData.poll.option_a}</span>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-white">Option A</span>
                        <span className="text-sm font-bold text-option-a">{getPercentage(activeData.poll, 'a')}%</span>
                      </div>
                      <div className="mt-1 h-1 bg-white/20 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-option-a rounded-full transition-all"
                          style={{ width: `${getPercentage(activeData.poll, 'a')}%` }}
                        />
                      </div>
                    </div>
                  </div>); })()}

                  {/* Option B */}
                  <div className="relative overflow-hidden rounded-xl border border-option-b/30 bg-option-b/10">
                    {activeData.poll.image_b_url ? (
                      <img 
                        src={activeData.poll.image_b_url} 
                        alt={activeData.poll.option_b}
                        className="w-full aspect-square object-cover"
                      />
                    ) : (
                      <div className="w-full aspect-square flex items-center justify-center p-3 bg-option-b/5">
                        <span className="text-sm text-center text-foreground/80">{activeData.poll.option_b}</span>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-white">Option B</span>
                        <span className="text-sm font-bold text-option-b">{getPercentage(activeData.poll, 'b')}%</span>
                      </div>
                      <div className="mt-1 h-1 bg-white/20 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-option-b rounded-full transition-all"
                          style={{ width: `${getPercentage(activeData.poll, 'b')}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Winner indicator */}
                <div className="text-center">
                  <span className="text-xs text-muted-foreground">Winner: </span>
                  <span className={`text-sm font-semibold ${activeData.poll.votes_a >= activeData.poll.votes_b ? 'text-option-a' : 'text-option-b'}`}>
                    {activeData.poll.votes_a >= activeData.poll.votes_b ? 'Option A' : 'Option B'}
                    {activeData.poll.votes_a === activeData.poll.votes_b && activeData.poll.totalVotes > 0 && ' (Tie!)'}
                  </span>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
