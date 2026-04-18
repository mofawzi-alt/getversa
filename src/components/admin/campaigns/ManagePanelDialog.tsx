import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import FocusGroupPanelTab from './FocusGroupPanelTab';

interface Props { campaignId: string; campaignName: string; defaultSize?: number }

export default function ManagePanelDialog({ campaignId, campaignName, defaultSize = 30 }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState(String(defaultSize));
  const [ageRange, setAgeRange] = useState('any');
  const [gender, setGender] = useState('any');
  const [city, setCity] = useState('');
  const [busy, setBusy] = useState(false);

  const invite = async () => {
    const n = parseInt(size, 10);
    if (!Number.isFinite(n) || n < 1 || n > 100) return toast.error('Size must be 1–100');
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('assemble_focus_group_panel', {
        p_campaign_id: campaignId,
        p_target_size: n,
        p_age_range: ageRange === 'any' ? null : ageRange,
        p_gender: gender === 'any' ? null : gender,
        p_city: city.trim() || null,
      });
      if (error) throw error;
      const invited = (data as any) ?? 0;
      toast.success(invited > 0 ? `Invited ${invited} new panelists` : 'No new eligible users matched');
      qc.invalidateQueries({ queryKey: ['focus-group-stats', campaignId] });
    } catch (e: any) {
      toast.error(e.message || 'Failed to invite');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" title="Manage panel">
          <UserPlus className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Panel · {campaignName}</DialogTitle>
        </DialogHeader>

        <FocusGroupPanelTab campaignId={campaignId} />

        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3 mt-2">
          <div>
            <h4 className="text-sm font-semibold flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-primary" /> Recruit more panelists
            </h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Picks eligible app users matching filters. Already-invited users are skipped.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">How many</Label>
              <Input type="number" min={1} max={100} value={size} onChange={(e) => setSize(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Age range</Label>
              <Select value={ageRange} onValueChange={setAgeRange}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="13-17">13–17</SelectItem>
                  <SelectItem value="18-24">18–24</SelectItem>
                  <SelectItem value="25-34">25–34</SelectItem>
                  <SelectItem value="35-44">35–44</SelectItem>
                  <SelectItem value="45+">45+</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Gender</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">City</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Any" />
            </div>
          </div>

          <Button onClick={invite} disabled={busy} className="w-full">
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
            Invite {size} panelists
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
