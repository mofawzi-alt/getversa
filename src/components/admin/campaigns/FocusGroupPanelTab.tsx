import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Users, CheckCircle2, Clock, UserMinus } from 'lucide-react';

interface Props { campaignId: string }

interface Stats {
  total_panelists: number;
  invited: number;
  accepted: number;
  completed: number;
  dropped: number;
  completion_rate: number;
}

export default function FocusGroupPanelTab({ campaignId }: Props) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['focus-group-stats', campaignId],
    queryFn: async (): Promise<Stats | null> => {
      const { data, error } = await supabase.rpc('get_focus_group_stats', { p_campaign_id: campaignId });
      if (error) throw error;
      const row = (data || [])[0];
      return row as any;
    },
  });

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  if (!stats || stats.total_panelists === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
        No panelists invited yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card icon={<Users className="w-4 h-4" />} label="Panel size" value={stats.total_panelists} />
        <Card icon={<CheckCircle2 className="w-4 h-4 text-green-600" />} label="Completed" value={stats.completed} />
        <Card icon={<Clock className="w-4 h-4 text-amber-600" />} label="Invited" value={stats.invited} />
        <Card icon={<UserMinus className="w-4 h-4 text-muted-foreground" />} label="Dropped" value={stats.dropped} />
      </div>

      <div className="rounded-xl border border-border p-4">
        <div className="flex justify-between items-baseline mb-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Completion</span>
          <span className="text-2xl font-bold">{stats.completion_rate}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${stats.completion_rate}%` }} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          {stats.completed} of {stats.total_panelists} panelists finished the study
        </p>
      </div>
    </div>
  );
}

function Card({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
