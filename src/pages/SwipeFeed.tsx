import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import PollCard from '@/components/poll/PollCard';
import ResultsOverlay from '@/components/poll/ResultsOverlay';
import { Loader2, RefreshCw, History, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import ShareButton from '@/components/poll/ShareButton';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const GUEST_VOTE_LIMIT = 3;
const GUEST_VOTES_KEY = 'versa_guest_votes';

function getGuestVoteCount(): number {
  try {
    return parseInt(localStorage.getItem(GUEST_VOTES_KEY) || '0', 10);
  } catch {
    return 0;
  }
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

export default function SwipeFeed() {
  const { user, profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [result, setResult] = useState<VoteResult | null>(null);
  const [animatingCard, setAnimatingCard] = useState<'left' | 'right' | null>(null);
  const [liveVoteCounts, setLiveVoteCounts] = useState<Record<string, { 
    a: number; 
    b: number;
    demographics: {
      gender: Record<string, { a: number; b: number }>;
      age: Record<string, { a: number; b: number }>;
      country: Record<string, { a: number; b: number }>;
    };
  }>>({});
  const [votedPollIds, setVotedPollIds] = useState<Set<string>>(new Set());
  const [newPollsCount, setNewPollsCount] = useState(0);
  const [showSignupModal, setShowSignupModal] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [slideOffset, setSlideOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef<number>(0);

  // Fetch polls - works for both guests and authenticated users
  const { data: polls, isLoading, refetch } = useQuery({
    queryKey: ['feed-polls', user?.id],
    queryFn: async () => {
      const now = new Date().toISOString();
      
      const { data: regularPolls, error: pollsError } = await supabase
        .from('polls')
        .select('*')
        .eq('is_active', true)
        .or(`and(starts_at.lte.${now},ends_at.gte.${now}),and(starts_at.is.null,ends_at.is.null)`);
      
      if (pollsError) throw pollsError;
      
      let allPolls = regularPolls || [];
      
      // Apply demographic filtering for authenticated users
      if (profile) {
        allPolls = allPolls.filter(p => {
          if (p.target_gender && p.target_gender !== 'All' && profile.gender && p.target_gender !== profile.gender) return false;
          if (p.target_age_range && p.target_age_range !== 'All' && profile.age_range && p.target_age_range !== profile.age_range) return false;
          if (p.target_country && p.target_country !== 'All' && profile.country && p.target_country !== profile.country) return false;
          return true;
        });
      }
      
      // Get user's votes if authenticated
      if (user) {
        const { data: userVotes } = await supabase
          .from('votes')
          .select('poll_id')
          .eq('user_id', user.id);
        
        const userVotedIds = new Set(userVotes?.map(v => v.poll_id) || []);
        setVotedPollIds(userVotedIds);
        
        // Separate unvoted and voted daily polls
        const unvotedPolls = allPolls.filter(p => !userVotedIds.has(p.id));
        const votedLivePolls = allPolls.filter(p => p.is_daily_poll && userVotedIds.has(p.id));
        
        const sortedUnvoted = unvotedPolls.sort((a, b) => {
          if (a.is_daily_poll && !b.is_daily_poll) return -1;
          if (!a.is_daily_poll && b.is_daily_poll) return 1;
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        });
        
        const sortedVotedLive = votedLivePolls.sort((a, b) =>
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );
        
        return [...sortedUnvoted, ...sortedVotedLive];
      }
      
      // Guest: sort by newest, daily polls first
      return allPolls.sort((a, b) => {
        if (a.is_daily_poll && !b.is_daily_poll) return -1;
        if (!a.is_daily_poll && b.is_daily_poll) return 1;
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });
    },
  });

  // Fetch vote counts for visible polls
  const fetchVotesWithDemographics = useCallback(async (pollIds: string[]) => {
    if (pollIds.length === 0) return;
    
    const { data: votes } = await supabase
      .from('votes')
      .select('poll_id, choice, user_id')
      .in('poll_id', pollIds);
    
    const counts: typeof liveVoteCounts = {};
    pollIds.forEach(pollId => {
      counts[pollId] = { a: 0, b: 0, demographics: { gender: {}, age: {}, country: {} } };
    });
    
    if (!votes || votes.length === 0) {
      setLiveVoteCounts(prev => ({ ...prev, ...counts }));
      return;
    }
    
    // Only fetch demographics for admin
    if (isAdmin) {
      const userIds = [...new Set(votes.map(v => v.user_id))];
      const { data: users } = await supabase
        .from('users')
        .select('id, gender, age_range, country')
        .in('id', userIds);
      
      const userMap = new Map(users?.map(u => [u.id, u]) || []);
      
      votes.forEach(v => {
        const userData = userMap.get(v.user_id);
        const choice = v.choice === 'A' ? 'a' : 'b';
        if (v.choice === 'A') counts[v.poll_id].a++;
        else counts[v.poll_id].b++;
        
        if (userData?.gender) {
          if (!counts[v.poll_id].demographics.gender[userData.gender]) {
            counts[v.poll_id].demographics.gender[userData.gender] = { a: 0, b: 0 };
          }
          counts[v.poll_id].demographics.gender[userData.gender][choice]++;
        }
        if (userData?.age_range) {
          if (!counts[v.poll_id].demographics.age[userData.age_range]) {
            counts[v.poll_id].demographics.age[userData.age_range] = { a: 0, b: 0 };
          }
          counts[v.poll_id].demographics.age[userData.age_range][choice]++;
        }
        if (userData?.country) {
          if (!counts[v.poll_id].demographics.country[userData.country]) {
            counts[v.poll_id].demographics.country[userData.country] = { a: 0, b: 0 };
          }
          counts[v.poll_id].demographics.country[userData.country][choice]++;
        }
      });
    } else {
      votes.forEach(v => {
        if (v.choice === 'A') counts[v.poll_id].a++;
        else counts[v.poll_id].b++;
      });
    }
    
    setLiveVoteCounts(prev => ({ ...prev, ...counts }));
  }, [isAdmin]);

  useEffect(() => {
    if (!polls || polls.length === 0) return;
    fetchVotesWithDemographics(polls.map(p => p.id));
  }, [polls, fetchVotesWithDemographics]);

  // Realtime vote updates
  useEffect(() => {
    if (!polls || polls.length === 0) return;
    const votesChannel = supabase
      .channel('votes-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'votes' },
        (payload) => {
          const newVote = payload.new as { poll_id: string };
          if (polls.some(p => p.id === newVote.poll_id)) {
            fetchVotesWithDemographics([newVote.poll_id]);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(votesChannel); };
  }, [polls]);

  // New polls realtime
  useEffect(() => {
    const pollsChannel = supabase
      .channel('polls-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'polls' },
        () => {
          setNewPollsCount(prev => prev + 1);
          queryClient.invalidateQueries({ queryKey: ['feed-polls'] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(pollsChannel); };
  }, [queryClient]);

  const handleViewNewPolls = useCallback(() => {
    setNewPollsCount(0);
    setCurrentIndex(0);
    refetch();
  }, [refetch]);

  // Touch swipe navigation
  const getContainerWidth = useCallback(() => containerRef.current?.offsetWidth || window.innerWidth, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isAnimating) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
  }, [isAnimating]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null || isAnimating) return;
    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = e.touches[0].clientY - touchStartY.current;
    const activePoll = polls?.[currentIndex];
    const currentPollVoted = activePoll && votedPollIds.has(activePoll.id);
    if (currentPollVoted && Math.abs(deltaX) > Math.abs(deltaY)) {
      e.preventDefault();
      setIsDragging(true);
      const containerWidth = getContainerWidth();
      if ((deltaX > 0 && currentIndex === 0) || (deltaX < 0 && polls && currentIndex >= polls.length - 1)) {
        setSlideOffset(deltaX * 0.3);
      } else {
        setSlideOffset(deltaX);
      }
    }
  }, [polls, votedPollIds, currentIndex, isAnimating, getContainerWidth]);

  const handleTouchEnd = useCallback(() => {
    if (touchStartX.current === null || !isDragging) {
      touchStartX.current = null;
      touchStartY.current = null;
      return;
    }
    const containerWidth = getContainerWidth();
    const velocity = slideOffset / (Date.now() - touchStartTime.current);
    const threshold = containerWidth * 0.25;
    const activePoll = polls?.[currentIndex];
    const currentPollVoted = activePoll && votedPollIds.has(activePoll.id);
    if (!currentPollVoted) {
      setSlideOffset(0);
      setIsDragging(false);
      touchStartX.current = null;
      touchStartY.current = null;
      return;
    }
    setIsAnimating(true);
    const shouldGoNext = (slideOffset < -threshold || velocity < -0.5) && polls && currentIndex < polls.length - 1;
    const shouldGoPrev = (slideOffset > threshold || velocity > 0.5) && currentIndex > 0;
    if (shouldGoNext) {
      setSlideOffset(-containerWidth);
      setTimeout(() => { setCurrentIndex(prev => prev + 1); setSlideOffset(0); setIsAnimating(false); }, 300);
    } else if (shouldGoPrev) {
      setSlideOffset(containerWidth);
      setTimeout(() => { setCurrentIndex(prev => prev - 1); setSlideOffset(0); setIsAnimating(false); }, 300);
    } else {
      setSlideOffset(0);
      setTimeout(() => setIsAnimating(false), 300);
    }
    setIsDragging(false);
    touchStartX.current = null;
    touchStartY.current = null;
  }, [polls, votedPollIds, currentIndex, slideOffset, isDragging, getContainerWidth]);

  const navigateWithSlide = useCallback((direction: 'left' | 'right') => {
    if (isAnimating) return;
    const containerWidth = getContainerWidth();
    setIsAnimating(true);
    if (direction === 'left' && polls && currentIndex < polls.length - 1) {
      setSlideOffset(-containerWidth);
      setTimeout(() => { setCurrentIndex(prev => prev + 1); setSlideOffset(0); setIsAnimating(false); }, 300);
    } else if (direction === 'right' && currentIndex > 0) {
      setSlideOffset(containerWidth);
      setTimeout(() => { setCurrentIndex(prev => prev - 1); setSlideOffset(0); setIsAnimating(false); }, 300);
    } else {
      setIsAnimating(false);
    }
  }, [polls, currentIndex, isAnimating, getContainerWidth]);

  const voteMutation = useMutation({
    mutationFn: async ({ pollId, choice }: { pollId: string; choice: 'A' | 'B' }) => {
      // Guest mode check
      if (!user) {
        const count = incrementGuestVotes();
        if (count > GUEST_VOTE_LIMIT) {
          setShowSignupModal(true);
          throw new Error('GUEST_LIMIT');
        }
        // Guest can't actually vote - show simulated results
        const existing = liveVoteCounts[pollId];
        const totalA = (existing?.a || 0);
        const totalB = (existing?.b || 0);
        const total = totalA + totalB + 1;
        const newA = choice === 'A' ? totalA + 1 : totalA;
        const newB = choice === 'B' ? totalB + 1 : totalB;
        const percentA = Math.round((newA / total) * 100);
        const percentB = 100 - percentA;
        
        // After showing result, check if limit reached
        if (count >= GUEST_VOTE_LIMIT) {
          setTimeout(() => setShowSignupModal(true), 2000);
        }
        
        return { pollId, choice, percentA, percentB, totalVotes: total };
      }
      
      const { error: voteError } = await supabase
        .from('votes')
        .insert({ poll_id: pollId, user_id: user.id, choice });
      
      if (voteError) throw voteError;
      
      const { data: votes } = await supabase
        .from('votes')
        .select('choice')
        .eq('poll_id', pollId);
      
      const totalVotes = votes?.length || 0;
      const aVotes = votes?.filter(v => v.choice === 'A').length || 0;
      const percentA = totalVotes > 0 ? Math.round((aVotes / totalVotes) * 100) : 0;
      const percentB = totalVotes > 0 ? 100 - percentA : 0;
      
      return { pollId, choice, percentA, percentB, totalVotes };
    },
    onSuccess: (data) => {
      setResult(data);
      setVotedPollIds(prev => new Set([...prev, data.pollId]));
    },
    onError: (error: any) => {
      if (error.message === 'GUEST_LIMIT') return;
      if (error.message?.includes('duplicate')) {
        toast.error('You already voted on this poll');
        handleNextPoll();
      } else {
        toast.error('Failed to vote');
      }
    },
  });

  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    if (!polls || currentIndex >= polls.length) return;
    
    // Check guest limit before animating
    if (!user && getGuestVoteCount() >= GUEST_VOTE_LIMIT) {
      setShowSignupModal(true);
      return;
    }
    
    const poll = polls[currentIndex];
    const choice = direction === 'right' ? 'B' : 'A';
    setAnimatingCard(direction);
    setTimeout(() => {
      voteMutation.mutate({ pollId: poll.id, choice });
    }, 300);
  }, [polls, currentIndex, voteMutation, user]);

  const handleNextPoll = () => {
    setResult(null);
    setAnimatingCard(null);
    setCurrentIndex(prev => prev + 1);
  };

  const currentPoll = polls?.[currentIndex];
  const hasMorePolls = polls && currentIndex < polls.length;

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
      <div className="min-h-screen flex flex-col p-4 pb-24">
        {/* New Polls Banner */}
        {newPollsCount > 0 && (
          <button
            onClick={handleViewNewPolls}
            className="w-full mb-4 px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-all"
          >
            <Sparkles className="h-4 w-4" />
            {newPollsCount === 1 ? '1 new poll!' : `${newPollsCount} new polls!`}
          </button>
        )}

        {/* Header */}
        <header className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-gradient">VERSA</h1>
            <p className="text-sm text-foreground/60">
              {polls && polls.length > 1 ? `Poll ${currentIndex + 1} of ${polls.length}` : "Today's Poll"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {currentPoll && (
              <ShareButton
                pollId={currentPoll.id}
                pollQuestion={currentPoll.question}
                optionA={currentPoll.option_a}
                optionB={currentPoll.option_b}
                percentA={liveVoteCounts[currentPoll.id] ? Math.round((liveVoteCounts[currentPoll.id].a / (liveVoteCounts[currentPoll.id].a + liveVoteCounts[currentPoll.id].b || 1)) * 100) : undefined}
                percentB={liveVoteCounts[currentPoll.id] ? Math.round((liveVoteCounts[currentPoll.id].b / (liveVoteCounts[currentPoll.id].a + liveVoteCounts[currentPoll.id].b || 1)) * 100) : undefined}
                showResults={votedPollIds.has(currentPoll.id)}
                variant="icon"
              />
            )}
            {user && (
              <button
                onClick={() => navigate('/history')}
                className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
                title="Poll History"
              >
                <History className="h-5 w-5 text-foreground/80" />
              </button>
            )}
            <button
              onClick={() => { setNewPollsCount(0); setCurrentIndex(0); refetch(); }}
              className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors relative"
            >
              <RefreshCw className="h-5 w-5 text-foreground/80" />
            </button>
          </div>
        </header>

        {/* Poll Cards */}
        <div 
          ref={containerRef}
          className="relative flex-1 flex items-start justify-center overflow-visible pt-2"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {hasMorePolls && currentPoll ? (
            <div 
              className="w-full flex items-start justify-center"
              style={{
                transform: `translateX(${slideOffset}px)`,
                transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              }}
            >
              <PollCard
                key={currentPoll.id}
                poll={currentPoll}
                onSwipe={handleSwipe}
                isAnimating={animatingCard}
                liveVotes={liveVoteCounts[currentPoll.id]}
                hasVoted={votedPollIds.has(currentPoll.id)}
                showDemographics={isAdmin}
              />
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="text-6xl">🎉</div>
              <h2 className="text-2xl font-display font-bold">You're all caught up!</h2>
              <p className="text-foreground/60">Check back later for more polls</p>
              <button
                onClick={() => { setCurrentIndex(0); refetch(); }}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          )}
        </div>

        {/* Swipe Hints */}
        {hasMorePolls && currentPoll && !votedPollIds.has(currentPoll.id) && (
          <div className="flex justify-center gap-8 mt-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="text-lg">👈</span>
              <span>Option A</span>
            </div>
            <div className="flex items-center gap-2">
              <span>Option B</span>
              <span className="text-lg">👉</span>
            </div>
          </div>
        )}
        
        {/* Navigation dots */}
        {hasMorePolls && currentPoll && polls && polls.length > 1 && (
          <div className="flex justify-center items-center gap-4 mt-4">
            <button
              onClick={() => navigateWithSlide('right')}
              disabled={currentIndex === 0}
              className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors disabled:opacity-30"
            >
              <ChevronLeft className="h-5 w-5 text-foreground/80" />
            </button>
            <div className="flex gap-1.5">
              {polls.slice(0, 10).map((poll, idx) => (
                <div
                  key={poll.id}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === currentIndex ? 'bg-primary w-4' : votedPollIds.has(poll.id) ? 'bg-primary/40' : 'bg-muted-foreground/30'
                  }`}
                />
              ))}
              {polls.length > 10 && (
                <span className="text-xs text-muted-foreground">+{polls.length - 10}</span>
              )}
            </div>
            <button
              onClick={() => navigateWithSlide('left')}
              disabled={currentIndex >= polls.length - 1}
              className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors disabled:opacity-30"
            >
              <ChevronRight className="h-5 w-5 text-foreground/80" />
            </button>
          </div>
        )}
      </div>

      {/* Results Overlay */}
      {result && currentPoll && (
        <ResultsOverlay
          poll={currentPoll}
          result={result}
          onContinue={handleNextPoll}
        />
      )}

      {/* Guest Signup Modal */}
      <Dialog open={showSignupModal} onOpenChange={setShowSignupModal}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Create an account</DialogTitle>
            <DialogDescription>
              Sign up to keep voting and track your results.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Button
              onClick={() => navigate('/auth')}
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold h-12 rounded-full"
            >
              Sign Up Free
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowSignupModal(false)}
              className="w-full text-muted-foreground"
            >
              Maybe later
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
