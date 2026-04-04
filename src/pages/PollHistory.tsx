import { useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, ArrowLeft, Users, ChevronDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { TrendingUp as TrendUp } from 'lucide-react';
import LiveIndicator from '@/components/poll/LiveIndicator';
import { getStablePollFallbackImage } from '@/lib/pollImages';

function getFallbackImage(seed: string, index: number): string {
  return getStablePollFallbackImage(seed, index);
}

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
  isLive: boolean;
}

function FullScreenHistoryCard({ vote, index, total }: { vote: VoteHistoryItem; index: number; total: number }) {
  const imgA = vote.imageAUrl || getFallbackImage(vote.pollId, 0);
  const imgB = vote.imageBUrl || getFallbackImage(vote.pollId, 1);
  const winnerIsA = vote.percentA >= vote.percentB;
  const userPercent = vote.userChoice === 'A' ? vote.percentA : vote.percentB;

  return (
    <div className="w-full flex flex-col">
      {/* Question */}
      <div className="px-4 pt-3 pb-2 shrink-0 flex items-start justify-between gap-2">
        <p className="text-sm font-bold text-foreground leading-snug">{vote.question}</p>
        {vote.isLive && <LiveIndicator variant="badge" className="shrink-0 mt-0.5" />}
      </div>

      {/* Split images — proportional aspect ratio */}
      <div className="flex relative mx-4 rounded-2xl overflow-hidden shadow-xl aspect-[4/3]">
        {/* Option A */}
        <div className="w-1/2 h-full relative overflow-hidden">
          <img src={imgA} alt={vote.optionA} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          {winnerIsA && (
            <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-option-a/90 text-option-a-foreground text-[9px] font-bold">
              <TrendUp className="h-2.5 w-2.5" /> Winner
            </div>
          )}
          {vote.userChoice === 'A' && (
            <div className="absolute inset-0 border-2 border-option-a pointer-events-none" />
          )}
          <div className="absolute bottom-0 left-0 right-0 p-2.5 pt-5">
            <p className="text-white text-xs font-bold drop-shadow-lg truncate">{vote.optionA}</p>
          </div>
        </div>

        {/* Divider */}
        <div className="absolute inset-y-0 left-1/2 w-[2px] bg-white/15 z-10" />

        {/* Option B */}
        <div className="w-1/2 h-full relative overflow-hidden">
          <img src={imgB} alt={vote.optionB} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          {!winnerIsA && (
            <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-option-b/90 text-option-b-foreground text-[9px] font-bold">
              <TrendUp className="h-2.5 w-2.5" /> Winner
            </div>
          )}
          {vote.userChoice === 'B' && (
            <div className="absolute inset-0 border-2 border-option-b pointer-events-none" />
          )}
          <div className="absolute bottom-0 left-0 right-0 p-2.5 pt-5">
            <p className="text-white text-xs font-bold drop-shadow-lg truncate">{vote.optionB}</p>
          </div>
        </div>
      </div>

      {/* Results below the image */}
      <div className="mx-4 mt-2 flex justify-between items-center">
        <div className="flex flex-col items-center flex-1">
          <span className="text-2xl font-bold text-option-a">{vote.percentA}%</span>
          {vote.userChoice === 'A' && <span className="text-sm font-bold text-option-a">Your vote</span>}
        </div>
        <div className="flex flex-col items-center flex-1">
          <span className="text-2xl font-bold text-option-b">{vote.percentB}%</span>
          {vote.userChoice === 'B' && <span className="text-sm font-bold text-option-b">Your vote</span>}
        </div>
      </div>

      {/* Result bar + metadata */}
      <div className="px-4 py-3 shrink-0 space-y-2">
        <div className="h-2 bg-muted rounded-full overflow-hidden flex">
          <div className="h-full bg-option-a rounded-l-full" style={{ width: `${vote.percentA}%` }} />
          <div className="h-full bg-option-b rounded-r-full" style={{ width: `${vote.percentB}%` }} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Users className="h-2.5 w-2.5" /> {vote.totalVotes.toLocaleString()} perspectives
          </span>
          <div className="flex items-center gap-2">
            {vote.category && (
              <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-primary/10 text-primary">{vote.category}</span>
            )}
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
              vote.inMajority ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              {vote.inMajority ? 'Majority' : 'Minority'}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(vote.votedAt), { addSuffix: true })}
          </span>
        </div>
        {index < total - 1 && (
          <div className="flex justify-center pt-1 animate-bounce">
            <ChevronDown className="h-4 w-4 text-muted-foreground/40" />
          </div>
        )}
      </div>
    </div>
  );
}

export default function PollHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const searchParams = new URLSearchParams(window.location.search);
  const targetPollId = searchParams.get('pollId');

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
      const resultsMap = new Map(results?.map((r: any) => [r.poll_id, r]) || []);
      return votes.map(v => {
        const poll = pollMap.get(v.poll_id);
        const result = resultsMap.get(v.poll_id);
        if (!poll) return null;
        const percentA = result?.percent_a || 0;
        const percentB = result?.percent_b || 0;
        const userChoice = v.choice as 'A' | 'B';
        const userPercent = userChoice === 'A' ? percentA : percentB;
        const hasStarted = poll.starts_at ? new Date(poll.starts_at) <= new Date() : true;
        const isLive = poll.is_active && hasStarted && (!poll.ends_at || new Date(poll.ends_at) > new Date());
        return {
          pollId: v.poll_id, question: poll.question, optionA: poll.option_a, optionB: poll.option_b,
          imageAUrl: poll.image_a_url, imageBUrl: poll.image_b_url, category: poll.category,
          userChoice, percentA, percentB, totalVotes: result?.total_votes || 0,
          votedAt: v.created_at, inMajority: userPercent >= 50, isLive: !!isLive,
        } as VoteHistoryItem;
      }).filter(Boolean) as VoteHistoryItem[];
    },
    enabled: !!user,
  });

  // Realtime: refresh results when new votes come in
  useEffect(() => {
    const channel = supabase
      .channel('history-votes-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'votes' }, () => {
        queryClient.invalidateQueries({ queryKey: ['my-votes', user?.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient, user?.id]);

  // Deep-link: scroll to targeted poll
  useEffect(() => {
    if (!targetPollId || !voteHistory || !scrollRef.current) return;
    const idx = voteHistory.findIndex(v => v.pollId === targetPollId);
    if (idx > 0) {
      const container = scrollRef.current;
      requestAnimationFrame(() => {
        container.scrollTo({ top: idx * container.clientHeight, behavior: 'smooth' });
      });
    }
  }, [targetPollId, voteHistory]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-secondary/50">
      {/* Top bar */}
      <div className="px-3 pt-4 pb-2 flex items-center gap-3 shrink-0 border-b border-border/20">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-secondary">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-display font-bold text-foreground">My Votes</h1>
          <p className="text-[10px] text-muted-foreground">Results update in real time</p>
        </div>
      </div>

      {/* TikTok-style snap scroll */}
      {!voteHistory || voteHistory.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground text-sm">You haven't voted on any polls yet</p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex-1 basis-0 overflow-y-auto scrollbar-hide px-0 py-3 space-y-4"
        >
          {voteHistory.map((vote, i) => (
            <div key={vote.pollId} className="w-full">
              <FullScreenHistoryCard vote={vote} index={i} total={voteHistory.length} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
