import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, BarChart3, Users, Globe, Calendar, Sparkles, TrendingUp, ChevronRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import PollAnalytics from '@/components/admin/PollAnalytics';
import { exportCampaignPdf } from './exportCampaignPdf';

interface Props {
  campaignId: string;
  campaignName: string;
  brandName?: string | null;
}

interface PollResult {
  poll_id: string;
  question: string;
  option_a: string;
  option_b: string;
  total_votes: number;
  votes_a: number;
  votes_b: number;
  percent_a: number;
  percent_b: number;
}

interface DemoRow {
  segment_type: string;
  segment_value: string;
  choice: string;
  vote_count: number;
}

export default function CampaignDetailView({ campaignId, campaignName, brandName }: Props) {
  const [drilldownPollId, setDrilldownPollId] = useState<string | null>(null);

  const { data: results = [], isLoading: loadingResults } = useQuery({
    queryKey: ['campaign-analytics', campaignId],
    queryFn: async (): Promise<PollResult[]> => {
      const { data, error } = await supabase.rpc('get_campaign_analytics', { p_campaign_id: campaignId });
      if (error) throw error;
      return (data || []) as PollResult[];
    },
  });

  const { data: demos = [], isLoading: loadingDemo } = useQuery({
    queryKey: ['campaign-demographics', campaignId],
    queryFn: async (): Promise<DemoRow[]> => {
      const { data, error } = await supabase.rpc('get_campaign_demographics', { p_campaign_id: campaignId });
      if (error) throw error;
      return (data || []) as DemoRow[];
    },
  });

  const totalVotes = useMemo(() => results.reduce((s, r) => s + Number(r.total_votes || 0), 0), [results]);
  const avgPerPoll = results.length > 0 ? Math.round(totalVotes / results.length) : 0;
  const topPoll = useMemo(() => [...results].sort((a, b) => b.total_votes - a.total_votes)[0], [results]);

  if (loadingResults) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!results || results.length === 0) {
    return <p className="text-sm text-muted-foreground py-12 text-center">No poll data yet.</p>;
  }

  const handleExport = () => {
    try {
      exportCampaignPdf({ campaignName, brandName, results, demos });
      toast.success('Report downloaded');
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate PDF');
    }
  };

  return (
    <Tabs defaultValue="overview" className="w-full">
      <div className="flex items-center gap-2 mb-2">
        <TabsList className="grid grid-cols-4 flex-1">
          <TabsTrigger value="overview" className="text-xs gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="polls" className="text-xs gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Polls</span>
          </TabsTrigger>
          <TabsTrigger value="demographics" className="text-xs gap-1.5">
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Demographics</span>
          </TabsTrigger>
          <TabsTrigger value="narrative" className="text-xs gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">AI Insights</span>
          </TabsTrigger>
        </TabsList>
        <Button size="sm" variant="outline" onClick={handleExport} className="gap-1.5 shrink-0 h-9">
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">PDF</span>
        </Button>
      </div>

      {/* OVERVIEW */}
      <TabsContent value="overview" className="space-y-4 mt-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Polls" value={results.length} />
          <KpiCard label="Total votes" value={totalVotes.toLocaleString()} />
          <KpiCard label="Avg / poll" value={avgPerPoll.toLocaleString()} />
          <KpiCard label="Top vote count" value={(topPoll?.total_votes ?? 0).toLocaleString()} />
        </div>

        {topPoll && (
          <div className="rounded-xl border border-border p-4 bg-muted/30">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Top performing poll
            </div>
            <div className="text-sm font-semibold mb-2">{topPoll.question}</div>
            <ResultBar
              optionA={topPoll.option_a}
              optionB={topPoll.option_b}
              percentA={topPoll.percent_a}
              percentB={topPoll.percent_b}
            />
          </div>
        )}

        <div className="rounded-xl border border-border p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Quick winner snapshot
          </div>
          <div className="space-y-2">
            {results.map((r) => {
              const winner = r.percent_a >= r.percent_b ? r.option_a : r.option_b;
              const margin = Math.abs(r.percent_a - r.percent_b);
              return (
                <div key={r.poll_id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate flex-1 text-muted-foreground">{r.question}</span>
                  <span className="font-semibold">{winner}</span>
                  <span className="text-xs text-muted-foreground w-16 text-right">+{margin}pt</span>
                </div>
              );
            })}
          </div>
        </div>
      </TabsContent>

      {/* POLLS */}
      <TabsContent value="polls" className="space-y-3 mt-4">
        {drilldownPollId ? (
          <div className="space-y-3">
            <button
              onClick={() => setDrilldownPollId(null)}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              ← Back to all polls
            </button>
            <div className="border-t border-border pt-3">
              <PollAnalytics initialPollId={drilldownPollId} />
            </div>
          </div>
        ) : (
          results.map((r) => {
            const winner = r.percent_a >= r.percent_b ? 'A' : 'B';
            return (
              <button
                key={r.poll_id}
                onClick={() => setDrilldownPollId(r.poll_id)}
                className="w-full text-left rounded-xl border border-border p-3 space-y-2 hover:bg-muted/40 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-semibold flex-1">{r.question}</div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                </div>
                <div className="text-xs text-muted-foreground">{r.total_votes} votes</div>
                <ResultBar
                  optionA={r.option_a}
                  optionB={r.option_b}
                  percentA={r.percent_a}
                  percentB={r.percent_b}
                  winner={winner}
                />
              </button>
            );
          })
        )}
      </TabsContent>

      {/* DEMOGRAPHICS */}
      <TabsContent value="demographics" className="space-y-3 mt-4">
        {loadingDemo ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <DemographicsView demos={demos} />
        )}
      </TabsContent>

      {/* NARRATIVE (placeholder until edge function is added) */}
      <TabsContent value="narrative" className="mt-4">
        <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-2">
          <Sparkles className="w-6 h-6 text-muted-foreground mx-auto" />
          <p className="text-sm font-semibold">AI Narrative coming soon</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            We'll generate a written summary of what this campaign revealed, demographic surprises, and recommended next moves.
          </p>
        </div>
      </TabsContent>
    </Tabs>
  );
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-0.5">{value}</div>
    </div>
  );
}

