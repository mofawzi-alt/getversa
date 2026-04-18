import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Sparkles } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { attributeLabel } from '@/hooks/useCampaignFeedbackConfig';

interface Row {
  poll_id: string;
  question: string;
  attribute: string;
  total_responses: number;
  t2b_score: number;
  mean_score: number;
}

export default function CampaignAttributesTab({ campaignId }: { campaignId: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['campaign-attributes', campaignId],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase.rpc('get_campaign_attribute_scores', { p_campaign_id: campaignId });
      if (error) throw error;
      return (data || []) as Row[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-2">
        <Sparkles className="w-5 h-5 text-muted-foreground mx-auto" />
        <p className="text-sm font-semibold">No attribute data yet</p>
        <p className="text-xs text-muted-foreground">
          Enable attribute ratings in this campaign's feedback config to start collecting Top-2-Box scores.
        </p>
      </div>
    );
  }

  // Group by poll
  const byPoll = data.reduce<Record<string, { question: string; rows: Row[] }>>((acc, r) => {
    if (!acc[r.poll_id]) acc[r.poll_id] = { question: r.question, rows: [] };
    acc[r.poll_id].rows.push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-muted/40 p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          Top-2-Box Score
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          % of respondents who rated each attribute 4 or 5 (out of 5). Higher = stronger consumer perception.
        </p>
      </div>

      {Object.entries(byPoll).map(([pollId, { question, rows }]) => (
        <div key={pollId} className="rounded-xl border border-border p-4 space-y-3">
          <div className="text-sm font-semibold">{question}</div>
          <div className="text-[10px] text-muted-foreground">{rows[0]?.total_responses ?? 0} responses</div>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows.map((r) => ({ name: attributeLabel(r.attribute), T2B: r.t2b_score, Mean: r.mean_score }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="T2B" fill="hsl(217, 91%, 60%)" name="T2B %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {rows.map((r) => (
              <div key={r.attribute} className="rounded-md bg-muted/40 p-2">
                <div className="text-muted-foreground text-[10px] uppercase tracking-wide">{attributeLabel(r.attribute)}</div>
                <div className="font-semibold">{r.t2b_score}% T2B</div>
                <div className="text-[10px] text-muted-foreground">avg {r.mean_score}/5</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
