import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Flame, Target, Zap, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface InsightItem {
  pollId: string;
  question: string;
}

interface InsightData {
  polarizing: (InsightItem & {
    splitPercentage: number;
    totalVotes: number;
  }) | null;
  segmentBias: (InsightItem & {
    segment: string;
    biasPercentage: number;
    winner: string;
  }) | null;
  fastest: (InsightItem & {
    avgSeconds: number;
    totalVotes: number;
  }) | null;
}

interface InsightHighlightsProps {
  onPollSelect?: (pollId: string) => void;
}

export default function InsightHighlights({ onPollSelect }: InsightHighlightsProps) {
  const { data: insights, isLoading } = useQuery({
    queryKey: ['admin-insights'],
    queryFn: async (): Promise<InsightData> => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: polls } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, created_at')
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false });

      if (!polls || polls.length === 0) {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const { data: recentPolls } = await supabase
          .from('polls')
          .select('id, question, option_a, option_b, created_at')
          .gte('created_at', weekAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(20);
        
        if (!recentPolls || recentPolls.length === 0) {
          return { polarizing: null, segmentBias: null, fastest: null };
        }
        
        return await calculateInsights(recentPolls);
      }

      return await calculateInsights(polls);
    },
    staleTime: 60000,
  });

  async function calculateInsights(polls: any[]): Promise<InsightData> {
    const pollIds = polls.map(p => p.id);
    
    const { data: votes } = await supabase
      .from('votes')
      .select('poll_id, choice, created_at, user_id')
      .in('poll_id', pollIds);

    if (!votes || votes.length === 0) {
      return { polarizing: null, segmentBias: null, fastest: null };
    }

    const userIds = [...new Set(votes.map(v => v.user_id))];
    const { data: users } = await supabase
      .from('users')
      .select('id, gender, age_range, country')
      .in('id', userIds);

    const userMap = new Map(users?.map(u => [u.id, u]) || []);

    let mostPolarizing: InsightData['polarizing'] = null;
    let closestToFifty = Infinity;

    let strongestBias: InsightData['segmentBias'] = null;
    let highestBiasScore = 0;

    let fastestPoll: InsightData['fastest'] = null;
    let fastestAvg = Infinity;

    for (const poll of polls) {
      const pollVotes = votes.filter(v => v.poll_id === poll.id);
      if (pollVotes.length < 3) continue;

      const aVotes = pollVotes.filter(v => v.choice === 'A').length;
      const bVotes = pollVotes.filter(v => v.choice === 'B').length;
      const total = aVotes + bVotes;
      if (total === 0) continue;

      const aPercent = (aVotes / total) * 100;
      const splitDiff = Math.abs(50 - aPercent);

      if (splitDiff < closestToFifty) {
        closestToFifty = splitDiff;
        mostPolarizing = {
          pollId: poll.id,
          question: poll.question,
          splitPercentage: Math.round(Math.min(aPercent, 100 - aPercent)),
          totalVotes: total,
        };
      }

      const segments = ['gender', 'age_range', 'country'] as const;
      for (const segment of segments) {
        const segmentGroups = new Map<string, { a: number; b: number }>();
        
        for (const vote of pollVotes) {
          const user = userMap.get(vote.user_id);
          const segmentValue = user?.[segment];
          if (!segmentValue) continue;
          
          if (!segmentGroups.has(segmentValue)) {
            segmentGroups.set(segmentValue, { a: 0, b: 0 });
          }
          const group = segmentGroups.get(segmentValue)!;
          if (vote.choice === 'A') group.a++;
          else group.b++;
        }

        for (const [segmentValue, counts] of segmentGroups) {
          const segmentTotal = counts.a + counts.b;
          if (segmentTotal < 3) continue;
          
          const segmentBias = Math.abs((counts.a / segmentTotal) * 100 - 50);
          if (segmentBias > highestBiasScore) {
            highestBiasScore = segmentBias;
            const winner = counts.a > counts.b ? poll.option_a : poll.option_b;
            strongestBias = {
              pollId: poll.id,
              question: poll.question,
              segment: formatSegment(segment, segmentValue),
              biasPercentage: Math.round(50 + segmentBias),
              winner: winner.length > 20 ? winner.substring(0, 20) + '...' : winner,
            };
          }
        }
      }

      const pollCreatedAt = new Date(poll.created_at).getTime();
      let totalResponseTime = 0;
      let validResponses = 0;

      for (const vote of pollVotes) {
        const voteTime = new Date(vote.created_at).getTime();
        const responseTime = (voteTime - pollCreatedAt) / 1000;
        if (responseTime > 0 && responseTime < 86400) {
          totalResponseTime += responseTime;
          validResponses++;
        }
      }

      if (validResponses > 0) {
        const avgResponse = totalResponseTime / validResponses;
        if (avgResponse < fastestAvg) {
          fastestAvg = avgResponse;
          fastestPoll = {
            pollId: poll.id,
            question: poll.question,
            avgSeconds: Math.round(avgResponse),
            totalVotes: total,
          };
        }
      }
    }

    return {
      polarizing: mostPolarizing,
      segmentBias: strongestBias,
      fastest: fastestPoll,
    };
  }

  function formatSegment(type: string, value: string): string {
    const labels: Record<string, string> = {
      gender: '👤',
      age_range: '📅',
      country: '🌍',
    };
    return `${labels[type] || ''} ${value}`;
  }

  function formatTime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  }

  const handleClick = (pollId: string) => {
    if (onPollSelect) {
      onPollSelect(pollId);
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    );
  }

  const hasAnyInsight = insights?.polarizing || insights?.segmentBias || insights?.fastest;

  if (!hasAnyInsight) {
    return null;
  }

  return (
    <div className="grid grid-cols-3 gap-2 mb-4">
      {/* Most Polarizing Poll */}
      {insights?.polarizing && (
        <button
          onClick={() => handleClick(insights.polarizing!.pollId)}
          title={insights.polarizing.question}
          className="rounded-lg p-2.5 border-l-2 border-l-orange-500 bg-orange-500/10 text-left transition-all hover:bg-orange-500/20 active:scale-[0.98] cursor-pointer min-w-0"
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Flame className="h-3.5 w-3.5 text-orange-400 shrink-0" />
            <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wide truncate">
              Top Split
            </span>
          </div>
          <p className="text-sm font-semibold text-white">
            {insights.polarizing.splitPercentage}/{100 - insights.polarizing.splitPercentage}
          </p>
          <p className="text-[10px] text-white/60 truncate mt-0.5">
            {insights.polarizing.question}
          </p>
        </button>
      )}

      {/* Strongest Segment Bias */}
      {insights?.segmentBias && (
        <button
          onClick={() => handleClick(insights.segmentBias!.pollId)}
          title={insights.segmentBias.question}
          className="rounded-lg p-2.5 border-l-2 border-l-violet-500 bg-violet-500/10 text-left transition-all hover:bg-violet-500/20 active:scale-[0.98] cursor-pointer min-w-0"
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Target className="h-3.5 w-3.5 text-violet-400 shrink-0" />
            <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wide truncate">
              Segment Bias
            </span>
          </div>
          <p className="text-sm font-semibold text-white">
            {insights.segmentBias.biasPercentage}%
          </p>
          <p className="text-[10px] text-white/60 truncate mt-0.5">
            {insights.segmentBias.segment}
          </p>
        </button>
      )}

      {/* Fastest Decision Poll */}
      {insights?.fastest && (
        <button
          onClick={() => handleClick(insights.fastest!.pollId)}
          title={insights.fastest.question}
          className="rounded-lg p-2.5 border-l-2 border-l-amber-500 bg-amber-500/10 text-left transition-all hover:bg-amber-500/20 active:scale-[0.98] cursor-pointer min-w-0"
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Zap className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wide truncate">
              Fastest
            </span>
          </div>
          <p className="text-sm font-semibold text-white">
            {formatTime(insights.fastest.avgSeconds)}
          </p>
          <p className="text-[10px] text-white/60 truncate mt-0.5">
            {insights.fastest.question}
          </p>
        </button>
      )}
    </div>
  );
}
