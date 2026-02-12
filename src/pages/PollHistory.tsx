import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Loader2, ArrowLeft } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface VoteHistoryItem {
  pollId: string;
  question: string;
  optionA: string;
  optionB: string;
  imageAUrl: string | null;
  imageBUrl: string | null;
  category: string | null;
  userChoice: 'A' | 'B';
  percentA: number;
  percentB: number;
  totalVotes: number;
  votedAt: string;
  inMajority: boolean;
}

export default function PollHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: voteHistory, isLoading } = useQuery({
    queryKey: ['my-votes', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get user's votes
      const { data: votes, error: votesError } = await supabase
        .from('votes')
        .select('poll_id, choice, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (votesError) throw votesError;
      if (!votes || votes.length === 0) return [];

      // Get poll details
      const pollIds = votes.map(v => v.poll_id);
      const { data: polls } = await supabase.rpc('get_all_polls_for_history');
      const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: pollIds });

      const pollMap = new Map(polls?.map(p => [p.id, p]) || []);
      const resultsMap = new Map(
        results?.map((r: any) => [r.poll_id, r]) || []
      );

      return votes.map(v => {
        const poll = pollMap.get(v.poll_id);
        const result = resultsMap.get(v.poll_id);
        if (!poll) return null;

        const percentA = result?.percent_a || 0;
        const percentB = result?.percent_b || 0;
        const userChoice = v.choice as 'A' | 'B';
        const userPercent = userChoice === 'A' ? percentA : percentB;
        const inMajority = userPercent >= 50;

        return {
          pollId: v.poll_id,
          question: poll.question,
          optionA: poll.option_a,
          optionB: poll.option_b,
          imageAUrl: poll.image_a_url,
          imageBUrl: poll.image_b_url,
          category: poll.category,
          userChoice,
          percentA,
          percentB,
          totalVotes: result?.total_votes || 0,
          votedAt: v.created_at,
          inMajority,
        } as VoteHistoryItem;
      }).filter(Boolean) as VoteHistoryItem[];
    },
    enabled: !!user,
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
        {/* Header */}
        <header className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-secondary">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-display font-bold">My Votes</h1>
            <p className="text-sm text-muted-foreground">
              {voteHistory?.length || 0} votes · Read-only archive
            </p>
          </div>
        </header>

        {/* Vote List */}
        {!voteHistory || voteHistory.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center">
            <p className="text-muted-foreground">You haven't voted on any polls yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {voteHistory.map((vote) => (
              <div key={vote.pollId} className="glass rounded-2xl p-4">
                {/* Poll question */}
                <p className="font-medium text-sm mb-2">{vote.question}</p>

                {/* Images */}
                {(vote.imageAUrl || vote.imageBUrl) && (
                  <div className="flex gap-2 mb-3">
                    {vote.imageAUrl && (
                      <div className={`w-14 h-14 rounded-lg overflow-hidden border-2 ${vote.userChoice === 'A' ? 'border-option-a' : 'border-transparent'}`}>
                        <img src={vote.imageAUrl} alt={vote.optionA} className="w-full h-full object-cover" />
                      </div>
                    )}
                    {vote.imageBUrl && (
                      <div className={`w-14 h-14 rounded-lg overflow-hidden border-2 ${vote.userChoice === 'B' ? 'border-option-b' : 'border-transparent'}`}>
                        <img src={vote.imageBUrl} alt={vote.optionB} className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                )}

                {/* Results bar */}
                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`font-medium ${vote.userChoice === 'A' ? 'text-option-a' : ''}`}>
                      {vote.optionA}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full bg-option-a" style={{ width: `${vote.percentA}%` }} />
                    </div>
                    <span className="font-bold text-xs">{vote.percentA}%</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`font-medium ${vote.userChoice === 'B' ? 'text-option-b' : ''}`}>
                      {vote.optionB}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full bg-option-b" style={{ width: `${vote.percentB}%` }} />
                    </div>
                    <span className="font-bold text-xs">{vote.percentB}%</span>
                  </div>
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                  <span className={`px-2 py-0.5 rounded-full font-medium ${
                    vote.inMajority 
                      ? 'bg-primary/15 text-primary' 
                      : 'bg-warning/15 text-warning'
                  }`}>
                    {vote.inMajority ? 'With majority' : 'In minority'}
                  </span>
                  {vote.category && (
                    <span className="px-2 py-0.5 bg-secondary rounded-full">{vote.category}</span>
                  )}
                  <span>{vote.totalVotes.toLocaleString()} votes</span>
                  <span>·</span>
                  <span>{formatDistanceToNow(new Date(vote.votedAt), { addSuffix: true })}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
