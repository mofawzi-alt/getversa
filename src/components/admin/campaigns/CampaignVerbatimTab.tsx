import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Quote, MessageSquare } from 'lucide-react';

interface Row {
  poll_id: string;
  question: string;
  choice: 'A' | 'B';
  option_label: string;
  feedback: string;
  voter_gender: string | null;
  voter_age_range: string | null;
  voter_city: string | null;
  created_at: string;
}

export default function CampaignVerbatimTab({ campaignId }: { campaignId: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['campaign-verbatim', campaignId],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase.rpc('get_campaign_verbatims', {
        p_campaign_id: campaignId,
        p_limit_per_poll: 25,
      });
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
        <MessageSquare className="w-5 h-5 text-muted-foreground mx-auto" />
        <p className="text-sm font-semibold">No verbatim feedback yet</p>
        <p className="text-xs text-muted-foreground">
          Enable verbatim collection in this campaign's feedback config to gather consumer quotes.
        </p>
      </div>
    );
  }

  // Group by poll, then by choice
  const byPoll = data.reduce<Record<string, { question: string; A: Row[]; B: Row[] }>>((acc, r) => {
    if (!acc[r.poll_id]) acc[r.poll_id] = { question: r.question, A: [], B: [] };
    acc[r.poll_id][r.choice].push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(byPoll).map(([pollId, { question, A, B }]) => (
        <div key={pollId} className="rounded-xl border border-border p-4 space-y-3">
          <div className="text-sm font-semibold">{question}</div>
          <div className="grid sm:grid-cols-2 gap-3">
            {(['A', 'B'] as const).map((c) => {
              const list = c === 'A' ? A : B;
              if (list.length === 0) return (
                <div key={c} className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
                  No quotes for {list[0]?.option_label || `Option ${c}`} yet.
                </div>
              );
              return (
                <div key={c} className={`rounded-lg p-3 ${c === 'A' ? 'bg-green-500/5 border border-green-500/20' : 'bg-blue-500/5 border border-blue-500/20'}`}>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 font-semibold">
                    {list[0].option_label} · {list.length} quotes
                  </div>
                  <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                    {list.map((r, i) => (
                      <div key={i} className="text-xs leading-relaxed">
                        <Quote className="w-3 h-3 inline -mt-0.5 mr-1 text-muted-foreground" />
                        <span>{r.feedback}</span>
                        {(r.voter_gender || r.voter_age_range || r.voter_city) && (
                          <div className="text-[10px] text-muted-foreground mt-0.5 ml-4">
                            {[r.voter_gender, r.voter_age_range, r.voter_city].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
