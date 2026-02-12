import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Flame, RefreshCw, Users, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

interface TrendingInsight {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  totalVotes: number;
  percentA: number;
  percentB: number;
}

export default function CaughtUpInsights({ onRefresh }: { onRefresh: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: insights, isLoading } = useQuery({
    queryKey: ['trending-insights', user?.id],
    queryFn: async () => {
      const { data: polls } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!polls || polls.length === 0) return [];

      const pollIds = polls.map(p => p.id);
      const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: pollIds });

      const resultsMap = new Map(
        results?.map((r: any) => [r.poll_id, r]) || []
      );

      return polls
        .map(p => {
          const r = resultsMap.get(p.id);
          return {
            id: p.id,
            question: p.question,
            option_a: p.option_a,
            option_b: p.option_b,
            totalVotes: (r?.total_votes as number) || 0,
            percentA: (r?.percent_a as number) || 0,
            percentB: (r?.percent_b as number) || 0,
          };
        })
        .filter(p => p.totalVotes > 0)
        .sort((a, b) => b.totalVotes - a.totalVotes)
        .slice(0, 5);
    },
    staleTime: 1000 * 60 * 60,
  });

  if (isLoading) {
    return (
      <div className="text-center mt-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
      </div>
    );
  }

  if (!insights || insights.length === 0) {
    return (
      <div className="space-y-6 mt-6 animate-fade-in">
        <div className="text-center space-y-2">
          <div className="text-4xl">✨</div>
          <h2 className="text-xl font-display font-bold">No insights yet</h2>
          <p className="text-sm text-muted-foreground">Check back soon for trending perspectives.</p>
        </div>
        <button
          onClick={onRefresh}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4 w-full animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Flame className="h-5 w-5 text-destructive" />
        <h2 className="text-lg font-display font-bold">Trending Insights</h2>
      </div>

      {/* Read-only insight cards */}
      <div className="space-y-3">
        {insights.map((insight, i) => {
          const winnerIsA = insight.percentA >= insight.percentB;
          return (
            <div
              key={insight.id}
              className="rounded-2xl bg-card border border-border p-4 space-y-3 animate-fade-in"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {/* Question + vote count */}
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-bold leading-snug text-foreground flex-1">
                  {insight.question}
                </p>
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground whitespace-nowrap shrink-0 pt-0.5">
                  <Users className="h-3 w-3" />
                  {insight.totalVotes.toLocaleString()}
                </span>
              </div>

              {/* Result bar */}
              <div className="flex h-2 rounded-full overflow-hidden bg-muted/50">
                <div
                  className="bg-option-a rounded-l-full"
                  style={{ width: `${insight.percentA}%` }}
                />
                <div
                  className="bg-option-b rounded-r-full"
                  style={{ width: `${insight.percentB}%` }}
                />
              </div>

              {/* Labels */}
              <div className="flex justify-between text-xs">
                <span className={winnerIsA ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                  {insight.option_a} ({insight.percentA}%)
                </span>
                <span className={!winnerIsA ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                  {insight.option_b} ({insight.percentB}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Archive link */}
      <button
        onClick={() => navigate('/archive')}
        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
      >
        <Clock className="h-4 w-4" />
        Past Perspectives
      </button>

      {/* Refresh CTA */}
      <button
        onClick={onRefresh}
        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
      >
        <RefreshCw className="h-4 w-4" />
        Explore More Perspectives
      </button>
    </div>
  );
}
