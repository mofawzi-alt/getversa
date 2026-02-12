import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import PollCard from '@/components/poll/PollCard';
import { Loader2, RefreshCw, Sparkles, SkipForward } from 'lucide-react';
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
}

// Rotate polls so no two consecutive polls share the same index_category
function rotatePollsByCategory(polls: Poll[]): Poll[] {
  if (polls.length <= 1) return polls;

  // Group by index_category
  const categories = ['identity', 'social', 'consumption', 'tech', 'cultural'];
  const buckets = new Map<string, Poll[]>();
  const uncategorized: Poll[] = [];

  polls.forEach(p => {
    const cat = (p as any).index_category;
    if (cat && categories.includes(cat)) {
      if (!buckets.has(cat)) buckets.set(cat, []);
      buckets.get(cat)!.push(p);
    } else {
      uncategorized.push(p);
    }
  });

  // If no categorized polls, return as-is
  if (buckets.size === 0) return polls;

  // Round-robin interleave from each bucket
  const result: Poll[] = [];
  let lastCategory = '';
  const activeBuckets = [...buckets.keys()];

  while (activeBuckets.length > 0 || uncategorized.length > 0) {
    let placed = false;

    // Try to pick from a different category than last
    for (let i = 0; i < activeBuckets.length; i++) {
      const cat = activeBuckets[i];
      if (cat === lastCategory && activeBuckets.length > 1) continue;

      const bucket = buckets.get(cat)!;
      result.push(bucket.shift()!);
      lastCategory = cat;
      placed = true;

      if (bucket.length === 0) {
        activeBuckets.splice(i, 1);
      }
      break;
    }

    // If nothing placed (only one category left or empty), use uncategorized as spacer
    if (!placed && uncategorized.length > 0) {
      result.push(uncategorized.shift()!);
      lastCategory = '';
    } else if (!placed && activeBuckets.length > 0) {
      // Only one category left, just drain it
      const cat = activeBuckets[0];
      const bucket = buckets.get(cat)!;
      result.push(bucket.shift()!);
      lastCategory = cat;
      if (bucket.length === 0) activeBuckets.splice(0, 1);
    } else if (!placed) {
      break;
    }
  }

  // Append remaining uncategorized
  result.push(...uncategorized);
  return result;
}

