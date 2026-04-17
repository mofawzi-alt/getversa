import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Loader2, Sparkles, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import CampaignClientsManager from './CampaignClientsManager';
import CampaignAnalyticsDialog from './CampaignAnalyticsDialog';

interface DraftPoll {
  question: string;
  option_a: string;
  option_b: string;
  image_a_url: string;
  image_b_url: string;
  category: string;
}

const emptyPoll = (): DraftPoll => ({
  question: '',
  option_a: '',
  option_b: '',
  image_a_url: '',
  image_b_url: '',
  category: '',
});

export default function BrandCampaignBuilder() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Campaign-level fields
  const [name, setName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [brandLogoUrl, setBrandLogoUrl] = useState('');
  const [description, setDescription] = useState('');
  const [releaseAt, setReleaseAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [polls, setPolls] = useState<DraftPoll[]>([emptyPoll(), emptyPoll(), emptyPoll()]);
  const [submitting, setSubmitting] = useState(false);

  // List of existing campaigns
  const { data: campaigns, refetch: refetchCampaigns } = useQuery({
    queryKey: ['admin-brand-campaigns'],
    queryFn: async () => {
      const { data } = await supabase
        .from('poll_campaigns')
        .select('id, name, brand_name, is_active, release_at, expires_at, created_at')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const updatePoll = (i: number, patch: Partial<DraftPoll>) => {
    setPolls((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  };

  const addPoll = () => setPolls((prev) => [...prev, emptyPoll()]);
  const removePoll = (i: number) => setPolls((prev) => prev.filter((_, idx) => idx !== i));

  const validate = (): string | null => {
    if (!name.trim()) return 'Campaign name is required';
    if (!brandName.trim()) return 'Brand name is required';
    if (polls.length === 0) return 'Add at least one poll';
    for (let i = 0; i < polls.length; i++) {
      const p = polls[i];
      if (!p.question.trim() || !p.option_a.trim() || !p.option_b.trim()) {
        return `Poll ${i + 1}: question and both options are required`;
      }
    }
    return null;
  };

  const handleLaunch = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    if (!user) return;

    setSubmitting(true);
    try {
      // 1) Create campaign
      const { data: campaign, error: cErr } = await supabase
        .from('poll_campaigns')
        .insert({
          name: name.trim(),
          brand_name: brandName.trim(),
          brand_logo_url: brandLogoUrl.trim() || null,
          description: description.trim() || null,
          release_at: releaseAt ? new Date(releaseAt).toISOString() : null,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
          is_active: true,
          created_by: user.id,
        })
        .select()
        .single();
      if (cErr) throw cErr;

      const startsAt = releaseAt ? new Date(releaseAt).toISOString() : new Date().toISOString();
      const endsAt = expiresAt ? new Date(expiresAt).toISOString() : null;

      // 2) Create polls in batch with shared release window + campaign_id
      const pollRows = polls.map((p) => ({
        question: p.question.trim(),
        option_a: p.option_a.trim(),
        option_b: p.option_b.trim(),
        image_a_url: p.image_a_url.trim() || null,
        image_b_url: p.image_b_url.trim() || null,
        category: p.category.trim() || 'brands',
        is_active: true,
        starts_at: startsAt,
        ends_at: endsAt,
        campaign_id: campaign.id,
        created_by: user.id,
        poll_type: 'campaign',
        expiry_type: endsAt ? 'trending' : 'evergreen',
      }));

      const { data: createdPolls, error: pErr } = await supabase
        .from('polls')
        .insert(pollRows)
        .select('id');
      if (pErr) throw pErr;

      // 3) Link polls to campaign via campaign_polls
      const links = (createdPolls || []).map((cp) => ({
        campaign_id: campaign.id,
        poll_id: cp.id,
        entity_name: brandName.trim(),
      }));
      if (links.length > 0) {
        const { error: lErr } = await supabase.from('campaign_polls').insert(links);
        if (lErr) throw lErr;
      }

      toast.success(`Campaign launched with ${createdPolls?.length || 0} polls!`);
      // Reset form
      setName('');
      setBrandName('');
      setBrandLogoUrl('');
      setDescription('');
      setReleaseAt('');
      setExpiresAt('');
      setPolls([emptyPoll(), emptyPoll(), emptyPoll()]);
      refetchCampaigns();
      queryClient.invalidateQueries({ queryKey: ['active-brand-campaign'] });
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Failed to launch campaign');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCampaignActive = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from('poll_campaigns')
      .update({ is_active: !current })
      .eq('id', id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(!current ? 'Campaign activated' : 'Campaign paused');
      refetchCampaigns();
      queryClient.invalidateQueries({ queryKey: ['active-brand-campaign'] });
    }
  };

  return (
    <div className="space-y-6">
      {/* Builder card */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">New Brand Campaign</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Campaign name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Vodafone Q4 Pulse" />
          </div>
          <div>
            <Label className="text-xs">Brand name</Label>
            <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Vodafone" />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Brand logo URL (optional)</Label>
            <Input value={brandLogoUrl} onChange={(e) => setBrandLogoUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this campaign about?"
              rows={2}
            />
          </div>
          <div>
            <Label className="text-xs">Release at (optional)</Label>
            <Input type="datetime-local" value={releaseAt} onChange={(e) => setReleaseAt(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Expires at (optional)</Label>
            <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
        </div>

        {/* Polls list */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Polls in this batch ({polls.length})</Label>
            <Button size="sm" variant="outline" onClick={addPoll}>
              <Plus className="w-4 h-4 mr-1" /> Add poll
            </Button>
          </div>

          {polls.map((p, i) => (
            <div key={i} className="rounded-xl border border-border p-3 space-y-2 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Poll {i + 1}</span>
                {polls.length > 1 && (
                  <button onClick={() => removePoll(i)} className="text-destructive hover:opacity-70">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Input
                value={p.question}
                onChange={(e) => updatePoll(i, { question: e.target.value })}
                placeholder="Question"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={p.option_a}
                  onChange={(e) => updatePoll(i, { option_a: e.target.value })}
                  placeholder="Option A"
                />
                <Input
                  value={p.option_b}
                  onChange={(e) => updatePoll(i, { option_b: e.target.value })}
                  placeholder="Option B"
                />
                <Input
                  value={p.image_a_url}
                  onChange={(e) => updatePoll(i, { image_a_url: e.target.value })}
                  placeholder="Image A URL"
                />
                <Input
                  value={p.image_b_url}
                  onChange={(e) => updatePoll(i, { image_b_url: e.target.value })}
                  placeholder="Image B URL"
                />
              </div>
              <Input
                value={p.category}
                onChange={(e) => updatePoll(i, { category: e.target.value })}
                placeholder="Category (default: brands)"
              />
            </div>
          ))}
        </div>

        <Button onClick={handleLaunch} disabled={submitting} className="w-full">
          {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
          Launch Campaign
        </Button>
      </div>

      {/* Existing campaigns */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="font-semibold mb-3">Existing Campaigns</h3>
        {!campaigns || campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No campaigns yet.</p>
        ) : (
          <div className="space-y-2">
            {campaigns.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/40">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.brand_name || '—'} · {c.is_active ? 'Active' : 'Paused'}
                  </div>
                </div>
                <CampaignClientsManager campaignId={c.id} campaignName={c.name} />
                <Button size="sm" variant="ghost" onClick={() => toggleCampaignActive(c.id, c.is_active)}>
                  {c.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
