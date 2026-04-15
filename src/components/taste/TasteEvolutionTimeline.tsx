import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { motion } from 'framer-motion';

interface Snapshot {
  snapshot_date: string;
  majority_pct: number | null;
  minority_pct: number | null;
  top_trait: string | null;
  archetype: string | null;
  adventure_score: number | null;
  brand_loyalty_score: number | null;
  total_votes: number;
}

export default function TasteEvolutionTimeline() {
  const { profile } = useAuth();

  const { data: snapshots = [], isLoading } = useQuery({
    queryKey: ['taste-evolution', profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data, error } = await supabase
        .from('taste_snapshots')
        .select('*')
        .eq('user_id', profile.id)
        .order('snapshot_date', { ascending: false })
        .limit(12);

      if (error) return [];
      return (data || []) as unknown as Snapshot[];
    },
    enabled: !!profile,
  });

  if (isLoading || snapshots.length < 2) return null;

  const latest = snapshots[0];
  const previous = snapshots[1];

  const majorityDelta = (latest.majority_pct ?? 0) - (previous.majority_pct ?? 0);
  const adventureDelta = (latest.adventure_score ?? 0) - (previous.adventure_score ?? 0);

  const TrendIcon = ({ delta }: { delta: number }) => {
    if (delta > 2) return <TrendingUp className="h-3 w-3 text-primary" />;
    if (delta < -2) return <TrendingDown className="h-3 w-3 text-destructive" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  const maxVotes = Math.max(...snapshots.map(s => s.total_votes || 1));

  return (
    <div className="space-y-4">
      {/* Summary deltas */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-card border border-border/60">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendIcon delta={majorityDelta} />
            <span className="text-[10px] font-semibold text-muted-foreground">Majority Alignment</span>
          </div>
          <p className="text-lg font-bold text-foreground">{latest.majority_pct ?? 0}%</p>
          <p className={`text-[10px] font-semibold ${majorityDelta > 0 ? 'text-primary' : majorityDelta < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
            {majorityDelta > 0 ? '+' : ''}{majorityDelta}% vs last week
          </p>
        </div>

        <div className="p-3 rounded-xl bg-card border border-border/60">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendIcon delta={adventureDelta} />
            <span className="text-[10px] font-semibold text-muted-foreground">Adventure Score</span>
          </div>
          <p className="text-lg font-bold text-foreground">{latest.adventure_score ?? 0}%</p>
          <p className={`text-[10px] font-semibold ${adventureDelta > 0 ? 'text-primary' : adventureDelta < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
            {adventureDelta > 0 ? '+' : ''}{adventureDelta}% vs last week
          </p>
        </div>
      </div>

      {/* Visual timeline */}
      <div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Your Journey</p>
        <div className="space-y-2">
          {snapshots.slice(0, 8).map((snap, i) => {
            const weekLabel = new Date(snap.snapshot_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const barWidth = maxVotes > 0 ? Math.max(10, ((snap.total_votes || 0) / maxVotes) * 100) : 10;

            return (
              <motion.div
                key={snap.snapshot_date}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3"
              >
                <span className="text-[10px] text-muted-foreground w-14 shrink-0">{weekLabel}</span>
                <div className="flex-1 h-5 bg-muted/50 rounded-full overflow-hidden relative">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${barWidth}%` }}
                    transition={{ duration: 0.6, delay: i * 0.05 }}
                    className="h-full bg-primary/20 rounded-full"
                  />
                  {snap.majority_pct != null && (
                    <div
                      className="absolute top-0 h-full bg-primary/50 rounded-full"
                      style={{ width: `${snap.majority_pct}%`, maxWidth: `${barWidth}%` }}
                    />
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[9px] font-semibold text-foreground">{snap.total_votes}v</span>
                  {snap.archetype && (
                    <span className="text-[8px] text-muted-foreground truncate max-w-[60px]">{snap.archetype}</span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
