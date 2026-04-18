import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, Check, X, Pin, PinOff, RefreshCcw, BarChart3 } from 'lucide-react';

type Finding = {
  id: string;
  scan_run_id: string;
  scan_at: string;
  finding_type: 'gender_split' | 'age_gap' | 'city_war' | 'dominant_demo';
  poll_id: string;
  headline: string;
  detail: any;
  total_votes: number;
  status: 'pending' | 'approved' | 'rejected';
  pinned: boolean;
};

const TYPE_LABEL: Record<Finding['finding_type'], string> = {
  gender_split: 'Gender split',
  age_gap: 'Age gap',
  city_war: 'City war',
  dominant_demo: 'Dominant demo',
};

export default function BreakdownAdminPanel() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [running, setRunning] = useState(false);

  const { data: findings, isLoading } = useQuery({
    queryKey: ['breakdown-findings-admin', tab],
    queryFn: async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
      const { data, error } = await supabase
        .from('breakdown_findings' as any)
        .select('*')
        .eq('status', tab)
        .gte('scan_at', sevenDaysAgo)
        .order('scan_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as unknown as Finding[];
    },
  });

  const update = useMutation({
    mutationFn: async (patch: { id: string; status?: Finding['status']; pinned?: boolean }) => {
      const updates: any = {};
      if (patch.status !== undefined) {
        updates.status = patch.status;
        updates.approved_at = patch.status === 'approved' ? new Date().toISOString() : null;
      }
      if (patch.pinned !== undefined) updates.pinned = patch.pinned;
      const { error } = await supabase
        .from('breakdown_findings' as any)
        .update(updates)
        .eq('id', patch.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Updated');
      qc.invalidateQueries({ queryKey: ['breakdown-findings-admin'] });
      qc.invalidateQueries({ queryKey: ['breakdown-findings-approved'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Update failed'),
  });

  async function runScanNow() {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('scan-breakdown', { body: {} });
      if (error) throw error;
      toast.success(`Scan complete — ${(data as any)?.findings || 0} new findings`);
      qc.invalidateQueries({ queryKey: ['breakdown-findings-admin'] });
    } catch (e: any) {
      toast.error(e?.message || 'Scan failed');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2"><BarChart3 className="w-5 h-5" /> The Breakdown</h3>
          <p className="text-sm text-muted-foreground">Auto-generated demographic findings. Approve before they go live.</p>
        </div>
        <Button size="sm" variant="outline" onClick={runScanNow} disabled={running}>
          {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
          <span className="ml-1.5">Run scan now</span>
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="pending" className="relative">
            Pending
            {(findings?.length || 0) > 0 && tab === 'pending' && (
              <Badge className="ml-1.5 h-4 px-1.5 text-[10px] bg-red-500 hover:bg-red-500">{findings!.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">Live</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4 space-y-3">
          {isLoading && <div className="flex justify-center p-8"><Loader2 className="w-5 h-5 animate-spin" /></div>}
          {!isLoading && (findings?.length || 0) === 0 && (
            <p className="text-sm text-muted-foreground p-4 text-center">No {tab} findings.</p>
          )}
          {findings?.map((f) => (
            <FindingCard
              key={f.id}
              f={f}
              onApprove={() => update.mutate({ id: f.id, status: 'approved' })}
              onReject={() => update.mutate({ id: f.id, status: 'rejected' })}
              onPin={() => update.mutate({ id: f.id, pinned: !f.pinned })}
              onUnapprove={() => update.mutate({ id: f.id, status: 'pending' })}
            />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FindingCard({ f, onApprove, onReject, onPin, onUnapprove }: {
  f: Finding;
  onApprove: () => void;
  onReject: () => void;
  onPin: () => void;
  onUnapprove: () => void;
}) {
  const detail = f.detail || {};
  const summary = useMemo(() => {
    if (f.finding_type === 'gender_split' && detail.female && detail.male) {
      return `Women A: ${detail.female.pct_a}% • Men A: ${detail.male.pct_a}% • Gap ${detail.gap_pct}pt`;
    }
    if (f.finding_type === 'age_gap' && detail.young && detail.old) {
      return `18-24 A: ${detail.young.pct_a}% • 35+ A: ${detail.old.pct_a}% • Gap ${detail.gap_pct}pt`;
    }
    if (f.finding_type === 'city_war' && detail.cairo && detail.alexandria) {
      return `Cairo A: ${detail.cairo.pct_a}% • Alex A: ${detail.alexandria.pct_a}% • Gap ${detail.gap_pct}pt`;
    }
    if (f.finding_type === 'dominant_demo' && detail.segment) {
      return `${detail.demo_label} • ${detail.segment.winner_pct}% chose ${detail.segment.winner_option}`;
    }
    return '';
  }, [f, detail]);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="text-xs">{TYPE_LABEL[f.finding_type]}</Badge>
            {f.pinned && <Badge className="text-xs bg-amber-500">Pinned</Badge>}
            <span className="text-xs text-muted-foreground">{new Date(f.scan_at).toLocaleString()}</span>
          </div>
          <p className="font-semibold text-sm">{f.headline}</p>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{detail?.poll?.question}</p>
          {summary && <p className="text-xs text-muted-foreground mt-1">{summary}</p>}
          <p className="text-xs text-muted-foreground mt-1">Based on {f.total_votes.toLocaleString()} total poll votes</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {f.status === 'pending' && (
          <>
            <Button size="sm" onClick={onApprove}><Check className="w-3 h-3 mr-1" />Approve</Button>
            <Button size="sm" variant="outline" onClick={onReject}><X className="w-3 h-3 mr-1" />Reject</Button>
          </>
        )}
        {f.status === 'approved' && (
          <>
            <Button size="sm" variant="outline" onClick={onPin}>
              {f.pinned ? <PinOff className="w-3 h-3 mr-1" /> : <Pin className="w-3 h-3 mr-1" />}
              {f.pinned ? 'Unpin' : 'Pin first'}
            </Button>
            <Button size="sm" variant="outline" onClick={onUnapprove}>Move to pending</Button>
            <Button size="sm" variant="outline" onClick={onReject}><X className="w-3 h-3 mr-1" />Reject</Button>
          </>
        )}
        {f.status === 'rejected' && (
          <Button size="sm" variant="outline" onClick={onUnapprove}>Move to pending</Button>
        )}
      </div>
    </Card>
  );
}
