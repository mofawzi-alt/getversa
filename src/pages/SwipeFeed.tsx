import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import PollCard from '@/components/poll/PollCard';
import ResultsOverlay from '@/components/poll/ResultsOverlay';
import { Loader2, RefreshCw, Sparkles } from 'lucide-react';
import ShareButton from '@/components/poll/ShareButton';
import CaughtUpInsights from '@/components/feed/CaughtUpInsights';
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
  insights?: {
    countryAlignment?: number;
    countryName?: string;
    ageGroupPreference?: string;
    ageGroupPercent?: number;
    activityPercentile?: number;
    currentStreak?: number;
    earnedBadges?: { name: string; description: string }[];
  };
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

  // Fetch polls - DB-level filtering, ordered by created_at DESC, limit 20
  const { data: polls, isLoading, refetch } = useQuery({
    queryKey: ['feed-polls', user?.id],
    queryFn: async () => {
      const now = new Date().toISOString();

      // Step 1: Get voted poll IDs at DB level (authenticated users only)
      let votedIds: string[] = [];
      if (user) {
        const { data: userVotes } = await supabase
          .from('votes')
          .select('poll_id')
          .eq('user_id', user.id);

        votedIds = userVotes?.map(v => v.poll_id) || [];
        setVotedPollIds(new Set(votedIds));
      }

      // Step 2: Build query with DB-level exclusion and ordering
      let query = supabase
        .from('polls')
        .select('*')
        .eq('is_active', true)
        .or(`and(starts_at.lte.${now},ends_at.gte.${now}),and(starts_at.is.null,ends_at.is.null)`)
        .order('is_daily_poll', { ascending: false })
        .order('created_at', { ascending: false });

      // Exclude already voted polls at DB level
      if (votedIds.length > 0) {
        query = query.not('id', 'in', `(${votedIds.join(',')})`);
      }

      // Limit initial load to 20
      query = query.limit(20);

      const { data: fetchedPolls, error: pollsError } = await query;
      if (pollsError) throw pollsError;

      let allPolls = fetchedPolls || [];

      // Filter out expired polls (strict client check)
      allPolls = allPolls.filter(p => {
        if (p.ends_at && new Date(p.ends_at) < new Date()) return false;
        return true;
      });

      // Apply demographic segmentation filters
      if (profile) {
        allPolls = allPolls.filter(p => {
          if (p.target_gender && p.target_gender !== 'All' && profile.gender && p.target_gender !== profile.gender) return false;
          if (p.target_age_range && p.target_age_range !== 'All' && profile.age_range && p.target_age_range !== profile.age_range) return false;
          if (p.target_country && p.target_country !== 'All' && profile.country && p.target_country !== profile.country) return false;
          return true;
        });
      }

      return allPolls;
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

  // Touch swipe navigation (only for navigating between polls when voted)
  const getContainerWidth = useCallback(() => containerRef.current?.offsetWidth || window.innerWidth, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isAnimating) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
  }, [isAnimating]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null || isAnimating) return;
    // No swiping between polls - each poll must be voted on
  }, [isAnimating]);

  const handleTouchEnd = useCallback(() => {
    touchStartX.current = null;
    touchStartY.current = null;
  }, []);

  const voteMutation = useMutation({
    mutationFn: async ({ pollId, choice }: { pollId: string; choice: 'A' | 'B' }) => {
      // Guest mode check
      if (!user) {
        const count = incrementGuestVotes();
        if (count > GUEST_VOTE_LIMIT) {
          setShowSignupModal(true);
          throw new Error('GUEST_LIMIT');
        }
        const existing = liveVoteCounts[pollId];
        const totalA = (existing?.a || 0);
        const totalB = (existing?.b || 0);
        const total = totalA + totalB + 1;
        const newA = choice === 'A' ? totalA + 1 : totalA;
        const newB = choice === 'B' ? totalB + 1 : totalB;
        const percentA = Math.round((newA / total) * 100);
        const percentB = 100 - percentA;
        
        if (count >= GUEST_VOTE_LIMIT) {
          setTimeout(() => setShowSignupModal(true), 2000);
        }
        
        return { pollId, choice, percentA, percentB, totalVotes: total };
      }
      
      // Prevent double voting
      if (votedPollIds.has(pollId)) {
        throw new Error('ALREADY_VOTED');
      }
      
      const { error: voteError } = await supabase
        .from('votes')
        .insert({ poll_id: pollId, user_id: user.id, choice });
      
      if (voteError) throw voteError;
      
      // Fetch all votes for this poll with voter demographics
      const { data: votes } = await supabase
        .from('votes')
        .select('choice, user_id')
        .eq('poll_id', pollId);
      
      const totalVotes = votes?.length || 0;
      const aVotes = votes?.filter(v => v.choice === 'A').length || 0;
      const percentA = totalVotes > 0 ? Math.round((aVotes / totalVotes) * 100) : 0;
      const percentB = totalVotes > 0 ? 100 - percentA : 0;
      
      // Fetch demographic insights in parallel
      const voterIds = votes?.map(v => v.user_id) || [];
      const [votersRes, userRes, allUsersRes, badgesRes] = await Promise.all([
        supabase.from('users').select('id, country, age_range').in('id', voterIds),
        supabase.from('users').select('country, age_range, current_streak, total_days_active').eq('id', user.id).single(),
        supabase.from('users').select('total_days_active').gt('total_days_active', 0),
        supabase.from('user_badges')
          .select('badge_id, badges(name, description)')
          .eq('user_id', user.id)
          .order('earned_at', { ascending: false })
          .limit(5),
      ]);
      
      const insights: VoteResult['insights'] = {};
      const currentUser = userRes.data;
      
      // Country alignment: "You voted with X% of Egypt"
      if (currentUser?.country && votersRes.data) {
        const countryVoters = votersRes.data.filter(v => v.country === currentUser.country);
        const countryVotesForChoice = countryVoters.filter(v => {
          const vote = votes?.find(vt => vt.user_id === v.id);
          return vote?.choice === choice;
        });
        if (countryVoters.length > 0) {
          insights.countryAlignment = Math.round((countryVotesForChoice.length / countryVoters.length) * 100);
          insights.countryName = currentUser.country;
        }
      }
      
      // Age group preference: "Your age group prefers Y"
      if (currentUser?.age_range && votersRes.data) {
        const ageVoters = votersRes.data.filter(v => v.age_range === currentUser.age_range);
        if (ageVoters.length > 1) {
          const ageAVotes = ageVoters.filter(v => {
            const vote = votes?.find(vt => vt.user_id === v.id);
            return vote?.choice === 'A';
          }).length;
          const ageBVotes = ageVoters.length - ageAVotes;
          const poll = polls?.find(p => p.id === pollId);
          insights.ageGroupPreference = ageAVotes >= ageBVotes ? (poll?.option_a || 'A') : (poll?.option_b || 'B');
          insights.ageGroupPercent = Math.round((Math.max(ageAVotes, ageBVotes) / ageVoters.length) * 100);
        }
      }
      
      // Activity percentile
      if (currentUser?.total_days_active && allUsersRes.data) {
        const lessActive = allUsersRes.data.filter(u => (u.total_days_active || 0) < (currentUser.total_days_active || 0)).length;
        insights.activityPercentile = allUsersRes.data.length > 0 
          ? Math.round(((lessActive) / allUsersRes.data.length) * 100) 
          : 50;
      }
      
      // Streak
      insights.currentStreak = currentUser?.current_streak || 0;
      
      // Recently earned badges
      if (badgesRes.data && badgesRes.data.length > 0) {
        insights.earnedBadges = badgesRes.data
          .filter((b: any) => b.badges)
          .map((b: any) => ({ name: b.badges.name, description: b.badges.description }));
      }
      
      return { pollId, choice, percentA, percentB, totalVotes, insights };
    },
    onSuccess: (data) => {
      setResult(data);
      setVotedPollIds(prev => new Set([...prev, data.pollId]));
    },
    onError: (error: any) => {
      if (error.message === 'GUEST_LIMIT') return;
      if (error.message === 'ALREADY_VOTED') {
        toast.error('You already voted on this poll');
        handleNextPoll();
        return;
      }
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
    
    if (!user && getGuestVoteCount() >= GUEST_VOTE_LIMIT) {
      setShowSignupModal(true);
      return;
    }
    
    const poll = polls[currentIndex];
    
    if (poll.ends_at && new Date(poll.ends_at) < new Date()) {
      toast.error('This poll has expired');
      handleNextPoll();
      return;
    }
    
    if (votedPollIds.has(poll.id)) {
      handleNextPoll();
      return;
    }
    
    const choice = direction === 'right' ? 'B' : 'A';
    setAnimatingCard(direction);
    setTimeout(() => {
      voteMutation.mutate({ pollId: poll.id, choice });
    }, 300);
  }, [polls, currentIndex, voteMutation, user, votedPollIds]);

  const handleNextPoll = useCallback(() => {
    setResult(null);
    setAnimatingCard(null);
    setCurrentIndex(prev => prev + 1);
  }, []);

  // Keyboard support: ← for Option A, → for Option B
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (result) return; // Don't allow during results overlay
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleSwipe('left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleSwipe('right');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSwipe, result]);

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
          </div>
          <div className="flex items-center gap-2">
            {currentPoll && (
              <ShareButton
                pollId={currentPoll.id}
                pollQuestion={currentPoll.question}
                optionA={currentPoll.option_a}
                optionB={currentPoll.option_b}
                variant="icon"
              />
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
          className="relative flex items-start justify-center overflow-visible pt-2"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {hasMorePolls && currentPoll ? (
            <div className="w-full flex items-start justify-center">
              <PollCard
                key={currentPoll.id}
                poll={currentPoll}
                onSwipe={handleSwipe}
                isAnimating={animatingCard}
                liveVotes={liveVoteCounts[currentPoll.id]}
                hasVoted={false}
                showDemographics={isAdmin}
              />
            </div>
          ) : (
            <CaughtUpInsights onRefresh={() => { setCurrentIndex(0); refetch(); }} />
          )}
        </div>
      </div>

      {/* Results Overlay - auto-advances to next poll */}
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
