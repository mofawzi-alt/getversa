import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Sparkles, TrendingUp, AlertCircle, Coins, DollarSign } from 'lucide-react';

// Llama on Groq pricing (approx, USD per 1M tokens)
const COST_PER_QUERY: Record<string, number> = {
  simple: 0.00015,   // ~1.5K tokens @ Llama 3.1 8B
  medium: 0.0008,    // ~3K tokens @ Llama 3.3 70B
  complex: 0.002,    // ~8K tokens @ Llama 3.3 70B
};

export default function AskVersaAnalytics() {
  const { data, isLoading } = useQuery({
    queryKey: ['ask-versa-analytics', 30],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_ask_versa_analytics', { p_days: 30 });
      if (error) throw error;
      return data as any;
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!data) return null;

  const routeBreakdown = (data.route_breakdown || {}) as Record<string, number>;
  const topQuestions = (data.top_questions || []) as Array<{ question: string; count: number }>;
  const lowDataQuestions = (data.low_data_questions || []) as Array<{ question: string; count: number }>;
  const topCategories = (data.top_categories || []) as Array<{ category: string; count: number }>;

  // Estimated cost
  const estCost =
    (routeBreakdown.simple || 0) * COST_PER_QUERY.simple +
    (routeBreakdown.medium || 0) * COST_PER_QUERY.medium +
    (routeBreakdown.complex || 0) * COST_PER_QUERY.complex;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Ask Versa — last 30 days</h2>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Queries" value={data.total_queries ?? 0} />
        <Stat label="Answered" value={data.answered ?? 0} />
        <Stat label="Avg credits" value={data.avg_credits_per_query ?? 0} />
        <Stat label="Est. cost" value={`$${estCost.toFixed(2)}`} icon={<DollarSign className="h-3 w-3" />} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total credits spent" value={data.total_credits_spent ?? 0} icon={<Coins className="h-3 w-3" />} />
        <Stat label="Simple" value={routeBreakdown.simple ?? 0} />
        <Stat label="Medium" value={routeBreakdown.medium ?? 0} />
        <Stat label="Complex" value={routeBreakdown.complex ?? 0} />
      </div>

      {/* Top questions */}
      <Section title="Most asked questions" icon={<TrendingUp className="h-4 w-4" />}>
        {topQuestions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No questions yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {topQuestions.map((q, i) => (
              <li key={i} className="flex items-start justify-between gap-3 text-sm">
                <span className="text-foreground line-clamp-2 flex-1">{q.question}</span>
                <span className="font-bold text-muted-foreground shrink-0">{q.count}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Low data — content gap signals */}
      <Section title="Topics needing more polls (guardrail triggers)" icon={<AlertCircle className="h-4 w-4 text-destructive" />}>
        {lowDataQuestions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No guardrail triggers — coverage is healthy.</p>
        ) : (
          <ul className="space-y-1.5">
            {lowDataQuestions.map((q, i) => (
              <li key={i} className="flex items-start justify-between gap-3 text-sm">
                <span className="text-foreground line-clamp-2 flex-1">{q.question}</span>
                <span className="font-bold text-destructive shrink-0">{q.count}×</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Categories */}
      <Section title="Top categories asked about">
        {topCategories.length === 0 ? (
          <p className="text-xs text-muted-foreground">No category data yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {topCategories.map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-xs font-semibold">
                {c.category} <span className="text-muted-foreground">{c.count}</span>
              </span>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: number | string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-3 bg-card">
      <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1">
        {icon}{label}
      </p>
      <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border p-4 bg-card space-y-3">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">{icon}{title}</h3>
      {children}
    </div>
  );
}
