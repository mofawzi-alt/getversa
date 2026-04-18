import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Loader2, Users, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { DraftPoll } from './launchCampaign';

const empty = (): DraftPoll => ({ question: '', option_a: '', option_b: '' });

interface Props { onLaunched: () => void }

export default function FocusGroupForm({ onLaunched }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [description, setDescription] = useState('');
  const [polls, setPolls] = useState<DraftPoll[]>([empty(), empty(), empty()]);
  const [panelSize, setPanelSize] = useState('30');
  const [incentive, setIncentive] = useState('100');
  const [ageRange, setAgeRange] = useState<string>('any');
  const [gender, setGender] = useState<string>('any');
  const [city, setCity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [assembling, setAssembling] = useState(false);
  const [createdCampaignId, setCreatedCampaignId] = useState<string | null>(null);

  const update = (i: number, patch: Partial<DraftPoll>) =>
    setPolls((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  const handleCreate = async () => {
    if (!user) return;
    if (!name.trim() || !brandName.trim()) return toast.error('Campaign name and brand are required');
    const sizeNum = parseInt(panelSize, 10);
    if (!Number.isFinite(sizeNum) || sizeNum < 5 || sizeNum > 100) {
      return toast.error('Panel size must be between 5 and 100');
    }
    const incNum = parseInt(incentive, 10);
    if (!Number.isFinite(incNum) || incNum < 0) return toast.error('Incentive must be ≥ 0');
    for (let i = 0; i < polls.length; i++) {
      const p = polls[i];
      if (!p.question.trim() || !p.option_a.trim() || !p.option_b.trim()) {
        return toast.error(`Poll ${i + 1}: question and both options required`);
      }
    }
    setSubmitting(true);
    try {
      const { data: campaign, error: cErr } = await supabase
        .from('poll_campaigns')
        .insert({
          name: name.trim(),
          brand_name: brandName.trim(),
          description: description.trim() || null,
          campaign_type: 'focus_group',
          visibility_mode: 'panel_only',
          panel_size_target: sizeNum,
          panel_incentive_points: incNum,
          is_active: true,
          created_by: user.id,
        })
        .select()
        .single();
      if (cErr) throw cErr;

      const pollRows = polls.map((p) => ({
        question: p.question.trim(),
        option_a: p.option_a.trim(),
        option_b: p.option_b.trim(),
        category: 'focus_group',
        is_active: true,
        campaign_id: campaign.id,
        created_by: user.id,
        poll_type: 'campaign',
        expiry_type: 'evergreen',
      }));

      const { data: createdPolls, error: pErr } = await supabase
        .from('polls')
        .insert(pollRows)
        .select('id');
      if (pErr) throw pErr;

      const links = (createdPolls || []).map((cp) => ({
        campaign_id: campaign.id,
        poll_id: cp.id,
        entity_name: brandName.trim(),
      }));
      if (links.length > 0) await supabase.from('campaign_polls').insert(links);

      setCreatedCampaignId(campaign.id);
      toast.success(`Focus group created with ${createdPolls?.length || 0} polls`);
      qc.invalidateQueries({ queryKey: ['admin-brand-campaigns'] });
    } catch (e: any) {
      toast.error(e.message || 'Failed to create');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssemblePanel = async () => {
    if (!createdCampaignId) return;
    setAssembling(true);
    try {
      const { data, error } = await supabase.rpc('assemble_focus_group_panel', {
        p_campaign_id: createdCampaignId,
        p_target_size: parseInt(panelSize, 10),
        p_age_range: ageRange === 'any' ? null : ageRange,
        p_gender: gender === 'any' ? null : gender,
        p_city: city.trim() || null,
      });
      if (error) throw error;
      const invitedCount = (data as any) ?? 0;
      toast.success(`Invited ${invitedCount} panelists`);

      // Reset
      setName(''); setBrandName(''); setDescription('');
      setPolls([empty(), empty(), empty()]);
      setCreatedCampaignId(null);
      setCity(''); setAgeRange('any'); setGender('any');
      onLaunched();
    } catch (e: any) {
      toast.error(e.message || 'Failed to assemble panel');
    } finally {
      setAssembling(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
        <div className="flex items-start gap-2 text-xs text-foreground">
          <Users className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div>
            <strong>Private research panel.</strong> Polls are hidden from the public feed.
            Only invited panelists can vote — and their identities stay anonymous to the brand.
          </div>
        </div>
      </div>

      {/* Step 1: Campaign basics */}
      <div className={createdCampaignId ? 'opacity-50 pointer-events-none' : ''}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Campaign name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Vodafone GenZ Q1 Panel" />
          </div>
          <div>
            <Label className="text-xs">Brand</Label>
            <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Vodafone" />
          </div>
        </div>

        <div className="mt-3">
          <Label className="text-xs">Brief (optional, shown to panelists)</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
            placeholder="Help us understand your packaging preferences." />
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <Label className="text-xs">Panel size (5–100)</Label>
            <Input type="number" min={5} max={100} value={panelSize} onChange={(e) => setPanelSize(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Incentive (points)</Label>
            <Input type="number" min={0} value={incentive} onChange={(e) => setIncentive(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2 mt-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Polls ({polls.length})</Label>
            <Button size="sm" variant="outline" onClick={() => setPolls((p) => [...p, empty()])}>
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
          {polls.map((p, i) => (
            <div key={i} className="rounded-xl border border-border p-3 space-y-2 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Poll {i + 1}</span>
                {polls.length > 1 && (
                  <button onClick={() => setPolls((prev) => prev.filter((_, idx) => idx !== i))} className="text-destructive hover:opacity-70">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Input value={p.question} onChange={(e) => update(i, { question: e.target.value })} placeholder="Question" />
              <div className="grid grid-cols-2 gap-2">
                <Input value={p.option_a} onChange={(e) => update(i, { option_a: e.target.value })} placeholder="Option A" />
                <Input value={p.option_b} onChange={(e) => update(i, { option_b: e.target.value })} placeholder="Option B" />
              </div>
            </div>
          ))}
        </div>

        <Button onClick={handleCreate} disabled={submitting || !!createdCampaignId} className="w-full mt-4">
          {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Users className="w-4 h-4 mr-2" />}
          {createdCampaignId ? 'Created · pick panel below' : 'Create focus group'}
        </Button>
      </div>

      {/* Step 2: Assemble panel */}
      {createdCampaignId && (
        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
          <div>
            <h4 className="text-sm font-semibold flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-primary" />
              Step 2: Recruit your panel
            </h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Filter eligible users by demographic. Leave a field blank to include all.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
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
          </div>

          <div>
            <Label className="text-xs">City (optional)</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cairo" />
          </div>

          <Button onClick={handleAssemblePanel} disabled={assembling} className="w-full">
            {assembling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
            Invite {panelSize} panelists
          </Button>
        </div>
      )}
    </div>
  );
}
