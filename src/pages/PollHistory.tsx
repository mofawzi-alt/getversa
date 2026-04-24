import { useEffect, useRef, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, ArrowLeft, Users, Search, Send, Check, Share2, TrendingUp, Flame } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import PollOptionImage from '@/components/poll/PollOptionImage';
import SharePollToFriendSheet from '@/components/messages/SharePollToFriendSheet';
import LiveIndicator from '@/components/poll/LiveIndicator';
import CategoryBadge from '@/components/category/CategoryBadge';
import PinButton from '@/components/poll/PinButton';
import { mapToVersaCategory } from '@/lib/categoryMeta';
import { useGenderSplitTeaser } from '@/hooks/useGenderSplitTeaser';

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

function FullScreenHistoryCard({ vote, index }: { vote: VoteHistoryItem; index: number; total: number }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const { data: genderTeaser } = useGenderSplitTeaser(
    vote.totalVotes >= 10 ? vote.pollId : '',
    vote.optionA,
    vote.optionB,
    vote.percentA,
    vote.percentB
  );

  const chosenA = vote.userChoice === 'A';
  const chosenB = vote.userChoice === 'B';
  const chosenOptionLabel = chosenA ? vote.optionA : vote.optionB;

  const handleShareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const pollUrl = `${window.location.origin}/poll/${vote.pollId}`;
    if (navigator.share) {
      navigator.share({ title: 'VERSA Poll', text: `📊 ${vote.question}`, url: pollUrl });
    } else {
      navigator.clipboard.writeText(pollUrl);
      import('sonner').then(m => m.toast.success('Link copied!'));
    }
  };

  return (
    <div className="mx-3">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index * 0.025, 0.15), duration: 0.25 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => navigate(`/poll/${vote.pollId}`)}
        className="relative rounded-3xl overflow-hidden border border-border/60 bg-card shadow-md cursor-pointer"
      >
        {/* Question */}
        <div className="px-4 pt-4 pb-4">
          <h3 className="text-[26px] font-extrabold text-foreground leading-[1.1] tracking-tight break-words">
            {vote.question}
          </h3>
        </div>

        {/* Image cards */}
        <div className="px-2 grid grid-cols-2 gap-1.5">
          {/* Option A */}
          <div className={`relative rounded-2xl overflow-hidden border-2 transition-all ${chosenA ? 'border-option-a shadow-md' : 'border-border/40'}`}>
            <div className="relative aspect-[4/5] overflow-hidden">
              <PollOptionImage imageUrl={vote.imageAUrl} option={vote.optionA} question={vote.question} side="A" maxLogoSize="92%" loading="lazy" variant="history" />
              <div className="absolute top-2 right-2 h-7 w-7 rounded-full bg-card shadow-md flex items-center justify-center">
                {chosenA ? (
                  <Check className="h-4 w-4 text-option-a" strokeWidth={3} />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/40" />
                )}
              </div>
            </div>
            <div className="px-3 py-2 bg-card">
              <p className={`text-[14px] font-bold leading-tight break-words ${chosenA ? 'text-option-a' : 'text-foreground'}`}>
                {vote.optionA}
              </p>
            </div>
          </div>

          {/* Option B */}
          <div className={`relative rounded-2xl overflow-hidden border-2 transition-all ${chosenB ? 'border-option-b shadow-md' : 'border-border/40'}`}>
            <div className="relative aspect-[4/5] overflow-hidden">
              <PollOptionImage imageUrl={vote.imageBUrl} option={vote.optionB} question={vote.question} side="B" maxLogoSize="92%" loading="lazy" variant="history" />
              <div className="absolute top-2 right-2 h-7 w-7 rounded-full bg-card shadow-md flex items-center justify-center">
                {chosenB ? (
                  <Check className="h-4 w-4 text-option-b" strokeWidth={3} />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/40" />
                )}
              </div>
            </div>
            <div className="px-3 py-2 bg-card">
              <p className={`text-[14px] font-bold leading-tight break-words ${chosenB ? 'text-option-b' : 'text-foreground'}`}>
                {vote.optionB}
              </p>
            </div>
          </div>
        </div>

        {/* % Bar */}
        <motion.div
          className="px-4 pt-4"
          initial={{ scale: 0.97, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 18, delay: 0.05 }}
        >
          <div className="flex items-center gap-3">
            <span className="text-[24px] font-extrabold text-option-a tabular-nums shrink-0">{vote.percentA}%</span>
            <div className="relative h-3.5 flex-1 rounded-full overflow-hidden flex bg-muted">
              <motion.div className="h-full bg-option-a" initial={{ width: '50%' }} animate={{ width: `${vote.percentA}%` }} transition={{ type: 'spring', stiffness: 140, damping: 16, delay: 0.15 }} />
              <motion.div className="h-full bg-option-b" initial={{ width: '50%' }} animate={{ width: `${vote.percentB}%` }} transition={{ type: 'spring', stiffness: 140, damping: 16, delay: 0.15 }} />
            </div>
            <span className="text-[24px] font-extrabold text-option-b tabular-nums shrink-0">{vote.percentB}%</span>
          </div>
        </motion.div>

        {/* Vote count + Live results */}
        <div className="px-4 pt-2.5 flex items-center justify-between text-[12px]">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span className="font-medium">{vote.totalVotes.toLocaleString()} votes</span>
          </div>
          <div className="flex items-center gap-1.5 text-destructive">
            <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
            <span className="font-medium">Live results</span>
          </div>
        </div>

        {/* Meta pills */}
        <div className="px-4 pt-3 flex items-center gap-2 flex-wrap">
          {vote.isLive && <LiveIndicator variant="badge" />}
          {vote.category && <CategoryBadge category={mapToVersaCategory(vote.category)} size="xs" />}
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${vote.inMajority ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
            {vote.inMajority ? 'Majority' : 'Minority'}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <div onClick={(e) => e.stopPropagation()}>
              <PinButton pollId={vote.pollId} size="sm" className="!bg-muted !text-muted-foreground hover:!bg-muted/80" />
            </div>
          </div>
        </div>

        {/* Insight */}
        {genderTeaser && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.5, type: 'spring', stiffness: 280, damping: 20 }}
            className="mx-4 mt-3 relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-primary/8 to-transparent border border-primary/25 shadow-sm"
          >
            <div className="px-3 py-3 flex items-center gap-3">
              <div className="shrink-0 h-12 w-12 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md">
                <TrendingUp className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-primary mb-0.5">
                  <Flame className="h-3 w-3" />
                  <span>Insight</span>
                </div>
                <p className="text-[13px] font-bold text-foreground leading-snug">{genderTeaser.text}</p>
              </div>
            </div>
          </motion.div>
        )}

        {!genderTeaser && <div className="h-3" />}

        {/* Footer CTA */}
        <div className="border-t border-border/60 bg-card px-4 py-3 flex items-center gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="h-6 w-6 rounded-full bg-success/15 flex items-center justify-center shrink-0">
              <Check className="h-3.5 w-3.5 text-success" strokeWidth={3} />
            </div>
            <span className="text-[13px] font-semibold text-foreground truncate">
              You voted <span className="text-primary">{chosenOptionLabel.length > 14 ? chosenOptionLabel.slice(0, 14) + '…' : chosenOptionLabel}</span>
            </span>
          </div>
          {user && (
            <button
              onClick={(e) => { e.stopPropagation(); setShareSheetOpen(true); }}
              aria-label="Send to friend"
              className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-primary/30 bg-card text-primary text-[12px] font-bold active:scale-95 transition"
            >
              <Send className="h-3.5 w-3.5" /> Send
            </button>
          )}
          <button
            onClick={handleShareClick}
            className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-[12px] font-bold shadow-sm active:scale-95 transition"
          >
            <Share2 className="h-3.5 w-3.5" /> Share
          </button>
        </div>
      </motion.div>

      {/* Timestamp below card */}
      <p className="text-xs text-muted-foreground mt-2 px-1">
        {formatDistanceToNow(new Date(vote.votedAt), { addSuffix: true })}
      </p>

      <SharePollToFriendSheet
        pollId={vote.pollId}
        pollQuestion={vote.question}
        open={shareSheetOpen}
        onOpenChange={setShareSheetOpen}
      />
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
