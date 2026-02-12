import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Flame, RefreshCw, Users } from 'lucide-react';
import { Loader2 } from 'lucide-react';

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'lifestyle', label: 'Lifestyle' },
  { key: 'food', label: 'Food' },
  { key: 'culture', label: 'Culture' },
  { key: 'fashion', label: 'Fashion' },
  { key: 'tech', label: 'Tech' },
  { key: 'travel', label: 'Travel' },
];

interface TrendingInsight {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  totalVotes: number;
  percentA: number;
  percentB: number;
  category: string | null;
  image_a_url: string | null;
  image_b_url: string | null;
}

export default function CaughtUpInsights({ onRefresh }: { onRefresh: () => void }) {
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState('all');

  const { data: insights, isLoading } = useQuery({
    queryKey: ['trending-insights', user?.id],
    queryFn: async () => {
      const { data: polls } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, category, image_a_url, image_b_url, created_at')
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
            category: p.category,
            image_a_url: p.image_a_url,
            image_b_url: p.image_b_url,
            totalVotes: (r?.total_votes as number) || 0,
            percentA: (r?.percent_a as number) || 0,
            percentB: (r?.percent_b as number) || 0,
          };
        })
        .filter(p => p.totalVotes > 0)
        .sort((a, b) => b.totalVotes - a.totalVotes)
        .slice(0, 15);
    },
    staleTime: 1000 * 60 * 60,
  });

  const filtered = insights?.filter(i =>
    activeCategory === 'all' || (i.category?.toLowerCase() === activeCategory)
  );

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
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Explore More Perspectives
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4 w-full animate-fade-in">
      {/* Caught-up message */}
      <div className="text-center space-y-1">
        <div className="text-3xl">✨</div>
        <h2 className="text-lg font-display font-bold">You've explored your current dimensions.</h2>
        <p className="text-sm text-muted-foreground">Discover more perspectives below.</p>
      </div>

      {/* Header */}
      <div className="flex items-center gap-2">
        <Flame className="h-5 w-5 text-destructive" />
        <h2 className="text-lg font-display font-bold">Trending Insights</h2>
      </div>

      {/* Category Chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              activeCategory === cat.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Insight cards */}
      <div className="space-y-3">
        {filtered && filtered.length > 0 ? (
          filtered.map((insight, i) => {
            const winnerIsA = insight.percentA >= insight.percentB;
            return (
              <div
                key={insight.id}
                className="rounded-2xl bg-card border border-border overflow-hidden animate-fade-in"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                {/* Images row */}
                {(insight.image_a_url || insight.image_b_url) && (
                  <div className="flex h-32">
                    <div className="w-1/2 h-full relative overflow-hidden">
                      {insight.image_a_url ? (
                        <img src={insight.image_a_url} alt={insight.option_a} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">{insight.option_a}</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <span className="absolute bottom-1.5 left-2 text-[11px] font-bold text-white drop-shadow-lg">{insight.option_a}</span>
                    </div>
                    <div className="w-px bg-border shrink-0" />
                    <div className="w-1/2 h-full relative overflow-hidden">
                      {insight.image_b_url ? (
                        <img src={insight.image_b_url} alt={insight.option_b} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">{insight.option_b}</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <span className="absolute bottom-1.5 right-2 text-[11px] font-bold text-white drop-shadow-lg text-right">{insight.option_b}</span>
                    </div>
                  </div>
                )}

                {/* Results */}
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-bold leading-snug text-foreground flex-1">
                      {insight.question}
                    </p>
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground whitespace-nowrap shrink-0 pt-0.5">
                      <Users className="h-3 w-3" />
                      {insight.totalVotes.toLocaleString()}
                    </span>
                  </div>

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

                  <div className="flex justify-between text-xs">
                    <span className={winnerIsA ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                      {insight.option_a} ({insight.percentA}%)
                    </span>
                    <span className={!winnerIsA ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                      {insight.option_b} ({insight.percentB}%)
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-6 text-sm text-muted-foreground">
            No insights in this category yet.
          </div>
        )}
      </div>

      {/* Primary CTA */}
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
