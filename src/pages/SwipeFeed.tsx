import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Home, Users, TrendingUp as TrendUp } from 'lucide-react';
import CaughtUpInsights from '@/components/feed/CaughtUpInsights';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { playSwipeSound, playResultSound } from '@/lib/sounds';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

import beachImg from '@/assets/polls/beach.jpg';
import cityImg from '@/assets/polls/city.jpg';
import mountainsImg from '@/assets/polls/mountains.jpg';
import natureImg from '@/assets/polls/nature.jpg';
import sunsetImg from '@/assets/polls/sunset.jpg';
import sunriseImg from '@/assets/polls/sunrise.jpg';
import coffeeImg from '@/assets/polls/coffee.jpg';
import teaImg from '@/assets/polls/tea.jpg';
import pizzaImg from '@/assets/polls/pizza.jpg';
import sushiImg from '@/assets/polls/sushi.jpg';
import catsImg from '@/assets/polls/cats.jpg';
import dogsImg from '@/assets/polls/dogs.jpg';
import summerImg from '@/assets/polls/summer.jpg';
import winterImg from '@/assets/polls/winter.jpg';
import sneakersImg from '@/assets/polls/sneakers.jpg';
import bootsImg from '@/assets/polls/boots.jpg';
import booksImg from '@/assets/polls/books.jpg';
import moviesImg from '@/assets/polls/movies.jpg';
import daySkyImg from '@/assets/polls/day-sky.jpg';
import nightSkyImg from '@/assets/polls/night-sky.jpg';

const FALLBACK_IMAGES = [
  beachImg, cityImg, mountainsImg, natureImg, sunsetImg, sunriseImg,
  coffeeImg, teaImg, pizzaImg, sushiImg, catsImg, dogsImg,
  summerImg, winterImg, sneakersImg, bootsImg, booksImg, moviesImg,
  daySkyImg, nightSkyImg,
];

function getFallbackImage(seed: string, index: number): string {
  const hash = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return FALLBACK_IMAGES[(hash + index) % FALLBACK_IMAGES.length];
}

const GUEST_VOTE_LIMIT = 3;
const GUEST_VOTES_KEY = 'versa_guest_votes';
const SWIPE_THRESHOLD = 60;
const RESULT_DISPLAY_MS = 1200;

function getGuestVoteCount(): number {
  try { return parseInt(localStorage.getItem(GUEST_VOTES_KEY) || '0', 10); } catch { return 0; }
}
function incrementGuestVotes(): number {
  const count = getGuestVoteCount() + 1;
  localStorage.setItem(GUEST_VOTES_KEY, String(count));
  return count;
}

interface Poll {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  category: string | null;
  image_a_url: string | null;
  image_b_url: string | null;
  is_sponsored?: boolean;
  sponsor_name?: string;
  sponsor_logo_url?: string;
  starts_at?: string | null;
  ends_at?: string | null;
  is_daily_poll?: boolean;
  created_by?: string | null;
  creator_username?: string | null;
}

interface VoteResult {
  pollId: string;
  choice: 'A' | 'B';
  percentA: number;
  percentB: number;
  totalVotes: number;
}

