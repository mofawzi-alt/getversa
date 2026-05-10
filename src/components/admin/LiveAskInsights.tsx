import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import {
  Loader2, BarChart3, Users, Target, Clock, Sparkles, TrendingUp,
} from 'lucide-react';

interface LiveAskRow {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  status: string;
  vote_count: number;
  created_at: string;
  reveal_at: string;
  finalized_at: string | null;
  target_gender: string | null;
}

interface VoteRow {
  live_ask_id: string;
  voter_gender: string | null;
  voter_age_range: string | null;
  voter_country: string | null;
  taste_archetype: string | null;
  is_targeted_match: boolean;
  session_duration_ms: number | null;
  created_at: string;
}

const SINCE_DAYS = 30;

export default function LiveAskInsights() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-live-ask-insights', SINCE_DAYS],
    queryFn: async () => {
      const since = new Date(Date.now() - SINCE_DAYS * 24 * 3600 * 1000).toISOString();

      const [asksRes, votesRes] = await Promise.all([
        supabase
          .from('live_asks')
          .select('id, question, option_a, option_b, status, vote_count, created_at, reveal_at, finalized_at, target_gender')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(1000),
        supabase
          .from('live_ask_votes')
          .select('live_ask_id, voter_gender, voter_age_range, voter_country, taste_archetype, is_targeted_match, session_duration_ms, created_at')
          .gte('created_at', since)
          .limit(5000),
      ]);

      if (asksRes.error) throw asksRes.error;
      if (votesRes.error) throw votesRes.error;

      return {
        asks: (asksRes.data || []) as LiveAskRow[],
        votes: (votesRes.data || []) as VoteRow[],
      };
    },
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { asks, votes } = data;

  // ---- Top stats ----
  const totalAsks = asks.length;
  const finalizedCount = asks.filter((a) => a.status === 'finalized' || new Date(a.reveal_at) <= new Date()).length;
  const activeNow = asks.filter((a) => a.status === 'active' && new Date(a.reveal_at) > new Date()).length;
  const rejectedCount = asks.filter((a) => a.status === 'rejected').length;
  const totalVotes = votes.length;
  const avgVotesPerAsk = totalAsks > 0 ? totalVotes / totalAsks : 0;

  const decisionTimes = votes
    .map((v) => v.session_duration_ms)
    .filter((ms): ms is number => typeof ms === 'number' && ms > 0 && ms < 60_000);
  const avgDecisionMs = decisionTimes.length
    ? decisionTimes.reduce((a, b) => a + b, 0) / decisionTimes.length
    : 0;
  const medianDecisionMs = decisionTimes.length
    ? [...decisionTimes].sort((a, b) => a - b)[Math.floor(decisionTimes.length / 2)]
    : 0;

  // ---- Distributions ----
  const dist = (key: keyof VoteRow) => {
    const counts: Record<string, number> = {};
    votes.forEach((v) => {
      const raw = v[key];
      const k = (raw ?? 'unknown') as string;
      counts[k] = (counts[k] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  };

  const genderDist = dist('voter_gender');
  const ageDist = dist('voter_age_range');
  const countryDist = dist('voter_country').slice(0, 6);
  const archetypeDist = dist('taste_archetype').slice(0, 8);

  // ---- Targeting performance ----
  const targetedAsks = asks.filter((a) => a.target_gender);
  const targetedAskIds = new Set(targetedAsks.map((a) => a.id));
  const votesOnTargeted = votes.filter((v) => targetedAskIds.has(v.live_ask_id));
  const matchedCount = votesOnTargeted.filter((v) => v.is_targeted_match).length;
  const matchRate = votesOnTargeted.length > 0 ? (matchedCount / votesOnTargeted.length) * 100 : 0;

  // ---- Top questions by vote count ----
  const topAsks = [...asks]
    .filter((a) => a.status !== 'rejected')
    .sort((a, b) => b.vote_count - a.vote_count)
    .slice(0, 8);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Live Ask Insights</h2>
        <span className="ml-auto text-xs text-muted-foreground">Last {SINCE_DAYS} days</span>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Total asks" value={totalAsks} icon={Sparkles} />
        <Stat label="Finalized" value={finalizedCount} icon={TrendingUp} />
        <Stat label="Active now" value={activeNow} accent />
        <Stat label="Rejected" value={rejectedCount} muted />
        <Stat label="Total votes" value={totalVotes} icon={Users} />
        <Stat
          label="Votes / ask"
          value={avgVotesPerAsk.toFixed(1)}
        />
        <Stat
          label="Avg decision"
          value={`${(avgDecisionMs / 1000).toFixed(1)}s`}
          icon={Clock}
        />
        <Stat
          label="Median decision"
          value={`${(medianDecisionMs / 1000).toFixed(1)}s`}
        />
      </div>

      {/* Targeting */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold">Targeting performance</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Of votes cast on asks with audience targeting, how many came from a matching voter.
          </p>
          <div className="flex items-end gap-3 pt-1">
            <span className="text-3xl font-extrabold text-primary">{matchRate.toFixed(0)}%</span>
            <span className="text-xs text-muted-foreground pb-1">
              {matchedCount} / {votesOnTargeted.length} votes matched · {targetedAsks.length} targeted asks
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Demographics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <DistCard title="Voter gender" rows={genderDist} total={totalVotes} />
        <DistCard title="Voter age" rows={ageDist} total={totalVotes} />
        <DistCard title="Top countries" rows={countryDist} total={totalVotes} />
        <DistCard title="Taste archetypes" rows={archetypeDist} total={totalVotes} />
      </div>

      {/* Top questions */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-bold">Top questions by votes</h3>
          {topAsks.length === 0 && (
            <p className="text-xs text-muted-foreground">No data yet.</p>
          )}
          <div className="space-y-2">
            {topAsks.map((a) => (
              <div key={a.id} className="flex items-start gap-3 py-1.5 border-b border-border last:border-b-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-snug line-clamp-2">{a.question}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {a.option_a} <span className="opacity-50">vs</span> {a.option_b}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base font-extrabold text-primary leading-none">{a.vote_count}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">votes</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label, value, icon: Icon, accent, muted,
}: {
  label: string;
  value: string | number;
  icon?: any;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <Card className={accent ? 'border-primary/40' : ''}>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5">
          {Icon && <Icon className={`h-3.5 w-3.5 ${muted ? 'text-muted-foreground' : 'text-primary'}`} />}
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
        </div>
        <p className={`text-xl font-extrabold mt-0.5 ${muted ? 'text-muted-foreground' : ''}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function DistCard({
  title, rows, total,
}: {
  title: string;
  rows: [string, number][];
  total: number;
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <h3 className="text-sm font-bold">{title}</h3>
        {rows.length === 0 && (
          <p className="text-xs text-muted-foreground">No data yet.</p>
        )}
        <div className="space-y-1.5">
          {rows.map(([key, count]) => {
            const pct = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={key} className="space-y-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium capitalize">{key}</span>
                  <span className="text-muted-foreground">
                    {count} <span className="opacity-60">· {pct.toFixed(0)}%</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
