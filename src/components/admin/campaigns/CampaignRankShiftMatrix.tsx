import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowUp, ArrowDown, Minus, TrendingUp } from 'lucide-react';

interface Row {
  poll_id: string;
  question: string;
  segment_type: string;
  segment_value: string;
  total_in_segment: number;
  pct_a: number;
  baseline_pct_a: number;
  delta: number;
  significant: boolean;
}

export default function CampaignRankShiftMatrix({ campaignId }: { campaignId: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['campaign-rank-matrix', campaignId],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase.rpc('get_campaign_rank_matrix', { p_campaign_id: campaignId });
      if (error) throw error;
      return (data || []) as Row[];
    },
  });

  // Group by poll → segment_type
  const grouped = useMemo(() => {
    const acc: Record<string, { question: string; types: Record<string, Row[]> }> = {};
    data.forEach((r) => {
      if (!acc[r.poll_id]) acc[r.poll_id] = { question: r.question, types: {} };
      if (!acc[r.poll_id].types[r.segment_type]) acc[r.poll_id].types[r.segment_type] = [];
      acc[r.poll_id].types[r.segment_type].push(r);
    });
    return acc;
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (Object.keys(grouped).length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-muted/40 p-3 flex items-start gap-2">
        <TrendingUp className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Rank-Shift Matrix
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
            How each demographic segment shifts vs the campaign-wide baseline. Stars (★) mark statistically significant deviations at 90% confidence.
          </p>
        </div>
      </div>

      {Object.entries(grouped).map(([pollId, { question, types }]) => (
        <div key={pollId} className="rounded-xl border border-border p-3 space-y-3">
          <div className="text-sm font-semibold line-clamp-2">{question}</div>
          {Object.entries(types).map(([type, rows]) => (
            <div key={type} className="space-y-1">
              <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
                {type}
              </div>
              <div className="overflow-x-auto -mx-3 px-3">
                <table className="text-xs w-full min-w-[400px]">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="text-left py-1 pr-2 font-medium">Segment</th>
                      <th className="text-right py-1 px-2 font-medium">N</th>
                      <th className="text-right py-1 px-2 font-medium">% A</th>
                      <th className="text-right py-1 px-2 font-medium">vs base</th>
                      <th className="text-center py-1 pl-2 font-medium">Sig</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 8).map((r, i) => {
                      const arrow = r.delta > 0 ? <ArrowUp className="w-3 h-3 inline" /> : r.delta < 0 ? <ArrowDown className="w-3 h-3 inline" /> : <Minus className="w-3 h-3 inline" />;
                      const color = r.delta > 0 ? 'text-green-600' : r.delta < 0 ? 'text-blue-600' : 'text-muted-foreground';
                      return (
                        <tr key={i} className="border-b border-border/50 last:border-0">
                          <td className="py-1.5 pr-2 truncate max-w-[120px]">{r.segment_value}</td>
                          <td className="py-1.5 px-2 text-right text-muted-foreground">{r.total_in_segment}</td>
                          <td className="py-1.5 px-2 text-right font-semibold">{r.pct_a}%</td>
                          <td className={`py-1.5 px-2 text-right ${color}`}>
                            {arrow} {Math.abs(r.delta)}pt
                          </td>
                          <td className="py-1.5 pl-2 text-center">
                            {r.significant ? <span className="text-amber-500 font-bold">★</span> : <span className="text-muted-foreground/40">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