function ResultBar({
  optionA,
  optionB,
  percentA,
  percentB,
  winner,
}: {
  optionA: string;
  optionB: string;
  percentA: number;
  percentB: number;
  winner?: 'A' | 'B';
}) {
  const w = winner ?? (percentA >= percentB ? 'A' : 'B');
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs w-20 truncate">{optionA}</span>
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full ${w === 'A' ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${percentA}%` }}
          />
        </div>
        <span className="text-xs font-semibold w-12 text-right">{percentA}%</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs w-20 truncate">{optionB}</span>
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full ${w === 'B' ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${percentB}%` }}
          />
        </div>
        <span className="text-xs font-semibold w-12 text-right">{percentB}%</span>
      </div>
    </div>
  );
}

function DemographicsView({ demos }: { demos: DemoRow[] }) {
  const grouped = useMemo(() => {
    const acc: Record<string, Record<string, { A: number; B: number }>> = {};
    demos.forEach((row) => {
      const key = row.segment_type;
      if (!acc[key]) acc[key] = {};
      const seg = row.segment_value || 'Unknown';
      if (!acc[key][seg]) acc[key][seg] = { A: 0, B: 0 };
      acc[key][seg][row.choice as 'A' | 'B'] = (acc[key][seg][row.choice as 'A' | 'B'] || 0) + Number(row.vote_count);
    });
    return acc;
  }, [demos]);

  const segmentIcon = (type: string) => {
    if (type === 'age' || type === 'age_range') return <Calendar className="w-3.5 h-3.5" />;
    if (type === 'gender') return <Users className="w-3.5 h-3.5" />;
    if (type === 'country' || type === 'city') return <Globe className="w-3.5 h-3.5" />;
    return <BarChart3 className="w-3.5 h-3.5" />;
  };

  if (Object.keys(grouped).length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No demographic data yet.</p>;
  }

  return (
    <>
      {Object.entries(grouped).map(([type, segments]) => (
        <div key={type} className="rounded-xl bg-muted/30 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            {segmentIcon(type)}
            {type.replace('_', ' ')}
          </div>
          <div className="space-y-1.5">
            {Object.entries(segments)
              .sort((a, b) => b[1].A + b[1].B - (a[1].A + a[1].B))
              .map(([seg, counts]) => {
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
      ))}
    </>
  );
}
