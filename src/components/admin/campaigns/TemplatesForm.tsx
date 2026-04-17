import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { CAMPAIGN_TEMPLATES, applyTemplate } from '@/lib/campaignTemplates';
import { launchCampaign, DraftPoll } from './launchCampaign';

interface Props { onLaunched: () => void }

export default function TemplatesForm({ onLaunched }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tplId, setTplId] = useState<string>(CAMPAIGN_TEMPLATES[0].id);
  const tpl = useMemo(() => CAMPAIGN_TEMPLATES.find((t) => t.id === tplId)!, [tplId]);

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [brandA, setBrandA] = useState('');
  const [brandB, setBrandB] = useState('');
  const [polls, setPolls] = useState<DraftPoll[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const generate = () => {
    if (tpl.needsTwoBrands) {
      if (!brandA.trim() || !brandB.trim()) return toast.error('Both brand names required');
    } else if (!brand.trim()) {
      return toast.error('Brand name required');
    }
    const generated = applyTemplate(tpl, { brand, brandA, brandB });
    setPolls(generated);
  };

  const update = (i: number, patch: Partial<DraftPoll>) =>
    setPolls((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  const handleLaunch = async () => {
    if (!user) return;
    if (!name.trim()) return toast.error('Campaign name required');
    if (polls.length === 0) return toast.error('Generate polls from template first');
    setSubmitting(true);
    try {
      const brandName = tpl.needsTwoBrands ? `${brandA} vs ${brandB}` : brand;
      const { pollCount } = await launchCampaign({
        userId: user.id, name, brandName, polls,
      });
      toast.success(`Launched ${pollCount} polls from "${tpl.name}"`);
      setName(''); setBrand(''); setBrandA(''); setBrandB(''); setPolls([]);
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {CAMPAIGN_TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTplId(t.id); setPolls([]); }}
            className={`text-left rounded-xl border p-3 transition ${
              tplId === t.id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/40'
            }`}
          >
            <div className="text-sm font-semibold">{t.name}</div>
            <div className="text-xs text-muted-foreground">{t.tagline}</div>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border p-3 bg-muted/20 space-y-3">
        <p className="text-xs text-muted-foreground">{tpl.description}</p>
        <div>
          <Label className="text-xs">Campaign name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`${tpl.name} – ${new Date().toLocaleDateString()}`} />
        </div>
        {tpl.needsTwoBrands ? (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Brand A</Label>
              <Input value={brandA} onChange={(e) => setBrandA(e.target.value)} placeholder="Coca-Cola" />
            </div>
            <div>
              <Label className="text-xs">Brand B</Label>
              <Input value={brandB} onChange={(e) => setBrandB(e.target.value)} placeholder="Pepsi" />
            </div>
          </div>
        ) : (
          <div>
            <Label className="text-xs">Brand</Label>
            <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Vodafone" />
          </div>
        )}
        <Button size="sm" variant="outline" onClick={generate} className="w-full">
          <Sparkles className="w-4 h-4 mr-1" /> Generate poll drafts
        </Button>
      </div>

      {polls.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Drafts ({polls.length}) — edit before launching</Label>
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
