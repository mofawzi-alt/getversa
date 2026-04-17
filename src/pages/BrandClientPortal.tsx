import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import CampaignDetailView from '@/components/admin/campaigns/CampaignDetailView';

interface ClientCampaign {
  campaign_id: string;
  name: string;
  brand_name: string | null;
  brand_logo_url: string | null;
  description: string | null;
  is_active: boolean;
  release_at: string | null;
  expires_at: string | null;
  poll_count: number;
  total_votes: number;
}

export default function BrandClientPortal() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [campaigns, setCampaigns] = useState<ClientCampaign[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_my_client_campaigns');
      if (error) {
        toast.error('Could not load your campaigns');
      } else {
        const list = (data || []) as ClientCampaign[];
        setCampaigns(list);
        if (list.length > 0) setSelectedId(list[0].campaign_id);
      }
      setLoading(false);
    })();
  }, [user]);

  const selected = campaigns.find((c) => c.campaign_id === selectedId);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="p-8 max-w-md text-center space-y-4">
          <h1 className="text-xl font-semibold">No campaigns assigned</h1>
          <p className="text-sm text-muted-foreground">
            Your account isn't linked to any active campaigns yet. Contact your account manager.
          </p>
          <Button variant="outline" onClick={() => signOut().then(() => navigate('/auth'))}>
            Sign out
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/home')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-base font-semibold">Brand Portal</h1>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => signOut().then(() => navigate('/auth'))}
            className="gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 space-y-4">
        {campaigns.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {campaigns.map((c) => (
              <button
                key={c.campaign_id}
                onClick={() => setSelectedId(c.campaign_id)}
                className={`px-4 py-2 rounded-full text-sm whitespace-nowrap border transition ${
                  selectedId === c.campaign_id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card hover:bg-accent border-border'
                }`}
              >
                {c.brand_name || c.name}
              </button>
            ))}
          </div>
        )}

        {selected && (
          <>
            <Card className="p-6">
              <div className="flex items-start gap-4">
                {selected.brand_logo_url && (
                  <img
                    src={selected.brand_logo_url}
                    alt={selected.brand_name || ''}
                    className="w-16 h-16 rounded-lg object-cover bg-muted"
                  />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold">{selected.name}</h2>
                    <Badge variant={selected.is_active ? 'default' : 'secondary'}>
                      {selected.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  {selected.brand_name && (
                    <p className="text-sm text-muted-foreground mt-1">{selected.brand_name}</p>
                  )}
                  {selected.description && (
                    <p className="text-sm mt-2">{selected.description}</p>
                  )}
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <CampaignDetailView
                key={selected.campaign_id}
                campaignId={selected.campaign_id}
                campaignName={selected.name}
                brandName={selected.brand_name}
              />
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
