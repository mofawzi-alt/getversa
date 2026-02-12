import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import PollCard from '@/components/poll/PollCard';
import { Loader2, SkipForward, Home } from 'lucide-react';
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

function rotatePollsByCategory(polls: Poll[]): Poll[] {
  if (polls.length <= 1) return polls;
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

  if (buckets.size === 0) return polls;

  const result: Poll[] = [];
  let lastCategory = '';
  const activeBuckets = [...buckets.keys()];

  while (activeBuckets.length > 0 || uncategorized.length > 0) {
    let placed = false;
    for (let i = 0; i < activeBuckets.length; i++) {
      const cat = activeBuckets[i];
      if (cat === lastCategory && activeBuckets.length > 1) continue;
      const bucket = buckets.get(cat)!;
      result.push(bucket.shift()!);
      lastCategory = cat;
      placed = true;
      if (bucket.length === 0) activeBuckets.splice(i, 1);
      break;
    }
    if (!placed && uncategorized.length > 0) {
      result.push(uncategorized.shift()!);
      lastCategory = '';
    } else if (!placed && activeBuckets.length > 0) {
      const cat = activeBuckets[0];
      const bucket = buckets.get(cat)!;
      result.push(bucket.shift()!);
      lastCategory = cat;
      if (bucket.length === 0) activeBuckets.splice(0, 1);
    } else if (!placed) {
      break;
    }
  }
  result.push(...uncategorized);
  return result;
}

export default function SwipeFeed() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);

  const searchParams = new URLSearchParams(window.location.search);
  const targetPollId = searchParams.get('pollId');
  const [result, setResult] = useState<VoteResult | null>(null);
  const [animatingCard, setAnimatingCard] = useState<'left' | 'right' | null>(null);
  const [votedPollIds, setVotedPollIds] = useState<Set<string>>(new Set());
  const [showSignupModal, setShowSignupModal] = useState(false);

  const { data: polls, isLoading, refetch } = useQuery({
    queryKey: ['feed-polls', user?.id],
    queryFn: async () => {
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

      if (profile) {
        allPolls = allPolls.filter(p => {
          if (p.target_gender && p.target_gender !== 'All' && profile.gender && p.target_gender !== profile.gender) return false;
          if (p.target_age_range && p.target_age_range !== 'All' && profile.age_range && p.target_age_range !== profile.age_range) return false;
          if (p.target_country && p.target_country !== 'All' && profile.country && p.target_country !== profile.country) return false;
          return true;
        });
      }

      let rotated = rotatePollsByCategory(allPolls);

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

  // Realtime new polls
  useEffect(() => {
    const ch = supabase
      .channel('polls-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'polls' }, () => {
        queryClient.invalidateQueries({ queryKey: ['feed-polls'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queryClient]);

  const voteMutation = useMutation({
    mutationFn: async ({ pollId, choice }: { pollId: string; choice: 'A' | 'B' }) => {
      if (!user) {
        const count = incrementGuestVotes();
        if (count > GUEST_VOTE_LIMIT) {
          setShowSignupModal(true);
          throw new Error('GUEST_LIMIT');
        }
        const percentA = choice === 'A' ? 100 : 0;
        if (count >= GUEST_VOTE_LIMIT) {
          setTimeout(() => setShowSignupModal(true), 2000);
        }
        return { pollId, choice, percentA, percentB: 100 - percentA, totalVotes: 1 };
      }

      if (votedPollIds.has(pollId)) throw new Error('ALREADY_VOTED');

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
      return { pollId, choice, percentA, percentB: totalVotes > 0 ? 100 - percentA : 0, totalVotes };
    },
    onSuccess: (data) => {
      setResult(data);
      setAnimatingCard(null);
      setVotedPollIds(prev => new Set([...prev, data.pollId]));
    },
    onError: (error: any) => {
      setAnimatingCard(null);
      if (error.message === 'GUEST_LIMIT') return;
      if (error.message === 'ALREADY_VOTED' || error.message?.includes('duplicate')) {
        toast.error('You already voted on this poll');
        handleNextPoll();
        return;
      }
      toast.error('Failed to vote');
    },
  });

  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    if (!polls || currentIndex >= polls.length || result) return;
    if (!user && getGuestVoteCount() >= GUEST_VOTE_LIMIT) {
      setShowSignupModal(true);
      return;
    }
    const poll = polls[currentIndex];
    if (votedPollIds.has(poll.id)) { handleNextPoll(); return; }
    const choice = direction === 'right' ? 'B' : 'A';
    setAnimatingCard(direction);
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (result) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); handleSwipe('left'); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); handleSwipe('right'); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSwipe, result]);

  const currentPoll = polls?.[currentIndex];
  const hasMorePolls = polls && currentIndex < polls.length;
  const totalPolls = polls?.length || 0;
  const progress = totalPolls > 0 ? ((currentIndex) / totalPolls) * 100 : 0;

  // Full-screen immersive loading
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading perspectives…</p>
        </div>
      </div>
    );
  }

  // Full-screen immersive layout — no AppLayout wrapper
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      {/* Minimal top bar — compact */}
      {hasMorePolls && (
        <div className="safe-area-top px-4 pt-1.5 pb-1 flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium">
            {currentIndex + 1} / {totalPolls}
          </span>
          {/* Thin progress bar */}
          <div className="flex-1 mx-3 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <button
            onClick={handleSkip}
            className="flex items-center gap-1 text-xs text-muted-foreground/70 hover:text-muted-foreground transition-colors"
          >
            <SkipForward className="h-3.5 w-3.5" />
            Skip
          </button>
        </div>
      )}

      {/* Main content area — full height, no padding */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {hasMorePolls && currentPoll ? (
          <div className="flex-1 flex flex-col min-h-0">
            <PollCard
              key={currentPoll.id}
              poll={currentPoll}
              onSwipe={handleSwipe}
              isAnimating={result ? null : animatingCard}
              result={result && result.pollId === currentPoll.id ? result : null}
              onResultDone={handleNextPoll}
            />
          </div>
        ) : (
          /* Caught up state */
          <div className="w-full max-w-md overflow-y-auto max-h-full pb-8 scrollbar-hide">
            <CaughtUpInsights onRefresh={() => { setCurrentIndex(0); setResult(null); refetch(); }} />
            <div className="mt-4 px-2">
              <Button
                onClick={() => navigate('/')}
                variant="outline"
                className="w-full gap-2 h-12 rounded-xl border-border"
              >
                <Home className="h-4 w-4" />
                Back to Home
              </Button>
            </div>
          </div>
        )}
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
    </div>
  );
}
