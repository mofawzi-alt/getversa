import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Loader2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { launchCampaign, DraftPoll } from './launchCampaign';

const empty = (): DraftPoll => ({ question: '', option_a: '', option_b: '' });

interface Props { onLaunched: () => void }

export default function QuickLaunchForm({ onLaunched }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [polls, setPolls] = useState<DraftPoll[]>([empty(), empty(), empty()]);
  const [advanced, setAdvanced] = useState(false);
  const [brandLogoUrl, setBrandLogoUrl] = useState('');
  const [description, setDescription] = useState('');
  const [releaseAt, setReleaseAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (i: number, patch: Partial<DraftPoll>) =>
    setPolls((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  const handleLaunch = async () => {
    if (!user) return;
    if (!name.trim() || !brandName.trim()) return toast.error('Campaign name and brand are required');
    for (let i = 0; i < polls.length; i++) {
      const p = polls[i];
      if (!p.question.trim() || !p.option_a.trim() || !p.option_b.trim()) {
        return toast.error(`Poll ${i + 1}: question and both options required`);
      }
    }
    setSubmitting(true);
    try {
      const { pollCount } = await launchCampaign({
        userId: user.id, name, brandName, brandLogoUrl, description, releaseAt, expiresAt, polls,
      });
      toast.success(`Campaign launched with ${pollCount} polls!`);
      setName(''); setBrandName(''); setPolls([empty(), empty(), empty()]);
      setBrandLogoUrl(''); setDescription(''); setReleaseAt(''); setExpiresAt('');
      qc.invalidateQueries({ queryKey: ['active-brand-campaign'] });
      onLaunched();
    } catch (e: any) {
      toast.error(e.message || 'Failed to launch');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Campaign name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Vodafone Q4 Pulse" />
        </div>
        <div>
          <Label className="text-xs">Brand</Label>
          <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Vodafone" />
        </div>
      </div>

      <div className="space-y-2">
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

      <button
        onClick={() => setAdvanced((v) => !v)}
        className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"
      >
        {advanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        Advanced (logo, description, dates)
      </button>

      {advanced && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-border p-3 bg-muted/20">
          <div className="sm:col-span-2">
            <Label className="text-xs">Brand logo URL</Label>
            <Input value={brandLogoUrl} onChange={(e) => setBrandLogoUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div>
            <Label className="text-xs">Release at</Label>
            <Input type="datetime-local" value={releaseAt} onChange={(e) => setReleaseAt(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Expires at</Label>
            <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
        </div>
      )}

      <Button onClick={handleLaunch} disabled={submitting} className="w-full">
        {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
        Launch Campaign
      </Button>
    </div>
  );
}
