import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Pin, PinOff, RefreshCcw } from 'lucide-react';

export default function PulseAdminPanel() {
  const qc = useQueryClient();
  const [pollSearch, setPollSearch] = useState('');
  const [rebuilding, setRebuilding] = useState<'morning' | 'evening' | null>(null);

  // Settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['pulse-settings-admin'],
    queryFn: async () => {
      const { data } = await supabase
        .from('pulse_settings' as any)
        .select('*')
        .limit(1)
        .maybeSingle();
      return data as any;
    },
  });

  const [local, setLocal] = useState<any>(null);
  useEffect(() => { if (settings) setLocal(settings); }, [settings]);

  const updateSettings = useMutation({
    mutationFn: async (patch: any) => {
      if (!local?.id) {
        const { error } = await supabase.from('pulse_settings' as any).insert(patch);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('pulse_settings' as any)
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq('id', local.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Pulse settings saved');
      qc.invalidateQueries({ queryKey: ['pulse-settings-admin'] });
      qc.invalidateQueries({ queryKey: ['pulse-settings'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Save failed'),
  });

  function toggle(key: string, value: boolean) {
    setLocal((s: any) => ({ ...s, [key]: value }));
    updateSettings.mutate({ [key]: value });
  }

  // Today's pulse cache (latest row)
  const { data: pulseRow } = useQuery({
    queryKey: ['pulse-row-admin'],
    queryFn: async () => {
      const { data } = await supabase
        .from('daily_pulse' as any)
        .select('*')
        .order('pulse_date', { ascending: false })
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
  });

  // Poll search
  const { data: searchResults } = useQuery({
    queryKey: ['pulse-poll-search', pollSearch],
    enabled: pollSearch.trim().length >= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, category')
        .ilike('question', `%${pollSearch.trim()}%`)
        .eq('is_active', true)
        .limit(8);
      return data || [];
    },
  });

  const setPin = useMutation({
    mutationFn: async (pollId: string | null) => {
      if (!pulseRow?.id) throw new Error('No pulse row to pin to');
      const { error } = await supabase
        .from('daily_pulse' as any)
        .update({ pinned_poll_id: pollId })
        .eq('id', pulseRow.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Pin updated');
      qc.invalidateQueries({ queryKey: ['pulse-row-admin'] });
      qc.invalidateQueries({ queryKey: ['daily-pulse-latest'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Pin failed'),
  });

  async function rebuild(slot: 'morning' | 'evening') {
    setRebuilding(slot);
    try {
      const { data, error } = await supabase.functions.invoke('build-daily-pulse', {
        body: { slot },
      });
      if (error) throw error;
      toast.success(`Rebuilt ${slot} pulse — ${(data as any)?.counts?.ranked || 0} ranked polls`);
      qc.invalidateQueries({ queryKey: ['pulse-row-admin'] });
      qc.invalidateQueries({ queryKey: ['daily-pulse-latest'] });
    } catch (e: any) {
      toast.error(e?.message || 'Rebuild failed');
    } finally {
      setRebuilding(null);
    }
  }

  const pinnedPoll = useMemo(() => {
    if (!pulseRow?.pinned_poll_id) return null;
    return pulseRow.pinned_poll_id;
  }, [pulseRow]);

  if (isLoading || !local) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold mb-1">Daily Pulse</h3>
        <p className="text-sm text-muted-foreground">Toggle Pulse features and pin a featured poll for today.</p>
      </div>

      <Card className="p-4 space-y-3">
        <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Feature toggles</h4>
        <ToggleRow label="Stories Row (Home)" description="Shows the horizontal Pulse circles on Home." checked={!!local.stories_row_enabled} onChange={(v) => toggle('stories_row_enabled', v)} />
        <ToggleRow label="Morning Pulse" description="Auto-opens 6–11am local. Big result, closest battle, surprise, your standing." checked={!!local.morning_pulse_enabled} onChange={(v) => toggle('morning_pulse_enabled', v)} />
        <ToggleRow label="Evening Verdict" description="Auto-opens 8pm–midnight local. Day's recap." checked={!!local.evening_verdict_enabled} onChange={(v) => toggle('evening_verdict_enabled', v)} />
        <ToggleRow label="Egypt Today circle" description="First circle in the Stories row." checked={!!local.egypt_today_enabled} onChange={(v) => toggle('egypt_today_enabled', v)} />
        <ToggleRow label="Cairo circle" description="Cairo-only voter results." checked={!!local.cairo_enabled} onChange={(v) => toggle('cairo_enabled', v)} />
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Today's cache</h4>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => rebuild('morning')} disabled={rebuilding !== null}>
              {rebuilding === 'morning' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
              <span className="ml-1.5">Rebuild morning</span>
            </Button>
            <Button size="sm" variant="outline" onClick={() => rebuild('evening')} disabled={rebuilding !== null}>
              {rebuilding === 'evening' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
              <span className="ml-1.5">Rebuild evening</span>
            </Button>
          </div>
        </div>
        {pulseRow ? (
          <div className="text-xs text-muted-foreground">
            <p>Slot: <span className="font-medium text-foreground">{pulseRow.slot}</span></p>
            <p>Date: <span className="font-medium text-foreground">{pulseRow.pulse_date}</span></p>
            <p>Generated: <span className="font-medium text-foreground">{new Date(pulseRow.generated_at).toLocaleString()}</span></p>
            <p>Egypt Today: <span className="font-medium text-foreground">{(pulseRow.egypt_today || []).length} polls</span></p>
            <p>Pinned poll: <span className="font-medium text-foreground">{pinnedPoll || '—'}</span></p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No pulse cached yet. Hit "Rebuild morning" to generate one.</p>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Pin a poll to Egypt Today</h4>
        <p className="text-xs text-muted-foreground">Search and select a poll to feature in the Egypt Today circle. Overrides auto-selection until cleared.</p>
        <div className="flex gap-2">
          <Input
            placeholder="Search active polls by question..."
            value={pollSearch}
            onChange={(e) => setPollSearch(e.target.value)}
          />
          {pinnedPoll && (
            <Button size="sm" variant="outline" onClick={() => setPin.mutate(null)}>
              <PinOff className="w-3 h-3 mr-1.5" />Clear pin
            </Button>
          )}
        </div>
        {searchResults && searchResults.length > 0 && (
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {searchResults.map((p: any) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPin.mutate(p.id)}
                className="w-full text-left p-2 rounded-md hover:bg-muted text-sm flex items-start justify-between gap-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{p.question}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.option_a} vs {p.option_b} {p.category && `• ${p.category}`}</p>
                </div>
                <Pin className={`w-4 h-4 flex-shrink-0 ${pinnedPoll === p.id ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border/30 last:border-0">
      <div className="flex-1 min-w-0">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
