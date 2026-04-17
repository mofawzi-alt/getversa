import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BarChart3, Loader2, Users, Globe, Calendar } from 'lucide-react';

interface Props {
  campaignId: string;
  campaignName: string;
  brandName?: string | null;
}

export default function CampaignAnalyticsDialog({ campaignId, campaignName, brandName }: Props) {
  const [open, setOpen] = useState(false);

  const { data: results, isLoading: loadingResults } = useQuery({
    queryKey: ['campaign-analytics', campaignId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_campaign_analytics', { p_campaign_id: campaignId });
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const { data: demographics, isLoading: loadingDemo } = useQuery({
    queryKey: ['campaign-demographics', campaignId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_campaign_demographics', { p_campaign_id: campaignId });
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const totalVotes = (results || []).reduce((sum: number, r: any) => sum + (r.total_votes || 0), 0);

  // Group demographics by segment type
  const grouped = (demographics || []).reduce((acc: any, row: any) => {
    const key = row.segment_type;
    if (!acc[key]) acc[key] = {};
    const seg = row.segment_value || 'Unknown';
    if (!acc[key][seg]) acc[key][seg] = { A: 0, B: 0 };
    acc[key][seg][row.choice] = (acc[key][seg][row.choice] || 0) + row.vote_count;
    return acc;
  }, {});

  const segmentIcon = (type: string) => {
    if (type === 'age_range') return <Calendar className="w-3.5 h-3.5" />;
    if (type === 'gender') return <Users className="w-3.5 h-3.5" />;
    if (type === 'country' || type === 'city') return <Globe className="w-3.5 h-3.5" />;
    return <BarChart3 className="w-3.5 h-3.5" />;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <BarChart3 className="w-4 h-4" />
          <span className="hidden sm:inline">Analytics</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-left">
            {campaignName}
            {brandName && <div className="text-xs font-normal text-muted-foreground mt-1">{brandName}</div>}
          </DialogTitle>
        </DialogHeader>

        {loadingResults ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !results || results.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No poll data yet.</p>
        ) : (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/40 p-3">
                <div className="text-xs text-muted-foreground">Polls</div>
                <div className="text-2xl font-bold">{results.length}</div>
              </div>
              <div className="rounded-xl bg-muted/40 p-3">
                <div className="text-xs text-muted-foreground">Total votes</div>
                <div className="text-2xl font-bold">{totalVotes.toLocaleString()}</div>
              </div>
            </div>

            {/* Per-poll results */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Results per poll</h4>
              {results.map((r: any) => {
                const winner = r.percent_a >= r.percent_b ? 'A' : 'B';
                return (
                  <div key={r.poll_id} className="rounded-xl border border-border p-3 space-y-2">
                    <div className="text-sm font-semibold">{r.question}</div>
                    <div className="text-xs text-muted-foreground">{r.total_votes} votes</div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs w-20 truncate">{r.option_a}</span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${winner === 'A' ? 'bg-green-500' : 'bg-blue-500'}`}
                            style={{ width: `${r.percent_a}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold w-12 text-right">{r.percent_a}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs w-20 truncate">{r.option_b}</span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${winner === 'B' ? 'bg-green-500' : 'bg-blue-500'}`}
                            style={{ width: `${r.percent_b}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold w-12 text-right">{r.percent_b}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Demographics */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Demographics (combined across polls)</h4>
              {loadingDemo ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : Object.keys(grouped).length === 0 ? (
                <p className="text-xs text-muted-foreground">No demographic data yet.</p>
              ) : (
                Object.entries(grouped).map(([type, segments]: [string, any]) => (
                  <div key={type} className="rounded-xl bg-muted/30 p-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      {segmentIcon(type)}
                      {type.replace('_', ' ')}
                    </div>
                    <div className="space-y-1.5">
                      {Object.entries(segments).map(([seg, counts]: [string, any]) => {
                        const total = (counts.A || 0) + (counts.B || 0);
                        const pctA = total ? Math.round(((counts.A || 0) / total) * 100) : 0;
                        return (
                          <div key={seg} className="flex items-center gap-2 text-xs">
                            <span className="w-24 truncate">{seg}</span>
                            <div className="flex-1 h-1.5 bg-background rounded-full overflow-hidden flex">
                              <div className="bg-green-500" style={{ width: `${pctA}%` }} />
                              <div className="bg-blue-500 flex-1" />
                            </div>
                            <span className="w-20 text-right text-muted-foreground">
                              {pctA}% / {100 - pctA}% · {total}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
