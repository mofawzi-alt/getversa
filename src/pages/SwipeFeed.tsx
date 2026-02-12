import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import PollCard from '@/components/poll/PollCard';
import ResultsOverlay from '@/components/poll/ResultsOverlay';
import BestPollsHighlights from '@/components/home/BestPollsHighlights';
import { Loader2, RefreshCw, History, ChevronLeft, ChevronRight, Share2, Sparkles, Users } from 'lucide-react';
import ShareButton from '@/components/poll/ShareButton';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useFollows } from '@/hooks/useFollows';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Note: Regular users can only see poll results (percentages), not demographics.
// Demographics are only visible to admins.

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

type FeedTab = 'foryou' | 'following';

export default function SwipeFeed() {
  const { user, profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { following } = useFollows();
  const [feedTab, setFeedTab] = useState<FeedTab>('foryou');
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
  
  // Touch swipe state for navigating between polls (photo library style)
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [slideOffset, setSlideOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Reset index when switching tabs
  useEffect(() => {
    setCurrentIndex(0);
    setResult(null);
    setAnimatingCard(null);
  }, [feedTab]);

  // Fetch today's active polls - keep live daily polls visible even after voting
  const { data: polls, isLoading, refetch } = useQuery({
    queryKey: ['feed-polls', user?.id, feedTab, following],
    queryFn: async () => {
      if (!user) return [];
      
      const now = new Date().toISOString();
      
      // Get active polls that are within their start/end window OR have no window set
      const { data: regularPolls, error: pollsError } = await supabase
        .from('polls')
        .select('*')
        .eq('is_active', true)
        .or(`and(starts_at.lte.${now},ends_at.gte.${now}),and(starts_at.is.null,ends_at.is.null)`);
      
      if (pollsError) throw pollsError;
      
      // Get creator usernames for polls with created_by
      const creatorIds = [...new Set((regularPolls || []).map(p => p.created_by).filter(Boolean))];
      let creatorMap: Record<string, string> = {};
      
      if (creatorIds.length > 0) {
        const { data: creators } = await supabase
          .from('users')
          .select('id, username')
          .in('id', creatorIds);
        
        creatorMap = Object.fromEntries(
          (creators || []).map(c => [c.id, c.username || 'Creator'])
        );
      }
      
      // Get user's votes
      const { data: userVotes } = await supabase
        .from('votes')
        .select('poll_id')
        .eq('user_id', user.id);
      
      const userVotedIds = new Set(userVotes?.map(v => v.poll_id) || []);
      setVotedPollIds(userVotedIds);
      
      // Get sponsored polls matching user demographics
      const { data: sponsoredPolls } = await supabase
        .from('sponsored_polls')
        .select(`
          *,
          poll:polls(*)
        `)
        .lte('campaign_start', now)
        .gte('campaign_end', now);
      
      const sponsoredFormatted = (sponsoredPolls || [])
        .filter(sp => {
          if (sp.target_gender && profile?.gender && sp.target_gender !== profile.gender) return false;
          if (sp.target_age_range && profile?.age_range && sp.target_age_range !== profile.age_range) return false;
          if (sp.target_country && profile?.country && sp.target_country !== profile.country) return false;
          return true;
        })
        .map(sp => ({
          ...sp.poll,
          is_sponsored: true,
          sponsor_name: sp.sponsor_name,
          sponsor_logo_url: sp.sponsor_logo_url,
          creator_username: sp.poll?.created_by ? creatorMap[sp.poll.created_by] : null,
        }));
      
      // Combine polls with creator usernames
      let allPolls = [...(regularPolls || []).map(p => ({
        ...p,
        creator_username: p.created_by ? creatorMap[p.created_by] : null,
      })), ...sponsoredFormatted];
      
      // Filter by feed tab
      if (feedTab === 'following') {
        // Show only polls from followed creators
        allPolls = allPolls.filter(p => p.created_by && following.includes(p.created_by));
      } else {
        // For You tab: prioritize followed creators' polls
        allPolls.sort((a, b) => {
          const aFollowed = a.created_by && following.includes(a.created_by);
          const bFollowed = b.created_by && following.includes(b.created_by);
          if (aFollowed && !bFollowed) return -1;
          if (!aFollowed && bFollowed) return 1;
          return 0;
        });
      }
      
      // Separate unvoted polls and live daily polls (voted)
      const unvotedPolls = allPolls.filter(p => !userVotedIds.has(p.id));
      const votedLivePolls = allPolls.filter(p => p.is_daily_poll && userVotedIds.has(p.id));
      
      // Sort ALL polls by created_at (newest first), daily polls prioritized
      const sortedUnvoted = unvotedPolls.sort((a, b) => {
        // Daily polls first
        if (a.is_daily_poll && !b.is_daily_poll) return -1;
        if (!a.is_daily_poll && b.is_daily_poll) return 1;
        // Then by created_at (newest first)
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });
      
      // Sort voted live polls by created_at (newest first)
      const sortedVotedLive = votedLivePolls.sort((a, b) => {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });
      
      // Return unvoted first (newest to oldest), then voted live polls (newest to oldest)
      return [...sortedUnvoted, ...sortedVotedLive];
    },
    enabled: !!user,
  });

  // Fetch initial vote counts with demographics for live polls
  const fetchVotesWithDemographics = useCallback(async (pollIds: string[]) => {
    if (pollIds.length === 0) return;
    
    const { data: votes } = await supabase
      .from('votes')
      .select('poll_id, choice, user_id')
      .in('poll_id', pollIds);
    
    // Initialize counts for all polls (even those with no votes yet)
    const counts: typeof liveVoteCounts = {};
    pollIds.forEach(pollId => {
      counts[pollId] = { 
        a: 0, 
        b: 0, 
        demographics: { 
          gender: {}, 
          age: {}, 
          country: {} 
        } 
      };
    });
    
    if (!votes || votes.length === 0) {
      setLiveVoteCounts(prev => ({ ...prev, ...counts }));
      return;
    }
    
    // Get user demographics
    const userIds = [...new Set(votes.map(v => v.user_id))];
    const { data: users } = await supabase
      .from('users')
      .select('id, gender, age_range, country')
      .in('id', userIds);
    
    const userMap = new Map(users?.map(u => [u.id, u]) || []);
    
    votes.forEach(v => {
      const user = userMap.get(v.user_id);
      const choice = v.choice === 'A' ? 'a' : 'b';
      
      if (v.choice === 'A') counts[v.poll_id].a++;
      else counts[v.poll_id].b++;
      
      // Track demographics
      if (user?.gender) {
        if (!counts[v.poll_id].demographics.gender[user.gender]) {
          counts[v.poll_id].demographics.gender[user.gender] = { a: 0, b: 0 };
        }
        counts[v.poll_id].demographics.gender[user.gender][choice]++;
      }
      
      if (user?.age_range) {
        if (!counts[v.poll_id].demographics.age[user.age_range]) {
          counts[v.poll_id].demographics.age[user.age_range] = { a: 0, b: 0 };
        }
        counts[v.poll_id].demographics.age[user.age_range][choice]++;
      }
      
      if (user?.country) {
        if (!counts[v.poll_id].demographics.country[user.country]) {
          counts[v.poll_id].demographics.country[user.country] = { a: 0, b: 0 };
        }
        counts[v.poll_id].demographics.country[user.country][choice]++;
      }
    });
    
    setLiveVoteCounts(prev => ({ ...prev, ...counts }));
  }, []);

  useEffect(() => {
    if (!polls || polls.length === 0) return;
    // Fetch demographics for ALL polls immediately
    const allPollIds = polls.map(p => p.id);
    fetchVotesWithDemographics(allPollIds);
  }, [polls, fetchVotesWithDemographics]);

  // Subscribe to realtime vote updates
  useEffect(() => {
    if (!polls || polls.length === 0) return;

    const votesChannel = supabase
      .channel('votes-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'votes',
        },
        async (payload) => {
          const newVote = payload.new as { poll_id: string; choice: string };
          const livePollIds = polls.filter(p => p.is_daily_poll).map(p => p.id);
          
          if (livePollIds.includes(newVote.poll_id)) {
            // Refetch all demographics for this poll
            fetchVotesWithDemographics([newVote.poll_id]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(votesChannel);
    };
  }, [polls]);

  // Subscribe to new polls in real-time
  useEffect(() => {
    const pollsChannel = supabase
      .channel('polls-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'polls',
        },
        (payload) => {
          const newPoll = payload.new as Poll & { created_at: string };
          // Increment new polls counter
          setNewPollsCount(prev => prev + 1);
          // Refetch polls to include the new one
          queryClient.invalidateQueries({ queryKey: ['feed-polls'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(pollsChannel);
    };
  }, [queryClient]);

  // Handle viewing new polls
  const handleViewNewPolls = useCallback(() => {
    setNewPollsCount(0);
    setCurrentIndex(0);
    refetch();
  }, [refetch]);

  const handlePrevPoll = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  // Get container width for calculations
  const getContainerWidth = useCallback(() => {
    return containerRef.current?.offsetWidth || window.innerWidth;
  }, []);

  // Handle touch gestures for navigating between polls (photo library style)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isAnimating) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
  }, [isAnimating]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null || isAnimating) return;
    
    const touchCurrentX = e.touches[0].clientX;
    const touchCurrentY = e.touches[0].clientY;
    const deltaX = touchCurrentX - touchStartX.current;
    const deltaY = touchCurrentY - touchStartY.current;
    
    // Only allow horizontal swipe if user has voted on current poll
    const activePoll = polls?.[currentIndex];
    const currentPollVoted = activePoll && votedPollIds.has(activePoll.id);
    
    if (currentPollVoted && Math.abs(deltaX) > Math.abs(deltaY)) {
      e.preventDefault();
      setIsDragging(true);
      
      // Add resistance at boundaries
      const containerWidth = getContainerWidth();
      if ((deltaX > 0 && currentIndex === 0) || (deltaX < 0 && polls && currentIndex >= polls.length - 1)) {
        // Rubber band effect at edges
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
    const threshold = containerWidth * 0.25; // 25% of screen width
    
    const activePoll = polls?.[currentIndex];
    const currentPollVoted = activePoll && votedPollIds.has(activePoll.id);
    
    if (!currentPollVoted) {
      setSlideOffset(0);
      setIsDragging(false);
      touchStartX.current = null;
      touchStartY.current = null;
      return;
    }
    
    // Determine if we should navigate based on position or velocity
    const shouldGoNext = (slideOffset < -threshold || velocity < -0.5) && polls && currentIndex < polls.length - 1;
    const shouldGoPrev = (slideOffset > threshold || velocity > 0.5) && currentIndex > 0;
    
    setIsAnimating(true);
    
    if (shouldGoNext) {
      // Animate to the left (next poll)
      setSlideOffset(-containerWidth);
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
        setSlideOffset(0);
        setIsAnimating(false);
      }, 300);
    } else if (shouldGoPrev) {
      // Animate to the right (previous poll)
      setSlideOffset(containerWidth);
      setTimeout(() => {
        setCurrentIndex(prev => prev - 1);
        setSlideOffset(0);
        setIsAnimating(false);
      }, 300);
    } else {
      // Snap back to current
      setSlideOffset(0);
      setTimeout(() => setIsAnimating(false), 300);
    }
    
    setIsDragging(false);
    touchStartX.current = null;
    touchStartY.current = null;
  }, [polls, votedPollIds, currentIndex, slideOffset, isDragging, getContainerWidth]);

  // Navigate with slide animation (for button clicks)
  const navigateWithSlide = useCallback((direction: 'left' | 'right') => {
    if (isAnimating) return;
    
    const containerWidth = getContainerWidth();
    setIsAnimating(true);
    
    if (direction === 'left' && polls && currentIndex < polls.length - 1) {
      setSlideOffset(-containerWidth);
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
        setSlideOffset(0);
        setIsAnimating(false);
      }, 300);
    } else if (direction === 'right' && currentIndex > 0) {
      setSlideOffset(containerWidth);
      setTimeout(() => {
        setCurrentIndex(prev => prev - 1);
        setSlideOffset(0);
        setIsAnimating(false);
      }, 300);
    } else {
      setIsAnimating(false);
    }
  }, [polls, currentIndex, isAnimating, getContainerWidth]);
  const voteMutation = useMutation({
    mutationFn: async ({ pollId, choice }: { pollId: string; choice: 'A' | 'B' }) => {
      if (!user) throw new Error('Not authenticated');
      
      // Insert vote
      const { error: voteError } = await supabase
        .from('votes')
        .insert({
          poll_id: pollId,
          user_id: user.id,
          choice,
        });
      
      if (voteError) throw voteError;
      
      // Get vote counts
      const { data: votes } = await supabase
        .from('votes')
        .select('choice')
        .eq('poll_id', pollId);
      
      const totalVotes = votes?.length || 0;
      const aVotes = votes?.filter(v => v.choice === 'A').length || 0;
      const bVotes = totalVotes - aVotes;
      
      const percentA = totalVotes > 0 ? Math.round((aVotes / totalVotes) * 100) : 0;
      const percentB = totalVotes > 0 ? Math.round((bVotes / totalVotes) * 100) : 0;
      
      // Create notification
      await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          title: 'Vote Counted!',
          body: `Your vote for Option ${choice} was recorded.`,
          type: 'vote_result',
        });
      
      return { pollId, choice, percentA, percentB, totalVotes };
    },
    onSuccess: async (data) => {
      setResult(data);
      setVotedPollIds(prev => new Set([...prev, data.pollId]));
      
      // Check for newly earned badges
      if (user) {
        const { data: recentBadges } = await supabase
          .from('user_badges')
          .select(`
            badge_id,
            badges (name, description, points_reward)
          `)
          .eq('user_id', user.id)
          .gte('earned_at', new Date(Date.now() - 5000).toISOString()) // Badges earned in last 5 seconds
          .order('earned_at', { ascending: false });
        
        if (recentBadges && recentBadges.length > 0) {
          recentBadges.forEach((ub: any) => {
            if (ub.badges) {
              toast.success(`🏆 Badge Earned: ${ub.badges.name}!`, {
                description: `${ub.badges.description}${ub.badges.points_reward ? ` (+${ub.badges.points_reward} insight)` : ''}`,
                duration: 5000,
              });
            }
          });
        }
      }
    },
    onError: (error: any) => {
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
    
    const poll = polls[currentIndex];
    const choice = direction === 'right' ? 'B' : 'A';
    
    setAnimatingCard(direction);
    
    setTimeout(() => {
      voteMutation.mutate({ pollId: poll.id, choice });
    }, 300);
  }, [polls, currentIndex, voteMutation]);

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
            className="w-full mb-4 px-4 py-3 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 animate-pulse hover:animate-none hover:opacity-90 transition-all shadow-lg"
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
            <button
              onClick={() => navigate('/history')}
              className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
              title="Poll History"
            >
              <History className="h-5 w-5 text-white/80" />
            </button>
            <button
              onClick={() => {
                setNewPollsCount(0);
                setCurrentIndex(0);
                refetch();
              }}
              className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors relative"
            >
              <RefreshCw className="h-5 w-5 text-white/80" />
              {newPollsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full text-xs font-bold flex items-center justify-center text-primary-foreground">
                  {newPollsCount > 9 ? '9+' : newPollsCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Best Polls Highlights */}
        <BestPollsHighlights />

        {/* Feed Tabs */}
        <Tabs value={feedTab} onValueChange={(v) => setFeedTab(v as FeedTab)} className="mb-4">
          <TabsList className="grid w-full grid-cols-2 h-10">
            <TabsTrigger value="foryou" className="gap-2 text-sm">
              <Sparkles className="h-4 w-4" />
              For You
            </TabsTrigger>
            <TabsTrigger value="following" className="gap-2 text-sm">
              <Users className="h-4 w-4" />
              Following
              {following.length > 0 && (
                <span className="ml-1 text-xs bg-primary/20 px-1.5 py-0.5 rounded-full">
                  {following.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

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
              {/* Preload next poll images */}
              {polls && polls[currentIndex + 1] && (
                <div className="hidden">
                  {polls[currentIndex + 1].image_a_url && <img src={polls[currentIndex + 1].image_a_url!} alt="" />}
                  {polls[currentIndex + 1].image_b_url && <img src={polls[currentIndex + 1].image_b_url!} alt="" />}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center space-y-4">
              {feedTab === 'following' && following.length === 0 ? (
                <>
                  <Users className="h-16 w-16 mx-auto text-muted-foreground" />
                  <h2 className="text-2xl font-display font-bold">Follow Creators</h2>
                  <p className="text-foreground/60 max-w-xs mx-auto">
                    Follow poll creators to see their content here. Explore the "For You" tab to discover creators!
                  </p>
                  <button
                    onClick={() => setFeedTab('foryou')}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-primary text-primary-foreground font-semibold"
                  >
                    <Sparkles className="h-4 w-4" />
                    Explore Polls
                  </button>
                </>
              ) : feedTab === 'following' ? (
                <>
                  <div className="text-6xl">✨</div>
                  <h2 className="text-2xl font-display font-bold">No new polls from creators you follow</h2>
                  <p className="text-foreground/60">Check back later or explore more creators</p>
                  <button
                    onClick={() => setFeedTab('foryou')}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-primary text-primary-foreground font-semibold"
                  >
                    <Sparkles className="h-4 w-4" />
                    Explore For You
                  </button>
                </>
              ) : (
                <>
                  <div className="text-6xl">🎉</div>
                  <h2 className="text-2xl font-display font-bold">You're all caught up!</h2>
                  <p className="text-foreground/60">Check back later for more polls</p>
                  <button
                    onClick={() => {
                      setCurrentIndex(0);
                      refetch();
                    }}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-primary text-primary-foreground font-semibold"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Swipe Hints - only show if user hasn't voted on current poll */}
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
        
        {/* Navigation for polls */}
        {hasMorePolls && currentPoll && polls && polls.length > 1 && (
          <div className="flex justify-center items-center gap-4 mt-4">
            <button
              onClick={() => navigateWithSlide('right')}
              disabled={currentIndex === 0}
              className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-5 w-5 text-white/80" />
            </button>
            
            {/* Poll indicators */}
            <div className="flex gap-1.5">
              {polls.slice(0, 10).map((poll, idx) => (
                <button
                  key={poll.id}
                  onClick={() => {
                    if (idx < currentIndex) {
                      navigateWithSlide('right');
                      setTimeout(() => setCurrentIndex(idx), 50);
                    } else if (idx > currentIndex) {
                      navigateWithSlide('left');
                      setTimeout(() => setCurrentIndex(idx), 50);
                    }
                  }}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === currentIndex 
                      ? 'bg-primary w-4' 
                      : votedPollIds.has(poll.id)
                        ? 'bg-primary/40'
                        : 'bg-muted-foreground/30'
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
              className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-5 w-5 text-white/80" />
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
    </AppLayout>
  );
}