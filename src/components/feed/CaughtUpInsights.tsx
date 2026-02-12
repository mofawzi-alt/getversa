import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Flame, RefreshCw, TrendingUp, Zap, Users } from 'lucide-react';
import { Loader2 } from 'lucide-react';

interface TrendingInsight {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  totalVotes: number;
  percentA: number;
  percentB: number;
  badge: 'hottest' | 'controversial' | 'rising' | null;
}

function getBadge(insight: TrendingInsight) {
  if (insight.badge === 'hottest') return { icon: Flame, label: 'Hottest', class: 'bg-destructive/15 text-destructive' };
  if (insight.badge === 'controversial') return { icon: Zap, label: 'Split Decision', class: 'bg-warning/15 text-warning' };
  if (insight.badge === 'rising') return { icon: TrendingUp, label: 'Rising', class: 'bg-accent/15 text-accent' };
  return null;
}

export default function CaughtUpInsights({ onRefresh }: { onRefresh: () => void }) {
  const { user } = useAuth();
  const [activeIndex, setActiveIndex] = useState(0);

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

      const pollsWithResults = polls.map(p => {
        const r = resultsMap.get(p.id);
        return {
          ...p,
          totalVotes: (r?.total_votes as number) || 0,
          percentA: (r?.percent_a as number) || 0,
          percentB: (r?.percent_b as number) || 0,
        };
      }).filter(p => p.totalVotes > 0);

      // Sort by votes to find hottest
      const byVotes = [...pollsWithResults].sort((a, b) => b.totalVotes - a.totalVotes);
      // Find most controversial (closest to 50/50)
      const byControversy = [...pollsWithResults]
        .filter(p => p.totalVotes >= 3)
        .sort((a, b) => Math.abs(a.percentA - 50) - Math.abs(b.percentA - 50));
      // Find rising (newest with decent engagement)
      const rising = [...pollsWithResults]
        .filter(p => p.totalVotes >= 2)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const selected = new Map<string, TrendingInsight>();

      // Pick hottest
      if (byVotes[0]) {
        selected.set(byVotes[0].id, { ...byVotes[0], badge: 'hottest' });
      }
      // Pick controversial
      for (const p of byControversy) {
        if (!selected.has(p.id)) {
          selected.set(p.id, { ...p, badge: 'controversial' });
          break;
        }
      }
      // Fill remaining with rising/popular
      for (const p of rising) {
        if (selected.size >= 5) break;
        if (!selected.has(p.id)) {
          selected.set(p.id, { ...p, badge: selected.size < 3 ? 'rising' : null });
        }
      }
      // Fill more from byVotes if needed
      for (const p of byVotes) {
        if (selected.size >= 5) break;
        if (!selected.has(p.id)) {
          selected.set(p.id, { ...p, badge: null });
        }
      }

      return [...selected.values()];
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour (daily refresh feel)
  });

  // Auto-rotate active card every 4s
  useEffect(() => {
    if (!insights || insights.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % insights.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [insights]);

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

  const featured = insights[activeIndex];
  const featuredBadge = getBadge(featured);
  const winnerIsA = featured.percentA >= featured.percentB;

  return (
    <div className="space-y-5 mt-4 w-full animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-display font-bold flex items-center gap-2">
          <Flame className="h-5 w-5 text-destructive" />
          Trending Insights
        </h2>
        <button
          onClick={onRefresh}
          className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
          aria-label="Refresh feed"
        >
          <RefreshCw className="h-4 w-4 text-foreground/70" />
        </button>
      </div>

      {/* Featured insight card — hero style */}
      <div
        key={featured.id}
        className="relative rounded-2xl overflow-hidden bg-card border border-border shadow-card animate-scale-in"
      >
        {/* Gradient accent bar */}
        <div className="h-1 bg-gradient-to-r from-primary via-accent to-warning" />

        <div className="p-5 space-y-4">
          {/* Badge + vote count */}
          <div className="flex items-center justify-between">
            {featuredBadge ? (
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${featuredBadge.class}`}>
                <featuredBadge.icon className="h-3.5 w-3.5" />
                {featuredBadge.label}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Insight</span>
            )}
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              {featured.totalVotes.toLocaleString()}
            </span>
          </div>

          {/* Question */}
          <p className="text-base font-bold leading-snug text-foreground">
            {featured.question}
          </p>

          {/* Result bar */}
          <div className="space-y-2">
            <div className="flex h-3 rounded-full overflow-hidden bg-muted/50">
              <div
                className="bg-option-a rounded-l-full transition-all duration-700 ease-out"
                style={{ width: `${featured.percentA}%` }}
              />
              <div
                className="bg-option-b rounded-r-full transition-all duration-700 ease-out"
                style={{ width: `${featured.percentB}%` }}
              />
            </div>
            <div className="flex justify-between text-sm">
              <span className={`font-semibold ${winnerIsA ? 'text-foreground' : 'text-muted-foreground'}`}>
                {featured.option_a} <span className="text-xs font-normal">({featured.percentA}%)</span>
              </span>
              <span className={`font-semibold ${!winnerIsA ? 'text-foreground' : 'text-muted-foreground'}`}>
                {featured.option_b} <span className="text-xs font-normal">({featured.percentB}%)</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Dot indicators */}
      {insights.length > 1 && (
        <div className="flex justify-center gap-1.5">
          {insights.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === activeIndex
                  ? 'w-6 bg-primary'
                  : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50'
              }`}
              aria-label={`View insight ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Mini cards grid — remaining insights */}
      {insights.length > 1 && (
        <div className="grid grid-cols-2 gap-2">
          {insights
            .filter((_, i) => i !== activeIndex)
            .slice(0, 4)
            .map((insight) => {
              const badge = getBadge(insight);
              const isA = insight.percentA >= insight.percentB;
              return (
                <button
                  key={insight.id}
                  onClick={() => setActiveIndex(insights.indexOf(insight))}
                  className="glass rounded-xl p-3 text-left hover:ring-1 hover:ring-primary/30 transition-all group"
                >
                  {badge && (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full mb-1.5 ${badge.class}`}>
                      <badge.icon className="h-2.5 w-2.5" />
                      {badge.label}
                    </span>
                  )}
                  <p className="text-xs font-semibold text-foreground leading-tight line-clamp-2 mb-2">
                    {insight.question}
                  </p>
                  <div className="flex h-1.5 rounded-full overflow-hidden bg-muted/50 mb-1">
                    <div className="bg-option-a" style={{ width: `${insight.percentA}%` }} />
                    <div className="bg-option-b" style={{ width: `${insight.percentB}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{insight.percentA}% – {insight.percentB}%</span>
                    <span>{insight.totalVotes.toLocaleString()}</span>
                  </div>
                </button>
              );
            })}
        </div>
      )}

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
