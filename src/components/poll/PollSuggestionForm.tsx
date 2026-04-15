import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lightbulb, Send, CheckCircle2, Clock, X } from 'lucide-react';
import { toast } from 'sonner';

export default function PollSuggestionForm() {
  const { user } = useAuth();
  const [question, setQuestion] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [showForm, setShowForm] = useState(false);

  const { data: suggestions = [], refetch } = useQuery({
    queryKey: ['poll-suggestions', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('poll_suggestions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!user,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Must be logged in');
      const trimmedQ = question.trim();
      const trimmedA = optionA.trim();
      const trimmedB = optionB.trim();
      
      if (!trimmedQ || trimmedQ.length < 5 || trimmedQ.length > 200) {
        throw new Error('Question must be 5-200 characters');
      }
      if (!trimmedA || trimmedA.length > 100 || !trimmedB || trimmedB.length > 100) {
        throw new Error('Options must be 1-100 characters');
      }

      const { error } = await supabase.from('poll_suggestions').insert({
        user_id: user.id,
        question: trimmedQ,
        option_a: trimmedA,
        option_b: trimmedB,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Poll idea submitted! 🎉');
      setQuestion('');
      setOptionA('');
      setOptionB('');
      setShowForm(false);
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to submit');
    },
  });

  const statusIcon = (status: string) => {
    if (status === 'approved') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (status === 'rejected') return <X className="h-4 w-4 text-destructive" />;
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="glass rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-yellow-500" />
          <h3 className="font-bold text-foreground">Suggest a Poll</h3>
        </div>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
            <Send className="h-3.5 w-3.5" /> Submit Idea
          </Button>
        )}
      </div>

      {showForm && (
        <div className="space-y-3 animate-slide-up">
          <Input
            placeholder="Your poll question..."
            value={question}
            onChange={e => setQuestion(e.target.value)}
            maxLength={200}
            className="bg-background"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Option A"
              value={optionA}
              onChange={e => setOptionA(e.target.value)}
              maxLength={100}
              className="bg-background"
            />
            <Input
              placeholder="Option B"
              value={optionB}
              onChange={e => setOptionB(e.target.value)}
              maxLength={100}
              className="bg-background"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending || !question.trim() || !optionA.trim() || !optionB.trim()}
              className="flex-1"
            >
              {submitMutation.isPending ? 'Submitting...' : 'Submit'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground font-medium">Your Submissions</p>
          {suggestions.slice(0, 5).map((s: any) => (
            <div key={s.id} className="flex items-start gap-2 text-sm">
              {statusIcon(s.status)}
              <div className="flex-1 min-w-0">
                <p className="text-foreground truncate">{s.question}</p>
                <p className="text-[10px] text-muted-foreground">{s.option_a} vs {s.option_b}</p>
              </div>
              <span className={`text-[10px] capitalize px-2 py-0.5 rounded-full ${
                s.status === 'approved' ? 'bg-green-100 text-green-700' :
                s.status === 'rejected' ? 'bg-red-100 text-red-700' :
                'bg-muted text-muted-foreground'
              }`}>{s.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
