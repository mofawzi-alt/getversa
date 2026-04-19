import { useState } from 'react';
import { Lightbulb, Loader2, ShieldAlert } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function SuggestPollDialog() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!user) { toast.error('Sign in to suggest polls'); return; }
    const q = question.trim();
    if (q.length < 6) { toast.error('Add a clearer question'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.from('poll_suggestions').insert({
        user_id: user.id,
        question: q,
        option_a: optionA.trim() || null,
        option_b: optionB.trim() || null,
        source: 'profile',
        status: 'pending',
      } as any);
      if (error) throw error;
      toast.success('Suggestion sent! +5 credits when it goes live.');
      setQuestion(''); setOptionA(''); setOptionB('');
      setOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Could not submit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="w-full flex items-center gap-4 p-4 hover:bg-secondary/50 transition-colors">
          <Lightbulb className="h-5 w-5 text-primary" />
          <div className="flex-1 text-left">
            <p className="font-medium">Suggest a poll</p>
            <p className="text-[11px] text-muted-foreground">Earn +5 credits when it goes live</p>
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            Suggest a poll
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Tell us what you want Versa to ask Egypt. If we publish it, you earn <span className="font-bold text-primary">+5 Ask credits</span> + a notification.
          </p>
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Question</label>
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Talabat or Elmenus for late-night orders?"
              maxLength={140}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Option A (optional)</label>
              <input
                value={optionA}
                onChange={(e) => setOptionA(e.target.value)}
                placeholder="Talabat"
                maxLength={40}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Option B (optional)</label>
              <input
                value={optionB}
                onChange={(e) => setOptionB(e.target.value)}
                placeholder="Elmenus"
                maxLength={40}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
              />
            </div>
          </div>
          <Button onClick={submit} disabled={loading} className="w-full h-11">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lightbulb className="h-4 w-4 mr-2" />}
            Send suggestion
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
