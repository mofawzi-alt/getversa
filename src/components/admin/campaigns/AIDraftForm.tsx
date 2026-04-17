import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { launchCampaign, DraftPoll } from './launchCampaign';

interface Props { onLaunched: () => void }

export default function AIDraftForm({ onLaunched }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [goal, setGoal] = useState('');
  const [count, setCount] = useState(5);
  const [polls, setPolls] = useState<DraftPoll[]>([]);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const generate = async () => {
    if (!brand.trim() || !goal.trim()) return toast.error('Brand and goal required');
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-campaign-polls', {
        body: { brand: brand.trim(), goal: goal.trim(), count },
      });
      if (error) throw error;
      const generated = (data?.polls || []) as DraftPoll[];
      if (!generated.length) throw new Error('No polls returned');
      setPolls(generated);
      toast.success(`Generated ${generated.length} drafts`);
    } catch (e: any) {
      toast.error(e.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const update = (i: number, patch: Partial<DraftPoll>) =>
    setPolls((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  const handleLaunch = async () => {
    if (!user) return;
    if (!name.trim()) return toast.error('Campaign name required');
    if (polls.length === 0) return toast.error('Generate drafts first');
    setSubmitting(true);
    try {
      const { pollCount } = await launchCampaign({
        userId: user.id, name, brandName: brand, polls,
      });
      toast.success(`Launched ${pollCount} AI-drafted polls`);
      setName(''); setBrand(''); setGoal(''); setPolls([]);
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
      <div className="rounded-xl border border-border p-3 bg-muted/20 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Campaign name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Vodafone Gen Z Pulse" />
          </div>
          <div>
            <Label className="text-xs">Brand</Label>
            <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Vodafone" />
          </div>
        </div>
        <div>
          <Label className="text-xs">Topic / goal</Label>
          <Textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={2}
            placeholder="Understand how Gen Z perceives our prepaid plans vs competitors"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Polls</Label>
          <Input
            type="number"
            min={3}
            max={10}
            value={count}
            onChange={(e) => setCount(Math.max(3, Math.min(10, Number(e.target.value) || 5)))}
            className="w-20"
          />
          <Button size="sm" variant="outline" onClick={generate} disabled={generating} className="ml-auto">
            {generating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1" />}
            Generate
          </Button>
        </div>
      </div>

      {polls.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-semibold">AI drafts ({polls.length}) — edit before launching</Label>
          {polls.map((p, i) => (
            <div key={i} className="rounded-xl border border-border p-3 space-y-2 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Poll {i + 1}</span>
                <button onClick={() => setPolls((prev) => prev.filter((_, idx) => idx !== i))} className="text-destructive hover:opacity-70">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <Input value={p.question} onChange={(e) => update(i, { question: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Input value={p.option_a} onChange={(e) => update(i, { option_a: e.target.value })} />
                <Input value={p.option_b} onChange={(e) => update(i, { option_b: e.target.value })} />
              </div>
            </div>
          ))}
          <Button onClick={handleLaunch} disabled={submitting} className="w-full">
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Launch Campaign
          </Button>
        </div>
      )}
    </div>
  );
}
