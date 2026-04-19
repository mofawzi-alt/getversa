import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, Eye, EyeOff, Layers, Wand2, Zap, Trash2, Users } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import CampaignClientsManager from './CampaignClientsManager';
import CampaignAnalyticsDialog from './CampaignAnalyticsDialog';
import CampaignFeedbackConfigDialog from './campaigns/CampaignFeedbackConfigDialog';
import QuickLaunchForm from './campaigns/QuickLaunchForm';
import TemplatesForm from './campaigns/TemplatesForm';
import AIDraftForm from './campaigns/AIDraftForm';
import FocusGroupForm from './campaigns/FocusGroupForm';
import ManagePanelDialog from './campaigns/ManagePanelDialog';
import CampaignEditDialog from './campaigns/CampaignEditDialog';

export default function BrandCampaignBuilder() {
  const queryClient = useQueryClient();

  const { data: campaigns, refetch: refetchCampaigns } = useQuery({
    queryKey: ['admin-brand-campaigns'],
    queryFn: async () => {
      const { data } = await supabase
        .from('poll_campaigns')
        .select('id, name, brand_name, campaign_type, is_active, release_at, expires_at, visibility_mode, created_at')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const updateVisibilityMode = async (id: string, mode: string) => {
    const { error } = await supabase.from('poll_campaigns').update({ visibility_mode: mode }).eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Visibility updated');
    refetchCampaigns();
    queryClient.invalidateQueries({ queryKey: ['active-brand-campaign'] });
  };

  const onLaunched = () => {
    refetchCampaigns();
    queryClient.invalidateQueries({ queryKey: ['active-brand-campaign'] });
  };

  const toggleCampaignActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from('poll_campaigns').update({ is_active: !current }).eq('id', id);
    if (error) return toast.error(error.message);
    toast.success(!current ? 'Campaign activated' : 'Campaign paused');
    refetchCampaigns();
    queryClient.invalidateQueries({ queryKey: ['active-brand-campaign'] });
  };

  const deleteCampaign = async (id: string, name: string) => {
    const alsoDeletePolls = confirm(
      `Delete campaign "${name}"?\n\nClick OK to ALSO delete all polls in this campaign.\nClick Cancel to keep the polls (they'll be unlinked) — then confirm again to delete just the campaign.`
    );
    if (alsoDeletePolls) {
      const { data: cps } = await supabase.from('campaign_polls').select('poll_id').eq('campaign_id', id);
      const pollIds = (cps || []).map((c: any) => c.poll_id);
      if (pollIds.length) {
        await supabase.from('campaign_polls').delete().eq('campaign_id', id);
        const { error: pErr } = await supabase.from('polls').delete().in('id', pollIds);
        if (pErr) return toast.error(`Failed to delete polls: ${pErr.message}`);
      }
    } else {
      if (!confirm(`Delete just the campaign "${name}" and keep its polls?`)) return;
      await supabase.from('campaign_polls').delete().eq('campaign_id', id);
      await supabase.from('polls').update({ campaign_id: null }).eq('campaign_id', id);
    }
    const { error } = await supabase.from('poll_campaigns').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Campaign deleted');
    refetchCampaigns();
    queryClient.invalidateQueries({ queryKey: ['active-brand-campaign'] });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">New Brand Campaign</h3>
        </div>

        <Tabs defaultValue="quick">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="quick" className="gap-1 text-xs"><Zap className="w-3 h-3" />Quick</TabsTrigger>
            <TabsTrigger value="templates" className="gap-1 text-xs"><Layers className="w-3 h-3" />Tmpl</TabsTrigger>
            <TabsTrigger value="ai" className="gap-1 text-xs"><Wand2 className="w-3 h-3" />AI</TabsTrigger>
            <TabsTrigger value="focus" className="gap-1 text-xs"><Users className="w-3 h-3" />Panel</TabsTrigger>
          </TabsList>
          <TabsContent value="quick" className="pt-4">
            <QuickLaunchForm onLaunched={onLaunched} />
          </TabsContent>
          <TabsContent value="templates" className="pt-4">
            <TemplatesForm onLaunched={onLaunched} />
          </TabsContent>
          <TabsContent value="ai" className="pt-4">
            <AIDraftForm onLaunched={onLaunched} />
          </TabsContent>
          <TabsContent value="focus" className="pt-4">
            <FocusGroupForm onLaunched={onLaunched} />
          </TabsContent>
        </Tabs>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="font-semibold mb-3">Existing Campaigns</h3>
        {!campaigns || campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No campaigns yet.</p>
        ) : (
          <div className="space-y-2">
            {campaigns.map((c: any) => (
              <div key={c.id} className="p-3 rounded-lg bg-muted/40">
                <div className="text-center mb-2">
                  <div className="text-xs font-semibold truncate">{c.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {c.brand_name || '—'} · {c.is_active ? 'Active' : 'Paused'}
                  </div>
                </div>

                <div className="mb-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 text-center">
                    Where polls appear
                  </div>
                  <Select
                    value={c.visibility_mode || (c.campaign_type === 'focus_group' ? 'panel_only' : 'mixed')}
                    onValueChange={(v) => updateVisibilityMode(c.id, v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {c.campaign_type === 'focus_group' ? (
                        <SelectItem value="panel_only">Panel only — Private invited panelists</SelectItem>
                      ) : (
                        <>
                          <SelectItem value="mixed">Mixed — Hero feed + Brand banner</SelectItem>
                          <SelectItem value="bundle_only">Bundle only — Brand banner only</SelectItem>
                          <SelectItem value="hero_only">Hero only — No banner, native feed</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-center gap-1 flex-wrap">
                  <CampaignAnalyticsDialog campaignId={c.id} campaignName={c.name} brandName={c.brand_name} />
                  <CampaignEditDialog campaignId={c.id} />
                  <CampaignFeedbackConfigDialog campaignId={c.id} campaignName={c.name} />
                  {c.campaign_type === 'focus_group' && (
                    <ManagePanelDialog campaignId={c.id} campaignName={c.name} />
                  )}
                  <CampaignClientsManager campaignId={c.id} campaignName={c.name} />
                  <Button size="sm" variant="ghost" onClick={() => toggleCampaignActive(c.id, c.is_active)}>
                    {c.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteCampaign(c.id, c.name)} className="text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
