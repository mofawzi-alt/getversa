import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Loader2, ArrowLeft, Clock, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

interface ExpiredPoll {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  poll_type: string;
  ends_at: string;
  percentA: number;
  percentB: number;
  totalVotes: number;
}

export default function PastPerspectives() {
  const navigate = useNavigate();

  const { data: expiredPolls, isLoading } = useQuery({
    queryKey: ['past-perspectives'],
    queryFn: async () => {
      const now = new Date().toISOString();

      // Fetch expired seasonal/campaign polls
      const { data: polls, error } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, poll_type, ends_at, category')
        .eq('is_active', true)
        .in('poll_type', ['seasonal', 'campaign'])
        .not('ends_at', 'is', null)
        .lt('ends_at', now)
        .order('ends_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      if (!polls || polls.length === 0) return [];

      const pollIds = polls.map(p => p.id);
      const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: pollIds });

      const resultsMap = new Map(
        results?.map((r: any) => [r.poll_id, r]) || []
      );

      return polls.map(p => {
        const r = resultsMap.get(p.id);
        return {
          id: p.id,
          question: p.question,
          option_a: p.option_a,
          option_b: p.option_b,
          poll_type: (p as any).poll_type || 'seasonal',
          ends_at: p.ends_at!,
          percentA: (r?.percent_a as number) || 0,
          percentB: (r?.percent_b as number) || 0,
          totalVotes: (r?.total_votes as number) || 0,
        };
      }).filter(p => p.totalVotes > 0);
    },
    staleTime: 1000 * 60 * 30,
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen p-4 pb-24">
        <header className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-secondary">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-display font-bold">Past Perspectives</h1>
            <p className="text-sm text-muted-foreground">
              Expired polls · View-only results
            </p>
          </div>
        </header>

        {!expiredPolls || expiredPolls.length === 0 ? (
          <div className="rounded-2xl bg-card border border-border p-8 text-center space-y-2">
            <Clock className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground text-sm">No expired polls yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {expiredPolls.map((poll, i) => {
              const winnerIsA = poll.percentA >= poll.percentB;
              return (
                <div
                  key={poll.id}
                  className="rounded-2xl bg-card border border-border p-4 space-y-3 animate-fade-in"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  {/* Type badge + expired label */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {poll.poll_type === 'campaign' ? 'Campaign' : 'Seasonal'}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Ended {formatDistanceToNow(new Date(poll.ends_at), { addSuffix: true })}
                    </span>
                  </div>

                  {/* Question + vote count */}
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-bold leading-snug text-foreground flex-1">
                      {poll.question}
                    </p>
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground whitespace-nowrap shrink-0 pt-0.5">
                      <Users className="h-3 w-3" />
                      {poll.totalVotes.toLocaleString()}
                    </span>
                  </div>

                  {/* Result bar */}
                  <div className="flex h-2 rounded-full overflow-hidden bg-muted/50">
                    <div
                      className="bg-option-a rounded-l-full"
                      style={{ width: `${poll.percentA}%` }}
                    />
                    <div
                      className="bg-option-b rounded-r-full"
                      style={{ width: `${poll.percentB}%` }}
                    />
                  </div>

                  {/* Labels */}
                  <div className="flex justify-between text-xs">
                    <span className={winnerIsA ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                      {poll.option_a} ({poll.percentA}%)
                    </span>
                    <span className={!winnerIsA ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                      {poll.option_b} ({poll.percentB}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
