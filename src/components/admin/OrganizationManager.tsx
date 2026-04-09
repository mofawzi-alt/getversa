import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Plus, Copy, Trash2, Users, Loader2, Building2 } from 'lucide-react';
import { toast } from 'sonner';

export default function OrganizationManager() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  const { data: orgs, isLoading } = useQuery({
    queryKey: ['admin-organizations'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('organizations' as any)
        .select('*')
        .order('created_at', { ascending: false }) as any);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: memberCounts } = useQuery({
    queryKey: ['admin-org-member-counts'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('organization_members' as any)
        .select('organization_id') as any);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data as any[])?.forEach((m: any) => {
        counts[m.organization_id] = (counts[m.organization_id] || 0) + 1;
      });
      return counts;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await (supabase
        .from('organizations' as any)
        .insert({ name, logo_url: logoUrl || null, created_by: user.id }) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
      toast.success('Organization created!');
      setName('');
      setLogoUrl('');
      setShowForm(false);
    },
    onError: () => toast.error('Failed to create organization'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (orgId: string) => {
      const { error } = await (supabase
        .from('organizations' as any)
        .delete()
        .eq('id', orgId) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-org-member-counts'] });
      toast.success('Organization deleted');
    },
    onError: () => toast.error('Failed to delete organization'),
  });

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Invite code copied!');
  };

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Organizations
        </h3>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1" /> New Org
        </Button>
      </div>

      {showForm && (
        <Card className="p-4 space-y-3 border-primary/20">
          <div>
            <Label>Organization Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Pepsi Egypt" className="bg-secondary" />
          </div>
          <div>
            <Label>Logo URL <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://..." className="bg-secondary" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={!name.trim() || createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Create
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {!orgs?.length && !showForm && (
        <p className="text-muted-foreground text-sm text-center py-8">No organizations yet. Create one to enable private polls.</p>
      )}

      <div className="space-y-3">
        {orgs?.map((org: any) => (
          <Card key={org.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {org.logo_url && <img src={org.logo_url} alt="" className="h-6 w-6 rounded object-cover" />}
                  <h4 className="font-semibold truncate">{org.name}</h4>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {memberCounts?.[org.id] || 0} members
                  </span>
                  <span>Created {new Date(org.created_at).toLocaleDateString()}</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <code className="bg-secondary px-2 py-1 rounded text-xs font-mono font-bold tracking-wider">
                    {org.invite_code}
                  </code>
                  <button onClick={() => copyCode(org.invite_code)} className="text-primary hover:text-primary/80">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <button
                onClick={() => {
                  if (confirm(`Delete "${org.name}"? All members will be removed and private polls will become public.`)) {
                    deleteMutation.mutate(org.id);
                  }
                }}
                className="p-2 text-destructive hover:bg-destructive/10 rounded-lg"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
