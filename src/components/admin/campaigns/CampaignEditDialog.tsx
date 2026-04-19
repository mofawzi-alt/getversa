import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  campaignId: string;
}

export default function CampaignEditDialog({ campaignId }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    brand_name: '',
    brand_logo_url: '',
    description: '',
    release_at: '',
    expires_at: '',
    target_vote_count: '' as string,
  });

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from('poll_campaigns')
      .select('name, brand_name, brand_logo_url, description, release_at, expires_at, target_vote_count')
      .eq('id', campaignId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        if (data) {
          setForm({
            name: data.name || '',
            brand_name: data.brand_name || '',
            brand_logo_url: data.brand_logo_url || '',
            description: data.description || '',
            release_at: data.release_at ? toLocal(data.release_at) : '',
            expires_at: data.expires_at ? toLocal(data.expires_at) : '',
            target_vote_count: data.target_vote_count != null ? String(data.target_vote_count) : '',
          });
        }
        setLoading(false);
      });
  }, [open, campaignId]);

  const save = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    setSaving(true);
    const payload: any = {
      name: form.name.trim(),
      brand_name: form.brand_name.trim() || null,
      brand_logo_url: form.brand_logo_url.trim() || null,
      description: form.description.trim() || null,
      release_at: form.release_at ? new Date(form.release_at).toISOString() : null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      target_vote_count: form.target_vote_count ? Number(form.target_vote_count) : null,
    };
    const { error } = await supabase.from('poll_campaigns').update(payload).eq('id', campaignId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Campaign updated');
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: ['admin-brand-campaigns'] });
    queryClient.invalidateQueries({ queryKey: ['active-brand-campaign'] });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" title="Edit campaign">
          <Pencil className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Campaign</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Brand name</Label>
              <Input value={form.brand_name} onChange={(e) => setForm({ ...form, brand_name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Brand logo URL</Label>
              <Input value={form.brand_logo_url} onChange={(e) => setForm({ ...form, brand_logo_url: e.target.value })} placeholder="https://…" />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Release at</Label>
                <Input type="datetime-local" value={form.release_at} onChange={(e) => setForm({ ...form, release_at: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Expires at</Label>
                <Input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Target vote count</Label>
              <Input type="number" min={0} value={form.target_vote_count} onChange={(e) => setForm({ ...form, target_vote_count: e.target.value })} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || loading}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function toLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
