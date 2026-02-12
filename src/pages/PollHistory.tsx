import { useState } from 'react';
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

function HistoryCard({ vote }: { vote: VoteHistoryItem }) {
  const [expanded, setExpanded] = useState(false);
  const userPercent = vote.userChoice === 'A' ? vote.percentA : vote.percentB;

  return (
    <div
      className="glass rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 active:scale-[0.99]"
      onClick={() => setExpanded(prev => !prev)}
    >
      <div className="p-4">
        <p className="font-medium text-sm mb-2">{vote.question}</p>

        {!expanded && (
          <>
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
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
              <span className={`px-2 py-0.5 rounded-full font-medium ${
                vote.inMajority ? 'bg-primary/15 text-primary' : 'bg-warning/15 text-warning'
              }`}>
                {vote.inMajority ? 'With majority' : 'In minority'}
              </span>
              <span>{vote.percentA}% / {vote.percentB}%</span>
              <span>·</span>
              <span>{formatDistanceToNow(new Date(vote.votedAt), { addSuffix: true })}</span>
              <span className="ml-auto text-[10px] text-muted-foreground/60">Tap to view</span>
            </div>
          </>
        )}

        {expanded && (
          <div className="animate-fade-in space-y-3">
            {(vote.imageAUrl || vote.imageBUrl) && (
              <div className="grid grid-cols-2 gap-2">
                {vote.imageAUrl && (
                  <div className={`relative aspect-[4/5] rounded-xl overflow-hidden border-3 ${vote.userChoice === 'A' ? 'border-accent' : 'border-transparent'}`}>
                    <img src={vote.imageAUrl} alt={vote.optionA} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold text-white">{vote.percentA}%</span>
                      {vote.userChoice === 'A' && <span className="text-xs font-semibold text-accent mt-1">Your vote</span>}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6">
                      <p className="text-white text-xs font-bold truncate">{vote.optionA}</p>
                    </div>
                  </div>
                )}
                {vote.imageBUrl && (
                  <div className={`relative aspect-[4/5] rounded-xl overflow-hidden border-3 ${vote.userChoice === 'B' ? 'border-warning' : 'border-transparent'}`}>
                    <img src={vote.imageBUrl} alt={vote.optionB} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold text-white">{vote.percentB}%</span>
                      {vote.userChoice === 'B' && <span className="text-xs font-semibold text-warning mt-1">Your vote</span>}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6">
                      <p className="text-white text-xs font-bold truncate">{vote.optionB}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs">
                <span className={`font-medium min-w-[60px] truncate ${vote.userChoice === 'A' ? 'text-accent' : ''}`}>
                  {vote.optionA}
                </span>
                <div className="flex-1 h-2.5 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full bg-option-a transition-all duration-700" style={{ width: `${vote.percentA}%` }} />
                </div>
                <span className="font-bold text-xs min-w-[32px] text-right">{vote.percentA}%</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className={`font-medium min-w-[60px] truncate ${vote.userChoice === 'B' ? 'text-warning' : ''}`}>
                  {vote.optionB}
                </span>
                <div className="flex-1 h-2.5 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full bg-option-b transition-all duration-700" style={{ width: `${vote.percentB}%` }} />
                </div>
                <span className="font-bold text-xs min-w-[32px] text-right">{vote.percentB}%</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{vote.totalVotes.toLocaleString()} votes</span>
              <span className={`font-semibold px-2 py-0.5 rounded-full text-[10px] ${
                vote.inMajority ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                {vote.inMajority ? 'Majority' : 'Minority'}
              </span>
            </div>
            <p className="text-xs text-center text-foreground/80 font-medium">
              You voted with {userPercent}% of users
            </p>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              {vote.category && (
                <span className="px-2 py-0.5 bg-secondary rounded-full">{vote.category}</span>
              )}
              <span>{formatDistanceToNow(new Date(vote.votedAt), { addSuffix: true })}</span>
            </div>
            <p className="text-[10px] text-center text-muted-foreground/60">Tap to collapse</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PollHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: voteHistory, isLoading } = useQuery({
    queryKey: ['my-votes', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data: votes, error: votesError } = await supabase
        .from('votes')
        .select('poll_id, choice, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (votesError) throw votesError;
      if (!votes || votes.length === 0) return [];

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
          inMajority: userPercent >= 50,
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
        <header className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-secondary">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-display font-bold">My Votes</h1>
            <p className="text-sm text-muted-foreground">
              {voteHistory?.length || 0} votes · Tap any poll to view results
            </p>
          </div>
        </header>

        {!voteHistory || voteHistory.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center">
            <p className="text-muted-foreground">You haven't voted on any polls yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {voteHistory.map((vote) => (
              <HistoryCard key={vote.pollId} vote={vote} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
