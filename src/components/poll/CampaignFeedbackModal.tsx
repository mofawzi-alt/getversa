import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { ALL_ATTRIBUTES, AttributeKey, CampaignFeedbackConfig, attributeLabel } from '@/hooks/useCampaignFeedbackConfig';

interface Props {
  open: boolean;
  onClose: () => void;
  pollId: string;
  choice: 'A' | 'B';
  optionLabel: string;
  config: CampaignFeedbackConfig;
}

export default function CampaignFeedbackModal({ open, onClose, pollId, choice, optionLabel, config }: Props) {
  const { user, profile } = useAuth();
  const [ratings, setRatings] = useState<Partial<Record<AttributeKey, number>>>({});
  const [verbatim, setVerbatim] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const visibleAttrs = ALL_ATTRIBUTES.filter((a) => config.attributes.includes(a));

  const submit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const demoFields = {
        voter_gender: profile?.gender || null,
        voter_age_range: profile?.age_range || null,
        voter_city: (profile as any)?.city || null,
        voter_country: profile?.country || null,
      };

      const tasks: Array<() => Promise<{ error: any }>> = [];

      if (visibleAttrs.length > 0 && Object.keys(ratings).length > 0) {
        tasks.push(async () => {
          const { error } = await supabase.from('poll_attribute_ratings').upsert(
            {
              poll_id: pollId,
              user_id: user.id,
              choice,
              taste: ratings.taste ?? null,
              quality: ratings.quality ?? null,
              uniqueness: ratings.uniqueness ?? null,
              ease: ratings.ease ?? null,
              versatility: ratings.versatility ?? null,
              ...demoFields,
            },
            { onConflict: 'poll_id,user_id' }
          );
          return { error };
        });
      }

      if (config.verbatim && verbatim.trim().length > 0) {
        tasks.push(async () => {
          const { error } = await supabase.from('poll_verbatim_feedback').upsert(
            {
              poll_id: pollId,
              user_id: user.id,
              choice,
              feedback: verbatim.trim().slice(0, 500),
              ...demoFields,
            },
            { onConflict: 'poll_id,user_id' }
          );
          return { error };
        });
      }

      if (tasks.length > 0) {
        const results = await Promise.all(tasks.map((t) => t()));
        const errs = results.filter((r) => r.error).map((r) => r.error.message);
        if (errs.length) throw new Error(errs[0]);
        toast.success('Thanks for the feedback!');
      }
      onClose();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Could not save feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const setRating = (attr: AttributeKey, val: number) => {
    setRatings((prev) => ({ ...prev, [attr]: val }));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-primary" />
            Quick brand check
          </DialogTitle>
          <DialogDescription className="text-xs">
            Rate <span className="font-semibold text-foreground">{optionLabel}</span> — helps the brand understand why.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto px-1">
          {visibleAttrs.map((attr) => (
            <div key={attr}>
              <div className="text-xs font-medium mb-1.5">{attributeLabel(attr)}</div>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(attr, n)}
                    className={`flex-1 h-9 rounded-lg text-sm font-semibold border transition ${
                      ratings[attr] === n
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/40 border-border hover:bg-muted'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-1">
                <span>Poor</span>
                <span>Excellent</span>
              </div>
            </div>
          ))}

          {config.verbatim && (
            <div>
              <div className="text-xs font-medium mb-1.5">Why did you pick this? (optional)</div>
              <Textarea
                value={verbatim}
                onChange={(e) => setVerbatim(e.target.value.slice(0, 500))}
                placeholder="e.g., great taste, easy to make..."
                className="text-sm min-h-[70px]"
                maxLength={500}
              />
              <div className="text-[10px] text-muted-foreground text-right mt-0.5">{verbatim.length}/500</div>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} className="flex-1" disabled={submitting}>
            Skip
          </Button>
          <Button onClick={submit} className="flex-1" disabled={submitting}>
            {submitting ? 'Saving...' : 'Submit'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
