import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Home, Users, TrendingUp as TrendUp, Zap } from 'lucide-react';
import CaughtUpInsights from '@/components/feed/CaughtUpInsights';
import VoteFeedbackOverlay, { AnimatedPercent } from '@/components/feed/VoteFeedbackOverlay';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
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
const RESULT_DISPLAY_MS = 1800;

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

// ── Full-Screen Immersive Poll Card ──
function ImmersivePollCard({
  poll,
  result,
  onVote,
  disabled,
  showFeedback,
}: {
  poll: Poll;
  result: VoteResult | null;
  onVote: (pollId: string, choice: 'A' | 'B') => void;
  disabled: boolean;
  showFeedback: boolean;
}) {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [flyDirection, setFlyDirection] = useState<'left' | 'right' | null>(null);
  const startX = useRef(0);
  const hasResult = !!result;
  const imgA = poll.image_a_url || getFallbackImage(poll.id, 0);
  const imgB = poll.image_b_url || getFallbackImage(poll.id, 1);
  const winnerIsA = result ? result.percentA >= result.percentB : true;
  const THRESHOLD = 80;

  const handleStart = (clientX: number) => {
    if (hasResult || disabled || flyDirection) return;
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
    if (dragX < -THRESHOLD) {
      setFlyDirection('left');
      setTimeout(() => onVote(poll.id, 'A'), 300);
    } else if (dragX > THRESHOLD) {
      setFlyDirection('right');
      setTimeout(() => onVote(poll.id, 'B'), 300);
    }
    if (Math.abs(dragX) <= THRESHOLD) setDragX(0);
  };

  useEffect(() => {
    if (hasResult) setFlyDirection(null);
  }, [hasResult]);

  const rotation = flyDirection
    ? (flyDirection === 'left' ? -15 : 15)
    : Math.sign(dragX) * Math.min(Math.abs(dragX), 200) / 200 * 12;

  const translateX = flyDirection
    ? (flyDirection === 'left' ? -window.innerWidth * 1.5 : window.innerWidth * 1.5)
    : dragX;

  const choiceOpacity = Math.min(Math.abs(dragX) / THRESHOLD, 1);
  const showA = dragX < -20;
  const showB = dragX > 20;

  const selectedGlow = result?.choice === 'A'
    ? 'shadow-[inset_0_0_30px_rgba(120,255,120,0.15)]'
    : result?.choice === 'B'
    ? 'shadow-[inset_0_0_30px_rgba(255,200,60,0.15)]'
    : '';

  return (
    <div className="w-full relative flex flex-col">
      {/* Swipeable card area */}
      <div className="flex-1 relative min-h-0 flex items-center justify-center">
        {/* Choice indicators behind the card */}
        {!hasResult && (
          <>
            <div className="absolute inset-0 flex items-center justify-start pl-6 z-0">
              <motion.div
                animate={{ opacity: showA ? choiceOpacity : 0, scale: showA ? 1 : 0.8 }}
                className="flex flex-col items-center gap-1"
              >
                <div className="w-14 h-14 rounded-full bg-accent/20 border-2 border-accent flex items-center justify-center">
                  <span className="text-accent font-display font-bold text-xl">A</span>
                </div>
                <span className="text-accent text-[10px] font-bold max-w-16 text-center truncate">{poll.option_a}</span>
              </motion.div>
            </div>
            <div className="absolute inset-0 flex items-center justify-end pr-6 z-0">
              <motion.div
                animate={{ opacity: showB ? choiceOpacity : 0, scale: showB ? 1 : 0.8 }}
                className="flex flex-col items-center gap-1"
              >
                <div className="w-14 h-14 rounded-full bg-warning/20 border-2 border-warning flex items-center justify-center">
                  <span className="text-warning font-display font-bold text-xl">B</span>
                </div>
                <span className="text-warning text-[10px] font-bold max-w-16 text-center truncate">{poll.option_b}</span>
              </motion.div>
            </div>
          </>
        )}

        {/* The card itself */}
        <div
          className={`w-full max-w-sm mx-auto rounded-2xl overflow-hidden shadow-2xl z-10 ${!hasResult && !disabled ? 'cursor-grab active:cursor-grabbing' : ''} ${hasResult ? selectedGlow : ''}`}
          style={{
            transform: hasResult ? 'none' : `translateX(${translateX}px) rotate(${rotation}deg)`,
            transition: isDragging ? 'none' : flyDirection ? 'transform 0.4s ease-in' : 'transform 0.3s ease-out',
            opacity: flyDirection ? 0 : 1,
          }}
          onTouchStart={(e) => handleStart(e.touches[0].clientX)}
          onTouchMove={(e) => { handleMove(e.touches[0].clientX); if (Math.abs(dragX) > 10) e.preventDefault(); }}
          onTouchEnd={handleEnd}
          onMouseDown={(e) => { e.preventDefault(); handleStart(e.clientX); }}
          onMouseMove={(e) => handleMove(e.clientX)}
          onMouseUp={handleEnd}
          onMouseLeave={() => isDragging && handleEnd()}
        >
          {/* Split images */}
          <div className="flex aspect-[4/3] w-full">
            <div className="w-1/2 h-full relative overflow-hidden">
              <img src={imgA} alt={poll.option_a} className="w-full h-full object-cover" draggable={false} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
              {hasResult && winnerIsA && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 }}
                  className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/90 text-primary-foreground text-[9px] font-bold backdrop-blur-sm"
                >
                  <TrendUp className="h-2.5 w-2.5" /> Winner
                </motion.div>
              )}
              {hasResult && result?.choice === 'A' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, boxShadow: ['inset 0 0 20px rgba(120,255,120,0.3)', 'inset 0 0 40px rgba(120,255,120,0.1)', 'inset 0 0 20px rgba(120,255,120,0.3)'] }}
                  transition={{ boxShadow: { duration: 2, repeat: Infinity } }}
                  className="absolute inset-0 border-3 border-accent rounded-l-2xl pointer-events-none"
                />
              )}
              <div className="absolute bottom-2 left-2 right-1">
                <p className="text-white text-xs font-bold drop-shadow-lg">{poll.option_a}</p>
                {hasResult && (
                  <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold text-accent drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                    <AnimatedPercent target={result!.percentA} />
                  </motion.span>
                )}
              </div>
            </div>

            <div className="absolute inset-y-0 left-1/2 w-[2px] bg-white/15 z-10" />

            <div className="w-1/2 h-full relative overflow-hidden">
              <img src={imgB} alt={poll.option_b} className="w-full h-full object-cover" draggable={false} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
              {hasResult && !winnerIsA && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 }}
                  className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-accent/90 text-accent-foreground text-[9px] font-bold backdrop-blur-sm"
                >
                  <TrendUp className="h-2.5 w-2.5" /> Winner
                </motion.div>
              )}
              {hasResult && result?.choice === 'B' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, boxShadow: ['inset 0 0 20px rgba(255,200,60,0.3)', 'inset 0 0 40px rgba(255,200,60,0.1)', 'inset 0 0 20px rgba(255,200,60,0.3)'] }}
                  transition={{ boxShadow: { duration: 2, repeat: Infinity } }}
                  className="absolute inset-0 border-3 border-warning rounded-r-2xl pointer-events-none"
                />
              )}
              <div className="absolute bottom-2 left-1 right-2 text-right">
                <p className="text-white text-xs font-bold drop-shadow-lg">{poll.option_b}</p>
                {hasResult && (
                  <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold text-warning drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                    <AnimatedPercent target={result!.percentB} delay={100} />
                  </motion.span>
                )}
              </div>
            </div>
          </div>

          {/* Question overlay */}
          <div className="absolute top-0 inset-x-0 px-3 pt-3 pb-6 bg-gradient-to-b from-black/70 to-transparent z-20 pointer-events-none">
            <p className="text-white text-xs font-display font-bold drop-shadow-lg text-center leading-snug">{poll.question}</p>
          </div>

          {/* Emotional feedback overlay */}
          {hasResult && (
            <VoteFeedbackOverlay
              percentA={result!.percentA}
              percentB={result!.percentB}
              choice={result!.choice}
              visible={showFeedback}
            />
          )}
        </div>
      </div>

      {/* Bottom labels — always visible */}
      <div className="shrink-0 px-6 pb-3 pt-1 flex items-center justify-between z-20">
        {hasResult ? (
          <>
            <span className="text-white/70 text-xs flex items-center gap-1">
              <Users className="h-3 w-3" /> {result!.totalVotes} perspectives
            </span>
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`text-xs font-bold px-2 py-1 rounded-full backdrop-blur-sm ${
                result!.choice === 'A' ? 'bg-accent/20 text-accent' : 'bg-warning/20 text-warning'
              }`}
            >
              You picked {result!.choice === 'A' ? poll.option_a : poll.option_b}
            </motion.span>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-accent font-display font-bold text-base">A</span>
              <span className="text-white/50 text-[9px] font-medium max-w-20 text-center truncate">← {poll.option_a}</span>
            </div>
            <span className="text-white/30 text-[9px]">swipe to choose</span>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-warning font-display font-bold text-base">B</span>
              <span className="text-white/50 text-[9px] font-medium max-w-20 text-center truncate">{poll.option_b} →</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Feed ──
export default function SwipeFeed() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [votedResults, setVotedResults] = useState<Map<string, VoteResult>>(new Map());
  const [feedbackPollId, setFeedbackPollId] = useState<string | null>(null);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const searchParams = new URLSearchParams(window.location.search);
  const targetPollId = searchParams.get('pollId');

  const { data: polls, isLoading, refetch } = useQuery({
    queryKey: ['feed-polls', user?.id],
    queryFn: async () => {
      // Fetch all active polls — voted ones stay visible with results
      // Only show polls whose starts_at has passed (or is null)
      const now = new Date().toISOString();
      let query = supabase.from('polls').select('*').eq('is_active', true).neq('is_archived', true)
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .order('is_daily_poll', { ascending: false }).order('created_at', { ascending: false })
        .limit(60);
      const { data: fetchedPolls, error } = await query;
      if (error) throw error;
      let allPolls = fetchedPolls || [];

      // Pre-load existing votes as results
      if (user) {
        const { data: userVotes } = await supabase.from('votes').select('poll_id, choice').eq('user_id', user.id);
        if (userVotes && userVotes.length > 0) {
          const votedPollIds = userVotes.map(v => v.poll_id);
          const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: votedPollIds });
          const resultsMap = new Map(results?.map((r: any) => [r.poll_id, r]) || []);
          const preloadedResults = new Map<string, VoteResult>();
          userVotes.forEach(v => {
            const r = resultsMap.get(v.poll_id);
            if (r) {
              preloadedResults.set(v.poll_id, {
                pollId: v.poll_id,
                choice: v.choice as 'A' | 'B',
                percentA: r.percent_a || 0,
                percentB: r.percent_b || 0,
                totalVotes: r.total_votes || 0,
              });
            }
          });
          setVotedResults(prev => {
            const merged = new Map(preloadedResults);
            prev.forEach((v, k) => merged.set(k, v)); // local votes take priority
            return merged;
          });
        }
      }

      if (profile) {
        allPolls = allPolls.filter(p => {
          if (p.target_gender && p.target_gender !== 'All' && profile.gender && p.target_gender !== profile.gender) return false;
          if (p.target_age_range && p.target_age_range !== 'All' && profile.age_range && p.target_age_range !== profile.age_range) return false;
          if (p.target_country && p.target_country !== 'All' && profile.country && p.target_country !== profile.country) return false;
          return true;
        });
      }
      // Put unvoted polls first
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

      // Show emotional feedback overlay
      setFeedbackPollId(data.pollId);
      setTimeout(() => setFeedbackPollId(null), 1800);

      // Smooth auto-scroll to next poll
      setTimeout(() => {
        if (!polls) return;
        const idx = polls.findIndex(p => p.id === data.pollId);
        const updatedVoted = new Map(votedResults).set(data.pollId, data);
        const nextUnvoted = polls.find((p, i) => i > idx && !updatedVoted.has(p.id));
        if (nextUnvoted) {
          const nextEl = cardRefs.current.get(nextUnvoted.id);
          nextEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }
      }, RESULT_DISPLAY_MS);

      // Refresh Home page data so it's up-to-date when user navigates back
      queryClient.invalidateQueries({ queryKey: ['visual-feed-home'] });
      queryClient.invalidateQueries({ queryKey: ['user-voted-ids'] });
      queryClient.invalidateQueries({ queryKey: ['unseen-poll-count'] });
      queryClient.invalidateQueries({ queryKey: ['my-votes'] });
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
  const unvotedCount = polls?.filter(p => !votedResults.has(p.id)).length || 0;

  return (
    <div className="h-dvh w-full flex flex-col bg-secondary/50 overflow-hidden">
      {/* Top bar with home + info */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-secondary/80 backdrop-blur-sm safe-area-top">
        <button
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-full bg-white/60 backdrop-blur-sm flex items-center justify-center text-foreground hover:bg-white/80 transition-colors shadow-sm"
        >
          <Home className="h-5 w-5" />
        </button>
        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/60 backdrop-blur-sm text-foreground shadow-sm flex items-center gap-1">
          <Zap className="h-3 w-3 text-accent" /> {unvotedCount > 0 ? `${unvotedCount} new` : `${polls?.length || 0} polls`}
        </span>
      </div>

      {/* Scrollable feed */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-3 pt-4 pb-3 space-y-4"
      >
        {hasPolls ? (
          polls.map((poll) => (
            <div
              key={poll.id}
              ref={(el) => { if (el) cardRefs.current.set(poll.id, el); }}
              className="w-full"
            >
              <ImmersivePollCard
                poll={poll}
                result={votedResults.get(poll.id) || null}
                onVote={handleVote}
                disabled={voteMutation.isPending}
                showFeedback={feedbackPollId === poll.id}
              />
            </div>
          ))
        ) : (
          <div className="h-full flex flex-col items-center justify-center px-4">
            <CaughtUpInsights onRefresh={() => { setVotedResults(new Map()); refetch(); }} />
            <div className="mt-4 w-full max-w-sm">
              <Button onClick={() => navigate('/')} variant="outline" className="w-full gap-2 h-12 rounded-xl border-border">
                <Home className="h-4 w-4" /> Back to Home
              </Button>
            </div>
          </div>
        )}

        {/* All caught up message at the bottom */}
        {hasPolls && polls.every(p => votedResults.has(p.id)) && (
          <div className="py-6 flex flex-col items-center gap-2">
            <p className="text-sm font-display font-bold text-foreground/70">You're all caught up! 🎉</p>
            <p className="text-xs text-muted-foreground">New polls drop daily</p>
          </div>
        )}
      </div>

      <Dialog open={showSignupModal} onOpenChange={setShowSignupModal}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Create an account</DialogTitle>
            <DialogDescription>Sign up to keep voting and unlock your personal insights.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-2">
            <Button onClick={() => navigate('/auth')} className="bg-primary text-primary-foreground">Sign Up Free</Button>
            <Button variant="ghost" onClick={() => setShowSignupModal(false)}>Maybe Later</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