// ── Swipeable Poll Card ──
function SwipeablePollCard({
  poll,
  result,
  onVote,
  disabled,
}: {
  poll: Poll;
  result: VoteResult | null;
  onVote: (pollId: string, choice: 'A' | 'B') => void;
  disabled: boolean;
}) {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const hasResult = !!result;
  const imgA = poll.image_a_url || getFallbackImage(poll.id, 0);
  const imgB = poll.image_b_url || getFallbackImage(poll.id, 1);
  const winnerIsA = result ? result.percentA >= result.percentB : true;
  const highlightIntensity = Math.min(Math.abs(dragX) / SWIPE_THRESHOLD, 1);

  const handleStart = (clientX: number) => {
    if (hasResult || disabled) return;
    setIsDragging(true);
    startX.current = clientX;
  };
  const handleMove = (clientX: number) => {
    if (!isDragging) return;
    setDragX(clientX - startX.current);
  };
  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragX < -SWIPE_THRESHOLD) {
      onVote(poll.id, 'A');
    } else if (dragX > SWIPE_THRESHOLD) {
      onVote(poll.id, 'B');
    }
    setDragX(0);
  };

  const rotation = Math.sign(dragX) * Math.min(Math.abs(dragX), 150) / 150 * 8;

  return (
    <div
      className={`rounded-2xl overflow-hidden bg-card border border-border/30 ${!hasResult && !disabled ? 'cursor-grab active:cursor-grabbing' : ''}`}
      style={{
        transform: hasResult ? 'none' : `translateX(${dragX}px) rotate(${rotation}deg)`,
        transition: isDragging ? 'none' : 'transform 0.3s ease-out',
      }}
      onTouchStart={(e) => handleStart(e.touches[0].clientX)}
      onTouchMove={(e) => { handleMove(e.touches[0].clientX); if (Math.abs(dragX) > 10) e.preventDefault(); }}
      onTouchEnd={handleEnd}
      onMouseDown={(e) => { e.preventDefault(); handleStart(e.clientX); }}
      onMouseMove={(e) => handleMove(e.clientX)}
      onMouseUp={handleEnd}
      onMouseLeave={() => isDragging && handleEnd()}
    >
      {/* Question */}
      <div className="px-3 py-2">
        <p className="text-xs font-bold text-foreground">{poll.question}</p>
      </div>

      {/* Split images — h-40 matching Home */}
      <div className="flex h-40 relative">
        {/* Option A */}
        <div
          className="w-1/2 h-full relative overflow-hidden transition-transform duration-200"
          style={{
            transform: !hasResult && dragX < -20 ? `scale(${1 + highlightIntensity * 0.03})` : 'scale(1)',
          }}
        >
          <img src={imgA} alt={poll.option_a} className="w-full h-full object-cover" draggable={false} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          {hasResult && winnerIsA && (
            <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/90 text-primary-foreground text-[9px] font-bold">
              <TrendUp className="h-2.5 w-2.5" /> Winner
            </div>
          )}
          {hasResult && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center animate-fade-in">
              <span className="text-2xl font-bold text-white">{result!.percentA}%</span>
            </div>
          )}
          {hasResult && result?.choice === 'A' && (
            <div className="absolute inset-0 border-2 border-accent pointer-events-none" />
          )}
          {!hasResult && dragX < -20 && (
            <div className="absolute inset-0 border-2 border-accent/60 pointer-events-none" style={{ opacity: highlightIntensity }} />
          )}
          <div className="absolute bottom-2 left-2 right-1">
            <p className="text-white text-xs font-bold drop-shadow-lg truncate">{poll.option_a}</p>
          </div>
        </div>

        <div className="absolute inset-y-0 left-1/2 w-px bg-background/15 z-10" />

        {/* Option B */}
        <div
          className="w-1/2 h-full relative overflow-hidden transition-transform duration-200"
          style={{
            transform: !hasResult && dragX > 20 ? `scale(${1 + highlightIntensity * 0.03})` : 'scale(1)',
          }}
        >
          <img src={imgB} alt={poll.option_b} className="w-full h-full object-cover" draggable={false} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          {hasResult && !winnerIsA && (
            <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-accent/90 text-accent-foreground text-[9px] font-bold">
              <TrendUp className="h-2.5 w-2.5" /> Winner
            </div>
          )}
          {hasResult && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center animate-fade-in">
              <span className="text-2xl font-bold text-white">{result!.percentB}%</span>
            </div>
          )}
          {hasResult && result?.choice === 'B' && (
            <div className="absolute inset-0 border-2 border-warning pointer-events-none" />
          )}
          {!hasResult && dragX > 20 && (
            <div className="absolute inset-0 border-2 border-warning/60 pointer-events-none" style={{ opacity: highlightIntensity }} />
          )}
          <div className="absolute bottom-2 left-1 right-2 text-right">
            <p className="text-white text-xs font-bold drop-shadow-lg truncate">{poll.option_b}</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      {hasResult ? (
        <div className="px-3 py-2 space-y-1.5">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden flex">
            <div className="h-full bg-accent rounded-l-full" style={{ width: `${result!.percentA}%`, transition: 'width 0.7s ease-out' }} />
            <div className="h-full bg-warning rounded-r-full" style={{ width: `${result!.percentB}%`, transition: 'width 0.7s ease-out' }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Users className="h-2.5 w-2.5" /> {result!.totalVotes} perspectives
            </span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
              result!.choice === 'A' ? 'bg-accent/15 text-accent' : 'bg-warning/15 text-warning'
            }`}>
              You picked {result!.choice === 'A' ? poll.option_a : poll.option_b}
            </span>
          </div>
        </div>
      ) : (
        <div className="px-3 py-2 flex justify-center gap-6 text-[10px] text-muted-foreground">
          <span>← {poll.option_a.length > 14 ? poll.option_a.slice(0, 14) + '…' : poll.option_a}</span>
          <span>{poll.option_b.length > 14 ? poll.option_b.slice(0, 14) + '…' : poll.option_b} →</span>
        </div>
      )}
    </div>
  );
}

// ── Main Feed ──
export default function SwipeFeed() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [votedResults, setVotedResults] = useState<Map<string, VoteResult>>(new Map());
  const [showSignupModal, setShowSignupModal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const searchParams = new URLSearchParams(window.location.search);
  const targetPollId = searchParams.get('pollId');

  const { data: polls, isLoading, refetch } = useQuery({
    queryKey: ['feed-polls', user?.id],
    queryFn: async () => {
      let votedIds: string[] = [];
      if (user) {
        const { data: userVotes } = await supabase.from('votes').select('poll_id').eq('user_id', user.id);
        votedIds = userVotes?.map(v => v.poll_id) || [];
      }
      let query = supabase.from('polls').select('*').eq('is_active', true).neq('is_archived', true)
        .order('is_daily_poll', { ascending: false }).order('created_at', { ascending: false });
      if (votedIds.length > 0) query = query.not('id', 'in', `(${votedIds.join(',')})`);
      query = query.limit(60);
      const { data: fetchedPolls, error } = await query;
      if (error) throw error;
      let allPolls = fetchedPolls || [];
      if (profile) {
        allPolls = allPolls.filter(p => {
          if (p.target_gender && p.target_gender !== 'All' && profile.gender && p.target_gender !== profile.gender) return false;
          if (p.target_age_range && p.target_age_range !== 'All' && profile.age_range && p.target_age_range !== profile.age_range) return false;
          if (p.target_country && p.target_country !== 'All' && profile.country && p.target_country !== profile.country) return false;
          return true;
        });
      }
      if (targetPollId) {
        const idx = allPolls.findIndex(p => p.id === targetPollId);
        if (idx > 0) { const [t] = allPolls.splice(idx, 1); allPolls.unshift(t); }
      }
      return allPolls;
    },
  });

  useEffect(() => {
    const ch = supabase.channel('polls-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'polls' }, () => {
        queryClient.invalidateQueries({ queryKey: ['feed-polls'] });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queryClient]);

  const voteMutation = useMutation({
    mutationFn: async ({ pollId, choice }: { pollId: string; choice: 'A' | 'B' }) => {
      if (!user) {
        const count = incrementGuestVotes();
        if (count > GUEST_VOTE_LIMIT) { setShowSignupModal(true); throw new Error('GUEST_LIMIT'); }
        const percentA = choice === 'A' ? 100 : 0;
        if (count >= GUEST_VOTE_LIMIT) setTimeout(() => setShowSignupModal(true), 2000);
        return { pollId, choice, percentA, percentB: 100 - percentA, totalVotes: 1 };
      }
      const { error: voteError } = await supabase.from('votes').insert({ poll_id: pollId, user_id: user.id, choice });
      if (voteError) throw voteError;
      const { data: votes } = await supabase.from('votes').select('choice').eq('poll_id', pollId);
      const totalVotes = votes?.length || 0;
      const aVotes = votes?.filter(v => v.choice === 'A').length || 0;
      const percentA = totalVotes > 0 ? Math.round((aVotes / totalVotes) * 100) : 0;
      return { pollId, choice, percentA, percentB: totalVotes > 0 ? 100 - percentA : 0, totalVotes };
    },
    onSuccess: (data) => {
      playResultSound();
      setVotedResults(prev => new Map(prev).set(data.pollId, data));
      // Auto-scroll to next unvoted poll after showing results
      setTimeout(() => {
        if (!polls) return;
        const idx = polls.findIndex(p => p.id === data.pollId);
        const updatedVoted = new Map(votedResults).set(data.pollId, data);
        // Find the next unvoted poll
        const nextUnvoted = polls.find((p, i) => i > idx && !updatedVoted.has(p.id));
        if (nextUnvoted) {
          const nextEl = cardRefs.current.get(nextUnvoted.id);
          nextEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          // All polls voted — scroll to bottom to show caught-up state
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }
      }, RESULT_DISPLAY_MS);
    },
    onError: (error: any) => {
      if (error.message === 'GUEST_LIMIT') return;
      if (error.message === 'ALREADY_VOTED' || error.message?.includes('duplicate')) { toast.error('You already voted on this poll'); return; }
      toast.error('Failed to vote');
    },
  });

  const handleVote = useCallback((pollId: string, choice: 'A' | 'B') => {
    if (votedResults.has(pollId)) return;
    if (!user && getGuestVoteCount() >= GUEST_VOTE_LIMIT) { setShowSignupModal(true); return; }
    playSwipeSound();
    voteMutation.mutate({ pollId, choice });
  }, [voteMutation, user, votedResults]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasPolls = polls && polls.length > 0;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div className="px-4 pt-3 pb-1 shrink-0">
        <h1 className="text-lg font-display font-bold text-foreground tracking-tight">Vote</h1>
        <p className="text-[10px] text-muted-foreground">{polls?.length || 0} polls · swipe left or right to vote</p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 pb-6 space-y-3 scrollbar-hide">
        {hasPolls ? (
          polls.map((poll, i) => (
            <motion.div
              key={poll.id}
              ref={(el) => { if (el) cardRefs.current.set(poll.id, el); }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.4), type: 'spring', stiffness: 260, damping: 24 }}
            >
              <SwipeablePollCard
                poll={poll}
                result={votedResults.get(poll.id) || null}
                onVote={handleVote}
                disabled={voteMutation.isPending}
              />
            </motion.div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center pt-20">
            <CaughtUpInsights onRefresh={() => { setVotedResults(new Map()); refetch(); }} />
            <div className="mt-4 px-2 w-full max-w-sm">
              <Button onClick={() => navigate('/')} variant="outline" className="w-full gap-2 h-12 rounded-xl border-border">
                <Home className="h-4 w-4" /> Back to Home
              </Button>
            </div>
          </div>
        )}

        {/* Show caught-up when all polls have been voted on */}
        {hasPolls && polls.every(p => votedResults.has(p.id)) && (
          <div className="flex flex-col items-center justify-center pt-8 pb-4">
            <CaughtUpInsights onRefresh={() => { setVotedResults(new Map()); refetch(); }} />
            <div className="mt-4 px-2 w-full max-w-sm">
              <Button onClick={() => navigate('/')} variant="outline" className="w-full gap-2 h-12 rounded-xl border-border">
                <Home className="h-4 w-4" /> Back to Home
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showSignupModal} onOpenChange={setShowSignupModal}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Create an account</DialogTitle>
            <DialogDescription>Sign up to keep voting and track your results.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Button onClick={() => navigate('/auth')} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold h-12 rounded-full">Sign Up Free</Button>
            <Button variant="ghost" onClick={() => setShowSignupModal(false)} className="w-full text-muted-foreground">Maybe later</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