export default function SwipeFeed() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);

  // Check for a specific poll to load first (from Home tap)
  const searchParams = new URLSearchParams(window.location.search);
  const targetPollId = searchParams.get('pollId');
  const [result, setResult] = useState<VoteResult | null>(null);
  const [animatingCard, setAnimatingCard] = useState<'left' | 'right' | null>(null);
  const [votedPollIds, setVotedPollIds] = useState<Set<string>>(new Set());
  const [newPollsCount, setNewPollsCount] = useState(0);
  const [showSignupModal, setShowSignupModal] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch polls - DB-level filtering, category rotation, 40-60 active polls
  const { data: polls, isLoading, refetch } = useQuery({
    queryKey: ['feed-polls', user?.id],
    queryFn: async () => {
      const now = new Date().toISOString();

      let votedIds: string[] = [];
      if (user) {
        const { data: userVotes } = await supabase
          .from('votes')
          .select('poll_id')
          .eq('user_id', user.id);

        votedIds = userVotes?.map(v => v.poll_id) || [];
        setVotedPollIds(new Set(votedIds));
      }

      let query = supabase
        .from('polls')
        .select('*')
        .eq('is_active', true)
        .neq('is_archived', true)
        
        .order('is_daily_poll', { ascending: false })
        .order('created_at', { ascending: false });

      if (votedIds.length > 0) {
        query = query.not('id', 'in', `(${votedIds.join(',')})`);
      }

      query = query.limit(60);

      const { data: fetchedPolls, error: pollsError } = await query;
      if (pollsError) throw pollsError;

      let allPolls = fetchedPolls || [];

      // Demographic targeting
      if (profile) {
        allPolls = allPolls.filter(p => {
          if (p.target_gender && p.target_gender !== 'All' && profile.gender && p.target_gender !== profile.gender) return false;
          if (p.target_age_range && p.target_age_range !== 'All' && profile.age_range && p.target_age_range !== profile.age_range) return false;
          if (p.target_country && p.target_country !== 'All' && profile.country && p.target_country !== profile.country) return false;
          return true;
        });
      }

      // Category rotation: reorder to avoid consecutive same index_category
      let rotated = rotatePollsByCategory(allPolls);

      // If a specific poll was requested, move it to the front
      if (targetPollId) {
        const targetIdx = rotated.findIndex(p => p.id === targetPollId);
        if (targetIdx > 0) {
          const [target] = rotated.splice(targetIdx, 1);
          rotated.unshift(target);
        }
      }

      return rotated;
    },
  });

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

  // Lean vote mutation - only fetches percentages and total count
  const voteMutation = useMutation({
    mutationFn: async ({ pollId, choice }: { pollId: string; choice: 'A' | 'B' }) => {
      // Guest mode
      if (!user) {
        const count = incrementGuestVotes();
        if (count > GUEST_VOTE_LIMIT) {
          setShowSignupModal(true);
          throw new Error('GUEST_LIMIT');
        }
        // Fake result for guest
        const total = 1;
        const percentA = choice === 'A' ? 100 : 0;
        const percentB = 100 - percentA;
        if (count >= GUEST_VOTE_LIMIT) {
          setTimeout(() => setShowSignupModal(true), 2000);
        }
        return { pollId, choice, percentA, percentB, totalVotes: total };
      }

      if (votedPollIds.has(pollId)) {
        throw new Error('ALREADY_VOTED');
      }

      const { error: voteError } = await supabase
        .from('votes')
        .insert({ poll_id: pollId, user_id: user.id, choice });

      if (voteError) throw voteError;

      // Lean fetch: only vote counts
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
      setAnimatingCard(null); // Stop card exit animation, freeze in place
      setVotedPollIds(prev => new Set([...prev, data.pollId]));
    },
    onError: (error: any) => {
      setAnimatingCard(null);
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
    if (!polls || currentIndex >= polls.length || result) return;

    if (!user && getGuestVoteCount() >= GUEST_VOTE_LIMIT) {
      setShowSignupModal(true);
      return;
    }

    const poll = polls[currentIndex];

    

    if (votedPollIds.has(poll.id)) {
      handleNextPoll();
      return;
    }

    const choice = direction === 'right' ? 'B' : 'A';
    setAnimatingCard(direction);
    // Fire vote immediately, card will freeze when result arrives
    voteMutation.mutate({ pollId: poll.id, choice });
  }, [polls, currentIndex, voteMutation, user, votedPollIds, result]);

  const handleSkip = useCallback(() => {
    if (!polls || currentIndex >= polls.length || result) return;
    setResult(null);
    setAnimatingCard(null);
    setCurrentIndex(prev => prev + 1);
  }, [polls, currentIndex, result]);

  const handleNextPoll = useCallback(() => {
    setResult(null);
    setAnimatingCard(null);
    setCurrentIndex(prev => prev + 1);
  }, []);

  // Keyboard support: ← for Option A, → for Option B
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (result) return;
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
            {currentPoll && !result && (
              <ShareButton
                pollId={currentPoll.id}
                pollQuestion={currentPoll.question}
                optionA={currentPoll.option_a}
                optionB={currentPoll.option_b}
                variant="icon"
              />
            )}
            <button
              onClick={() => { setNewPollsCount(0); setCurrentIndex(0); setResult(null); refetch(); }}
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
        >
          {hasMorePolls && currentPoll ? (
            <div className="w-full flex flex-col items-center">
              <PollCard
                key={currentPoll.id}
                poll={currentPoll}
                onSwipe={handleSwipe}
                isAnimating={result ? null : animatingCard}
                result={result && result.pollId === currentPoll.id ? result : null}
                onResultDone={handleNextPoll}
              />
              {/* Skip button - only visible before voting */}
              {!result && (
                <button
                  onClick={handleSkip}
                  className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors py-2 px-4"
                >
                  <SkipForward className="h-3.5 w-3.5" />
                  Skip
                </button>
              )}
            </div>
          ) : (
            <CaughtUpInsights onRefresh={() => { setCurrentIndex(0); setResult(null); refetch(); }} />
          )}
        </div>
      </div>

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
