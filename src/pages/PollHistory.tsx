import { useEffect, useRef, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, ArrowLeft, Users, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { TrendingUp as TrendUp } from 'lucide-react';
import PollOptionImage from '@/components/poll/PollOptionImage';

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
  const winnerIsA = vote.percentA >= vote.percentB;

  return (
    <div className="mx-4">
      {/* Card with trending-style layout */}
      <div className="relative rounded-xl overflow-hidden shadow-card">
        {/* Split images — same 4/5 aspect as trending cards */}
        <div className="flex relative" style={{ aspectRatio: '4/5' }}>
          {/* Option A */}
          <div className="w-1/2 h-full relative overflow-hidden">
            <PollOptionImage
              imageUrl={vote.imageAUrl}
              option={vote.optionA}
              question={vote.question}
              side="A"
              maxLogoSize="55%"
              loading="lazy"
              variant="history"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            {vote.userChoice === 'A' && (
              <div className="absolute inset-0 border-3 border-option-a pointer-events-none z-10" />
            )}
            <div className="absolute bottom-10 left-3">
              <p className="text-white text-base font-extrabold drop-shadow-lg">{vote.optionA}</p>
              <span className="text-lg font-extrabold text-option-a drop-shadow-lg">{vote.percentA}%</span>
              {vote.userChoice === 'A' && (
                <span className="block text-xs font-bold text-option-a drop-shadow-lg mt-0.5">Your vote</span>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="absolute inset-y-0 left-1/2 w-px bg-white/15 z-10" />

          {/* Option B */}
          <div className="w-1/2 h-full relative overflow-hidden">
            <PollOptionImage
              imageUrl={vote.imageBUrl}
              option={vote.optionB}
              question={vote.question}
              side="B"
              maxLogoSize="55%"
              loading="lazy"
              variant="history"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            {vote.userChoice === 'B' && (
              <div className="absolute inset-0 border-3 border-option-b pointer-events-none z-10" />
            )}
            <div className="absolute bottom-10 right-3 text-right">
              <p className="text-white text-base font-extrabold drop-shadow-lg">{vote.optionB}</p>
              <span className="text-lg font-extrabold text-option-b drop-shadow-lg">{vote.percentB}%</span>
              {vote.userChoice === 'B' && (
                <span className="block text-xs font-bold text-option-b drop-shadow-lg mt-0.5">Your vote</span>
              )}
            </div>
          </div>
        </div>

        {/* Question overlay at top — matching trending style */}
        <div className="absolute top-0 inset-x-0 px-3 pt-2.5 pb-6 bg-gradient-to-b from-black/70 to-transparent">
          <h3 className="text-white text-base font-bold drop-shadow-lg leading-snug">{vote.question}</h3>
        </div>

        {/* Winner badge */}
        {winnerIsA ? (
          <div className="absolute top-12 left-2 flex items-center gap-1 px-2 py-1 rounded-full bg-option-a/90 text-option-a-foreground text-xs font-bold z-10">
            <TrendUp className="h-3 w-3" /> Winner
          </div>
        ) : (
          <div className="absolute top-12 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-option-b/90 text-option-b-foreground text-xs font-bold z-10">
            <TrendUp className="h-3 w-3" /> Winner
          </div>
        )}

        {/* Bottom metadata overlay — matching trending style */}
        <div className="absolute bottom-1.5 inset-x-2.5 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            {vote.isLive && (
              <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-bold">LIVE</span>
            )}
            <span className="text-xs text-white/80 font-semibold flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {vote.totalVotes.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {vote.category && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white backdrop-blur-sm">{vote.category}</span>
            )}
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full backdrop-blur-sm ${
              vote.inMajority ? 'bg-primary/30 text-white' : 'bg-white/20 text-white/80'
            }`}>
              {vote.inMajority ? 'Majority' : 'Minority'}
            </span>
          </div>
        </div>
      </div>

      {/* Timestamp below card */}
      <p className="text-xs text-muted-foreground mt-2 px-1">
        {formatDistanceToNow(new Date(vote.votedAt), { addSuffix: true })}
      </p>
    </div>
  );
}

export default function PollHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState('');

  const location = useLocation();
  const targetPollId = new URLSearchParams(location.search).get('pollId');

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
    if (idx >= 0) {
      requestAnimationFrame(() => {
        const container = scrollRef.current;
        if (!container) return;
        const targetEl = container.children[idx] as HTMLElement;
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
  }, [targetPollId, voteHistory]);

  const filteredHistory = useMemo(() => {
    if (!voteHistory) return [];
    if (!searchText.trim()) return voteHistory;
    const q = searchText.toLowerCase();
    return voteHistory.filter(v =>
      v.question.toLowerCase().includes(q) ||
      v.optionA.toLowerCase().includes(q) ||
      v.optionB.toLowerCase().includes(q) ||
      (v.category && v.category.toLowerCase().includes(q))
    );
  }, [voteHistory, searchText]);

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
      <div className="px-3 pt-4 pb-2 flex flex-col gap-2 shrink-0 border-b border-border/20">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-secondary">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-display font-bold text-foreground">My Votes</h1>
            <p className="text-[10px] text-muted-foreground">Results update in real time</p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search polls..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-10 h-9 text-sm"
          />
        </div>
      </div>

      {/* TikTok-style snap scroll */}
      {filteredHistory.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground text-sm">
            {voteHistory && voteHistory.length > 0 ? 'No polls match your search' : "You haven't voted on any polls yet"}
          </p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex-1 basis-0 overflow-y-auto scrollbar-hide px-0 py-3 space-y-4"
        >
          {filteredHistory.map((vote, i) => (
            <div key={vote.pollId} className="w-full">
              <FullScreenHistoryCard vote={vote} index={i} total={filteredHistory.length} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
