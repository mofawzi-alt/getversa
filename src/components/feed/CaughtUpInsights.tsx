import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Flame, TrendingUp, BarChart3, Target, RefreshCw } from 'lucide-react';
import { Loader2 } from 'lucide-react';

interface TrendingPoll {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  totalVotes: number;
  percentA: number;
  percentB: number;
  type: 'most_voted' | 'most_controversial' | 'newest';
}

export default function CaughtUpInsights({ onRefresh }: { onRefresh: () => void }) {
  const { user, profile } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['caught-up-insights', user?.id],
    queryFn: async () => {
      // Get all active polls with results
      const { data: polls } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!polls || polls.length === 0) return null;

      const pollIds = polls.map(p => p.id);
      const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: pollIds });

      const resultsMap = new Map(
        results?.map((r: any) => [r.poll_id, r]) || []
      );

      const pollsWithResults = polls.map(p => {
        const r = resultsMap.get(p.id);
        return {
          ...p,
          totalVotes: r?.total_votes || 0,
          percentA: r?.percent_a || 0,
          percentB: r?.percent_b || 0,
        };
      }).filter(p => p.totalVotes > 0);

      // Most voted
      const mostVoted = [...pollsWithResults].sort((a, b) => b.totalVotes - a.totalVotes)[0];

      // Most controversial (closest to 50/50)
      const mostControversial = [...pollsWithResults]
        .filter(p => p.totalVotes >= 3)
        .sort((a, b) => Math.abs(a.percentA - 50) - Math.abs(b.percentA - 50))[0];

      // User stats
      let userStats = null;
      if (user) {
        const { data: votes } = await supabase
          .from('votes')
          .select('poll_id, choice')
          .eq('user_id', user.id);

        const totalUserVotes = votes?.length || 0;

        // Calculate majority alignment
        let majorityCount = 0;
        if (votes && results) {
          votes.forEach(v => {
            const r = resultsMap.get(v.poll_id);
            if (r) {
              const userPickedA = v.choice === 'A';
              const majorityIsA = r.percent_a >= 50;
              if (userPickedA === majorityIsA) majorityCount++;
            }
          });
        }

        const majorityPercent = totalUserVotes > 0 
          ? Math.round((majorityCount / totalUserVotes) * 100) 
          : 0;

        userStats = {
          totalVotes: totalUserVotes,
          majorityPercent,
          currentStreak: profile?.current_streak || 0,
          points: profile?.points || 0,
        };
      }

      return {
        trending: {
          mostVoted: mostVoted ? { ...mostVoted, type: 'most_voted' as const } : null,
          mostControversial: mostControversial ? { ...mostControversial, type: 'most_controversial' as const } : null,
        },
        userStats,
      };
    },
    enabled: true,
  });

  if (isLoading) {
    return (
      <div className="text-center mt-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-6 animate-slide-up">
      {/* Caught up header */}
      <div className="text-center space-y-2">
        <div className="text-5xl">🪞</div>
        <h2 className="text-2xl font-display font-bold">You've expressed your current dimensions.</h2>
        <p className="text-sm text-muted-foreground">New perspectives coming soon.</p>
      </div>

      {/* Trending Today */}
      {data?.trending && (data.trending.mostVoted || data.trending.mostControversial) && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Trending Today
          </h3>

          {data.trending.mostVoted && (
            <div className="glass rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">🔥 Most Voted</span>
                <span className="text-xs text-muted-foreground">{data.trending.mostVoted.totalVotes.toLocaleString()} votes</span>
              </div>
              <p className="font-medium text-sm mb-2">{data.trending.mostVoted.question}</p>
              <div className="flex gap-2 text-xs text-muted-foreground">
                <span>{data.trending.mostVoted.option_a} ({data.trending.mostVoted.percentA}%)</span>
                <span>vs</span>
                <span>{data.trending.mostVoted.option_b} ({data.trending.mostVoted.percentB}%)</span>
              </div>
            </div>
          )}

          {data.trending.mostControversial && data.trending.mostControversial.id !== data.trending.mostVoted?.id && (
            <div className="glass rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-warning/20 text-warning font-medium">⚡ Most Controversial</span>
                <span className="text-xs text-muted-foreground">{data.trending.mostControversial.totalVotes.toLocaleString()} votes</span>
              </div>
              <p className="font-medium text-sm mb-2">{data.trending.mostControversial.question}</p>
              <div className="flex gap-2 text-xs text-muted-foreground">
                <span>{data.trending.mostControversial.option_a} ({data.trending.mostControversial.percentA}%)</span>
                <span>vs</span>
                <span>{data.trending.mostControversial.option_b} ({data.trending.mostControversial.percentB}%)</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Your Voting Breakdown */}
      {data?.userStats && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Your Dimensions
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="glass rounded-2xl p-4 text-center">
              <div className="text-2xl font-bold">{data.userStats.majorityPercent}%</div>
              <div className="text-[11px] text-muted-foreground mt-1">Majority Alignment</div>
            </div>
            <div className="glass rounded-2xl p-4 text-center">
              <div className="text-2xl font-bold">{data.userStats.totalVotes}</div>
              <div className="text-[11px] text-muted-foreground mt-1">Perspectives Shared</div>
            </div>
            <div className="glass rounded-2xl p-4 text-center">
              <div className="text-2xl font-bold flex items-center justify-center gap-1">
                {data.userStats.currentStreak}
                {data.userStats.currentStreak > 0 && <Flame className="h-5 w-5 text-warning" />}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">Day Streak</div>
            </div>
            <div className="glass rounded-2xl p-4 text-center">
              <div className="text-2xl font-bold">{data.userStats.points}</div>
              <div className="text-[11px] text-muted-foreground mt-1">Insight Points</div>
            </div>
          </div>
        </div>
      )}

      {/* Progress indicator */}
      {data?.userStats && (
        <div className="text-center text-sm text-muted-foreground italic">
          You've shared {data.userStats.totalVotes} perspective{data.userStats.totalVotes !== 1 ? 's' : ''}.
        </div>
      )}

      {/* Message */}
      <div className="glass rounded-2xl p-4 text-center">
        <Target className="h-5 w-5 text-primary mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          Every choice reveals a dimension of who you are.
        </p>
      </div>

      {/* Refresh */}
      <button
        onClick={onRefresh}
        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold"
      >
        <RefreshCw className="h-4 w-4" />
        Explore More Perspectives
      </button>
    </div>
  );
}
