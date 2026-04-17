import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trash2, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  campaignId: string;
  campaignName: string;
}

interface ClientRow {
  id: string;
  user_id: string;
  email: string | null;
  username: string | null;
  created_at: string;
}

export default function CampaignClientsManager({ campaignId, campaignName }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: links, error } = await supabase
      .from('campaign_clients')
      .select('id, user_id, created_at')
      .eq('campaign_id', campaignId);
    if (error) {
      toast.error('Failed to load clients');
      setLoading(false);
      return;
    }
    const userIds = (links || []).map((l) => l.user_id);
    let usersMap = new Map<string, { email: string; username: string | null }>();
    if (userIds.length) {
      const { data: users } = await supabase
        .from('users')
        .select('id, email, username')
        .in('id', userIds);
      (users || []).forEach((u) => usersMap.set(u.id, { email: u.email, username: u.username }));
    }
    setRows(
      (links || []).map((l) => ({
        id: l.id,
        user_id: l.user_id,
        created_at: l.created_at,
        email: usersMap.get(l.user_id)?.email || null,
        username: usersMap.get(l.user_id)?.username || null,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
  }, [open, campaignId]);

  const handleAdd = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setAdding(true);
    // Find user by email
    const { data: matches, error: findErr } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', trimmed)
      .limit(1);
    if (findErr) {
      toast.error('Search failed');
      setAdding(false);
      return;
    }
    if (!matches || matches.length === 0) {
      toast.error('No user found with that email. They must sign up first.');
      setAdding(false);
      return;
    }
    const targetId = matches[0].id;

    // Insert link
    const { error: insErr } = await supabase
      .from('campaign_clients')
      .insert({ campaign_id: campaignId, user_id: targetId, created_by: user?.id });
    if (insErr) {
      if (insErr.code === '23505') toast.error('Already a client of this campaign');
      else toast.error(insErr.message);
      setAdding(false);
      return;
    }

    // Also assign brand_client role (idempotent)
    await supabase.from('user_roles').insert({ user_id: targetId, role: 'brand_client' as any }).then(() => {});

    toast.success('Client added');
    setEmail('');
    await load();
    setAdding(false);
  };

  const handleRemove = async (id: string) => {
    const { error } = await supabase.from('campaign_clients').delete().eq('id', id);
    if (error) {
      toast.error('Failed to remove');
      return;
    }
    toast.success('Removed');
    load();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <Users className="w-4 h-4" />
          Clients
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Brand clients — {campaignName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Add client by email</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="brand@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
              <Button onClick={handleAdd} disabled={adding || !email.trim()} className="gap-2">
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Add
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              The user must already have an account. They'll see this campaign at <code>/brand/portal</code>.
            </p>
          </div>

          <div className="border rounded-md divide-y max-h-72 overflow-y-auto">
            {loading ? (
              <div className="p-6 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No clients assigned yet</p>
            ) : (
              rows.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{r.email || r.user_id}</p>
                    {r.username && (
                      <p className="text-xs text-muted-foreground">@{r.username}</p>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleRemove(r.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </div>

          <Badge variant="outline" className="text-[11px]">
            Clients can only see analytics for campaigns they're assigned to.
          </Badge>
        </div>
      </DialogContent>
    </Dialog>
  );
}
