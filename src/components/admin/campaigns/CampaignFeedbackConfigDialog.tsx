import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Settings2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ALL_ATTRIBUTES, AttributeKey, attributeLabel } from '@/hooks/useCampaignFeedbackConfig';

interface Props {
  campaignId: string;
  campaignName: string;
}

export default function CampaignFeedbackConfigDialog({ campaignId, campaignName }: Props) {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [verbatim, setVerbatim] = useState(false);
  const [attrs, setAttrs] = useState<Set<AttributeKey>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from('poll_campaigns')
        .select('attribute_config')
        .eq('id', campaignId)
        .maybeSingle();
      const cfg = (data?.attribute_config as any) || {};
      setEnabled(!!cfg.enabled);
      setVerbatim(!!cfg.verbatim);
      setAttrs(new Set((cfg.attributes || []) as AttributeKey[]));
    })();
  }, [open, campaignId]);

  const toggleAttr = (a: AttributeKey) => {
    const n = new Set(attrs);
    n.has(a) ? n.delete(a) : n.add(a);
    setAttrs(n);
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('poll_campaigns')
      .update({
        attribute_config: {
          enabled,
          attributes: Array.from(attrs),
          verbatim,
        },
      })
      .eq('id', campaignId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Feedback config saved');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" title="Feedback config">
          <Settings2 className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Feedback collection · {campaignName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
            <div>
              <div className="text-sm font-semibold">Attribute ratings</div>
              <div className="text-xs text-muted-foreground">Show 1–5 sliders after each vote</div>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {enabled && (
            <div className="space-y-2 pl-2">
              <div className="text-xs font-medium text-muted-foreground">Which attributes?</div>
              {ALL_ATTRIBUTES.map((a) => (
                <label key={a} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/40 cursor-pointer">
                  <span className="text-sm">{attributeLabel(a)}</span>
                  <input
                    type="checkbox"
                    checked={attrs.has(a)}
                    onChange={() => toggleAttr(a)}
                    className="h-4 w-4"
                  />
                </label>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
            <div>
              <div className="text-sm font-semibold">Verbatim feedback</div>
              <div className="text-xs text-muted-foreground">Optional "Why did you pick this?" text</div>
            </div>
            <Switch checked={verbatim} onCheckedChange={setVerbatim} />
          </div>

          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? 'Saving...' : 'Save config'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
