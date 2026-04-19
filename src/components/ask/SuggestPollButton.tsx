import { useState } from 'react';
import { Lightbulb, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Props {
  question: string;
  askQueryId?: string | null;
  variant?: 'card' | 'compact';
}

export default function SuggestPollButton({ question, askQueryId, variant = 'card' }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    if (!user) { toast.error('Sign in to suggest polls'); return; }
    if (loading || submitted) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('poll_suggestions').insert({
        user_id: user.id,
        question: question.trim(),
        source: askQueryId ? 'ask_versa' : 'profile',
        ask_query_id: askQueryId || null,
        status: 'pending',
      } as any);
      if (error) throw error;
      setSubmitted(true);
      toast.success('Suggestion sent! Earn +5 credits when it goes live.');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Could not submit');
    } finally {
      setLoading(false);
    }
  };

  if (variant === 'compact') {
    return (
      <button
        onClick={submit}
        disabled={loading || submitted}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-primary/10 text-primary text-[11px] font-bold active:scale-95 transition disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : submitted ? <Check className="h-3 w-3" /> : <Lightbulb className="h-3 w-3" />}
        {submitted ? 'Suggested' : 'Suggest as poll'}
      </button>
    );
  }

  return (
    <button
      onClick={submit}
      disabled={loading || submitted}
      className="w-full flex items-center justify-between gap-2 rounded-2xl bg-primary/5 border border-primary/20 p-3 active:scale-[0.99] transition disabled:opacity-60 text-left"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          {submitted ? <Check className="h-4 w-4 text-primary" /> : <Lightbulb className="h-4 w-4 text-primary" />}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-foreground">
            {submitted ? "We'll build this poll" : 'Want us to build this poll?'}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">
            {submitted ? "You'll get +5 credits + a notification when it's live" : 'Earn +5 Ask credits when it goes live'}
          </p>
        </div>
      </div>
      {loading && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
    </button>
  );
}
