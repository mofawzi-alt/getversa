import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Lightbulb, Check, X, ExternalLink, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatDistanceToNow } from 'date-fns';

type Status = 'pending' | 'approved' | 'rejected';

interface Suggestion {
  id: string;
  user_id: string;
  question: string;
  option_a: string | null;
  option_b: string | null;
  category: string | null;
  status: Status;
  source: string;
  ask_query_id: string | null;
  published_poll_id: string | null;
  awarded_credits: number;
  created_at: string;
  published_at: string | null;
}

export default function PollSuggestionsAdmin() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Status>('pending');
  const [linkInput, setLinkInput] = useState<Record<string, string>>({});

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['admin-poll-suggestions', tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('poll_suggestions')
        .select('*')
        .eq('status', tab)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as Suggestion[];
    },
  });

  const reject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('poll_suggestions')
        .update({ status: 'rejected' as any })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Suggestion rejected');
      qc.invalidateQueries({ queryKey: ['admin-poll-suggestions'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed'),
  });

  const approveAndLink = useMutation({
    mutationFn: async ({ id, pollId }: { id: string; pollId: string }) => {
      // Validate poll exists
      const { data: poll, error: pe } = await supabase
        .from('polls').select('id, question').eq('id', pollId).maybeSingle();
      if (pe) throw pe;
      if (!poll) throw new Error('Poll ID not found');

      const { error } = await supabase
        .from('poll_suggestions')
        .update({ status: 'approved' as any, published_poll_id: pollId } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Approved! Suggester earned +5 credits and was notified.');
      qc.invalidateQueries({ queryKey: ['admin-poll-suggestions'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to approve'),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">User-Suggested Polls</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Questions users want Versa to ask. Approving and linking a published poll auto-awards the suggester +5 Ask credits and sends them a notification.
      </p>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Status)}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="space-y-2 mt-4">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!isLoading && suggestions.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              No {tab} suggestions
            </div>
          )}
          {suggestions.map((s) => (
            <div key={s.id} className="rounded-2xl border border-border bg-card p-3.5 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground leading-snug">{s.question}</p>
                  {(s.option_a || s.option_b) && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {s.option_a || '?'} <span className="opacity-50">vs</span> {s.option_b || '?'}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                      {s.source === 'ask_versa' ? '🤖 From Ask Versa' : '👤 From Profile'}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      • {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                    </span>
                    {s.awarded_credits > 0 && (
                      <span className="text-[10px] font-bold text-primary">• +{s.awarded_credits} credits awarded</span>
                    )}
                  </div>
                </div>
              </div>

              {s.status === 'pending' && (
                <div className="space-y-2 pt-1">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Paste published poll ID to approve…"
                      value={linkInput[s.id] || ''}
                      onChange={(e) => setLinkInput((prev) => ({ ...prev, [s.id]: e.target.value }))}
                      className="text-xs h-9"
                    />
                    <Button
                      size="sm"
                      className="h-9 shrink-0"
                      disabled={!linkInput[s.id]?.trim() || approveAndLink.isPending}
                      onClick={() => approveAndLink.mutate({ id: s.id, pollId: linkInput[s.id].trim() })}
                    >
                      {approveAndLink.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="h-3.5 w-3.5 mr-1" />Approve & link</>}
                    </Button>
                  </div>
                  <button
                    onClick={() => reject.mutate(s.id)}
                    disabled={reject.isPending}
                    className="text-[11px] text-muted-foreground hover:text-destructive transition flex items-center gap-1"
                  >
                    <X className="h-3 w-3" /> Reject
                  </button>
                </div>
              )}

              {s.status === 'approved' && s.published_poll_id && (
                <a
                  href={`/poll/${s.published_poll_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary font-bold"
                >
                  <Link2 className="h-3 w-3" /> View published poll <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
