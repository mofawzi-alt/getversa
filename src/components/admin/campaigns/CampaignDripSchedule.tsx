import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, CalendarClock, CheckCircle2, Circle } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  campaignId: string;
}

interface CampaignRow {
  id: string;
  drip_enabled: boolean;
  drip_start_date: string | null;
  drip_polls_per_day: number | null;
}

interface DripPreviewRow {
  poll_id: string;
  question: string;
  release_day: number;
  release_date: string | null;
  series_order: number;
  is_active: boolean;
  starts_at: string | null;
}

export default function CampaignDripSchedule({ campaignId }: Props) {
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(false);
  const [startDate, setStartDate] = useState<string>('');
  const [perDay, setPerDay] = useState<string>('10');
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);

  const { data: campaign, isLoading: loadingCampaign } = useQuery({
    queryKey: ['campaign-drip', campaignId],
    queryFn: async (): Promise<CampaignRow | null> => {
      const { data, error } = await supabase
        .from('poll_campaigns')
        .select('id, drip_enabled, drip_start_date, drip_polls_per_day')
        .eq('id', campaignId)
        .maybeSingle();
      if (error) throw error;
      return data as CampaignRow | null;
    },
  });

  useEffect(() => {
    if (campaign) {
      setEnabled(!!campaign.drip_enabled);
      setStartDate(campaign.drip_start_date ?? '');
      setPerDay(campaign.drip_polls_per_day?.toString() ?? '10');
    }
  }, [campaign]);

  const { data: preview = [], isLoading: loadingPreview, refetch: refetchPreview } = useQuery({
    queryKey: ['campaign-drip-preview', campaignId],
    queryFn: async (): Promise<DripPreviewRow[]> => {
      const { data, error } = await supabase.rpc('get_campaign_drip_preview', { p_campaign_id: campaignId });
      if (error) throw error;
      return (data || []) as DripPreviewRow[];
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<number, DripPreviewRow[]>();
    preview.forEach((row) => {
      const arr = map.get(row.release_day) ?? [];
      arr.push(row);
      map.set(row.release_day, arr);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [preview]);

  const totalPolls = preview.length;
  const totalDays = grouped.length;

  const handleSaveSettings = async () => {
    const n = parseInt(perDay, 10);
    if (enabled) {
      if (!startDate) return toast.error('Pick a start date');
      if (!Number.isFinite(n) || n < 1) return toast.error('Polls per day must be ≥ 1');
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('poll_campaigns')
        .update({
          drip_enabled: enabled,
          drip_start_date: enabled ? startDate : null,
          drip_polls_per_day: enabled ? n : null,
        })
        .eq('id', campaignId);
      if (error) throw error;
      toast.success('Drip settings saved');
      await qc.invalidateQueries({ queryKey: ['campaign-drip', campaignId] });
      await refetchPreview();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleApply = async () => {
    if (!enabled) return toast.error('Enable drip first');
    if (!startDate || !perDay) return toast.error('Save settings first');
    setApplying(true);
    try {
      const { data, error } = await supabase.rpc('apply_campaign_drip_schedule', {
        p_campaign_id: campaignId,
      });
      if (error) throw error;
      const updated = (data as any)?.updated ?? 0;
      toast.success(`Schedule applied to ${updated} polls`);
      await refetchPreview();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to apply');
    } finally {
      setApplying(false);
    }
  };

  if (loadingCampaign) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Settings card */}
      <div className="rounded-xl bg-muted/30 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-primary" />
            <div>
              <p className="text-sm font-semibold">Release polls daily in batches</p>
              <p className="text-[11px] text-muted-foreground">
                Polls release in their original order. Daily batch goes live at 9:00 AM Cairo.
              </p>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        {enabled && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <Label htmlFor="drip-start" className="text-xs">Start date</Label>
              <Input
                id="drip-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 mt-1"
              />
            </div>
            <div>
              <Label htmlFor="drip-perday" className="text-xs">Polls per day</Label>
              <Input
                id="drip-perday"
                type="number"
                min={1}
                value={perDay}
                onChange={(e) => setPerDay(e.target.value)}
                className="h-9 mt-1"
              />
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={handleSaveSettings} disabled={saving} className="flex-1">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save settings'}
          </Button>
          {enabled && (
            <Button
              size="sm"
              variant="default"
              onClick={handleApply}
              disabled={applying || !startDate || !perDay}
              className="flex-1"
            >
              {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Apply schedule'}
            </Button>
          )}
        </div>

        {enabled && totalPolls > 0 && (
          <p className="text-[11px] text-muted-foreground">
            {totalPolls} polls → {totalDays} day{totalDays === 1 ? '' : 's'} ·{' '}
            {Math.min(parseInt(perDay) || 0, totalPolls)} per day
          </p>
        )}
      </div>

      {/* Preview */}
      {loadingPreview ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : totalPolls === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">No polls in this campaign yet.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Release schedule
          </p>
          {grouped.map(([day, rows]) => {
            const date = rows[0]?.release_date;
            const allActive = rows.every((r) => r.is_active);
            return (
              <div key={day} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {allActive ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                    <span className="text-xs font-semibold">Day {day}</span>
                    {date && (
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(date).toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground">{rows.length} polls</span>
                </div>
                <ol className="space-y-1 pl-1">
                  {rows.map((r) => (
                    <li key={r.poll_id} className="text-[11px] text-muted-foreground flex gap-2">
                      <span className="text-muted-foreground/60 w-4">{r.series_order}.</span>
                      <span className="flex-1 truncate">{r.question}</span>
                      {r.is_active && (
                        <span className="text-green-600 text-[10px] font-semibold uppercase">Live</span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
