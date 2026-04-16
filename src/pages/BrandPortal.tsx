import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  ArrowLeft, Plus, BarChart3, Users, TrendingUp,
  Megaphone, Loader2, Eye, Zap, Target, ChevronRight
} from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  poll_count?: number;
}

export default function BrandPortal() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newCampaign, setNewCampaign] = useState({ name: '', description: '' });

  // Fetch user's campaigns
  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['brand-campaigns', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: campaignData } = await supabase
        .from('poll_campaigns')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (!campaignData) return [];

      // Get poll counts per campaign
      const campaignIds = campaignData.map(c => c.id);
      const { data: pollCounts } = await supabase
        .from('campaign_polls')
        .select('campaign_id')
        .in('campaign_id', campaignIds);

      const countMap = new Map<string, number>();
      (pollCounts || []).forEach(pc => {
        countMap.set(pc.campaign_id, (countMap.get(pc.campaign_id) || 0) + 1);
      });

      return campaignData.map(c => ({
        ...c,
        poll_count: countMap.get(c.id) || 0,
      }));
    },
    enabled: !!user,
  });

  // Fetch collaboration requests
  const { data: requests = [] } = useQuery({
    queryKey: ['collab-requests', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('collaboration_requests')
        .select('*')
        .eq('requester_id', user.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  // Create campaign
  const createCampaign = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('poll_campaigns')
        .insert({
          name: newCampaign.name,
          description: newCampaign.description || null,
          created_by: user.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-campaigns'] });
      toast.success('Campaign created!');
      setShowCreate(false);
      setNewCampaign({ name: '', description: '' });
    },
    onError: () => toast.error('Failed to create campaign'),
  });

  // Submit collaboration request
  const [showCollab, setShowCollab] = useState(false);
  const [collabForm, setCollabForm] = useState({ brand_name: '', contact_email: '', message: '' });

  const submitCollab = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('collaboration_requests')
        .insert({
          ...collabForm,
          requester_id: user.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collab-requests'] });
      toast.success('Request submitted! We\'ll be in touch.');
      setShowCollab(false);
      setCollabForm({ brand_name: '', contact_email: '', message: '' });
    },
    onError: () => toast.error('Failed to submit request'),
  });

  if (!user) {
    return (
      <AppLayout>
        <div className="p-4 text-center pt-20 space-y-4">
          <Megaphone className="h-12 w-12 mx-auto text-primary" />
          <h1 className="text-xl font-bold">Brand Portal</h1>
          <p className="text-sm text-muted-foreground">Sign in to create campaigns and reach Gen Z audiences</p>
          <Button onClick={() => navigate('/auth')}>Sign In</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 space-y-5 animate-slide-up">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-display font-bold">Brand Portal</h1>
            <p className="text-xs text-muted-foreground">Create campaigns & reach Gen Z</p>
          </div>
        </div>

        <Tabs defaultValue="campaigns" className="w-full">
          <TabsList className="w-full grid grid-cols-3 h-10">
            <TabsTrigger value="campaigns" className="text-xs">Campaigns</TabsTrigger>
            <TabsTrigger value="insights" className="text-xs">Insights</TabsTrigger>
            <TabsTrigger value="contact" className="text-xs">Get Started</TabsTrigger>
          </TabsList>

          {/* Campaigns Tab */}
          <TabsContent value="campaigns" className="space-y-4 mt-4">
            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="glass rounded-xl p-3 text-center">
                <Megaphone className="h-4 w-4 mx-auto text-primary mb-1" />
                <div className="text-lg font-bold">{campaigns.length}</div>
                <div className="text-[9px] text-muted-foreground">Campaigns</div>
              </div>
              <div className="glass rounded-xl p-3 text-center">
                <BarChart3 className="h-4 w-4 mx-auto text-primary mb-1" />
                <div className="text-lg font-bold">
                  {campaigns.reduce((sum, c) => sum + (c.poll_count || 0), 0)}
                </div>
                <div className="text-[9px] text-muted-foreground">Polls</div>
              </div>
              <div className="glass rounded-xl p-3 text-center">
                <Users className="h-4 w-4 mx-auto text-primary mb-1" />
                <div className="text-lg font-bold">—</div>
                <div className="text-[9px] text-muted-foreground">Total Reach</div>
              </div>
            </div>

            {/* Create campaign button */}
            <Button onClick={() => setShowCreate(true)} className="w-full h-12">
              <Plus className="h-4 w-4 mr-2" />
              Create Campaign
            </Button>

            {/* Campaign list */}
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : campaigns.length === 0 ? (
              <div className="glass rounded-2xl p-8 text-center">
                <Megaphone className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <h3 className="font-semibold mb-1">No campaigns yet</h3>
                <p className="text-sm text-muted-foreground">Create your first campaign to start gathering insights</p>
              </div>
            ) : (
              <div className="space-y-2">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="glass rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm">{campaign.name}</h3>
                      <span className="text-[10px] text-muted-foreground">
                        {campaign.poll_count} poll{campaign.poll_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {campaign.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{campaign.description}</p>
                    )}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="text-xs flex-1">
                        <Eye className="h-3 w-3 mr-1" /> View Results
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs flex-1">
                        <Plus className="h-3 w-3 mr-1" /> Add Poll
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Insights Tab */}
          <TabsContent value="insights" className="space-y-4 mt-4">
            <div className="glass rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <h3 className="font-bold">Audience Intelligence</h3>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50">
                  <Zap className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Real-time Sentiment</p>
                    <p className="text-xs text-muted-foreground">See how Gen Z responds to your brand in real-time</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50">
                  <Users className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Demographic Breakdown</p>
                    <p className="text-xs text-muted-foreground">Age, gender, and city-level insights on preferences</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50">
                  <TrendingUp className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Trend Detection</p>
                    <p className="text-xs text-muted-foreground">Spot shifting preferences before competitors do</p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Create a campaign to start collecting audience intelligence
              </p>
            </div>

            {/* Pricing teaser */}
            <div className="glass rounded-2xl p-5 border border-primary/20">
              <div className="text-center space-y-2">
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Coming Soon</span>
                <h3 className="font-bold text-lg">Brand Intelligence Plans</h3>
                <p className="text-sm text-muted-foreground">
                  Self-serve campaigns with demographic targeting, AI insights, and real-time dashboards
                </p>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className="p-3 rounded-xl bg-secondary/50 text-center">
                    <p className="text-xs font-bold">Starter</p>
                    <p className="text-[10px] text-muted-foreground">5 polls/mo</p>
                  </div>
                  <div className="p-3 rounded-xl bg-primary/10 text-center border border-primary/20">
                    <p className="text-xs font-bold text-primary">Pro</p>
                    <p className="text-[10px] text-muted-foreground">25 polls/mo</p>
                  </div>
                  <div className="p-3 rounded-xl bg-secondary/50 text-center">
                    <p className="text-xs font-bold">Enterprise</p>
                    <p className="text-[10px] text-muted-foreground">Unlimited</p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Contact / Get Started Tab */}
          <TabsContent value="contact" className="space-y-4 mt-4">
            <div className="glass rounded-2xl p-5 space-y-4">
              <div className="text-center space-y-2">
                <Megaphone className="h-8 w-8 mx-auto text-primary" />
                <h3 className="font-bold text-lg">Partner with Versa</h3>
                <p className="text-sm text-muted-foreground">
                  Reach Egypt's Gen Z audience with interactive polling campaigns
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-semibold">Brand Name</Label>
                  <Input
                    value={collabForm.brand_name}
                    onChange={(e) => setCollabForm(f => ({ ...f, brand_name: e.target.value }))}
                    placeholder="Your brand name"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Contact Email</Label>
                  <Input
                    value={collabForm.contact_email}
                    onChange={(e) => setCollabForm(f => ({ ...f, contact_email: e.target.value }))}
                    placeholder="you@brand.com"
                    type="email"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">What are you looking for?</Label>
                  <Textarea
                    value={collabForm.message}
                    onChange={(e) => setCollabForm(f => ({ ...f, message: e.target.value }))}
                    placeholder="Tell us about your campaign goals, target audience, budget..."
                    className="mt-1"
                    rows={4}
                  />
                </div>
                <Button
                  onClick={() => submitCollab.mutate()}
                  disabled={!collabForm.brand_name || !collabForm.contact_email || !collabForm.message || submitCollab.isPending}
                  className="w-full h-12"
                >
                  {submitCollab.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Megaphone className="h-4 w-4 mr-2" />
                  )}
                  Submit Request
                </Button>
              </div>
            </div>

            {/* Previous requests */}
            {requests.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Your Requests</h4>
                {requests.map((req: any) => (
                  <div key={req.id} className="glass rounded-xl p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{req.brand_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(req.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      req.status === 'approved' ? 'bg-green-500/10 text-green-600' :
                      req.status === 'rejected' ? 'bg-destructive/10 text-destructive' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {req.status || 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Create Campaign Dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-sm rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-primary" />
                New Campaign
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-semibold">Campaign Name</Label>
                <Input
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign(c => ({ ...c, name: e.target.value }))}
                  placeholder="e.g., Summer Brand Battle"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Description (optional)</Label>
                <Textarea
                  value={newCampaign.description}
                  onChange={(e) => setNewCampaign(c => ({ ...c, description: e.target.value }))}
                  placeholder="What's this campaign about?"
                  className="mt-1"
                  rows={3}
                />
              </div>
              <Button
                onClick={() => createCampaign.mutate()}
                disabled={!newCampaign.name || createCampaign.isPending}
                className="w-full"
              >
                {createCampaign.isPending ? 'Creating...' : 'Create Campaign'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
