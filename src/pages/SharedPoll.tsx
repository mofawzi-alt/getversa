import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getPollDisplayImageSrc } from '@/lib/pollImages';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowRight, Check } from 'lucide-react';
import { toast } from 'sonner';
import { lovable } from '@/integrations/lovable/index';


interface Poll {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  image_a_url: string | null;
  image_b_url: string | null;
  category: string | null;
}

type Phase = 'vote' | 'results' | 'friend-reveal' | 'signup' | 'continue';

export default function SharedPoll() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const sharerChoice = searchParams.get('c') as 'A' | 'B' | null;
  const sharerName = searchParams.get('by') || 'Your friend';

  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>('vote');
  const [myChoice, setMyChoice] = useState<'A' | 'B' | null>(null);
  const [percentA, setPercentA] = useState(50);
  const [percentB, setPercentB] = useState(50);
  const [totalVotes, setTotalVotes] = useState(0);
  const [isVoting, setIsVoting] = useState(false);
  const [showFriendChoice, setShowFriendChoice] = useState(false);

  // Guest continuation state
  const [extraPolls, setExtraPolls] = useState<Poll[]>([]);
  const [extraIndex, setExtraIndex] = useState(0);
  const [guestVoteCount, setGuestVoteCount] = useState(0);
  const [showNudge, setShowNudge] = useState(false);

  // Fetch the shared poll
  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, image_a_url, image_b_url, category')
        .eq('id', id)
        .maybeSingle();
      setPoll(data);
      setLoading(false);
    })();
  }, [id]);

  // If user is logged in and already voted, show results with their previous choice
  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      const { data: existing } = await supabase
        .from('votes')
        .select('choice')
        .eq('user_id', user.id)
        .eq('poll_id', id)
        .maybeSingle();
      if (!existing) return;
      setMyChoice(existing.choice as 'A' | 'B');
      const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: [id] });
      if (results?.[0]) {
        setPercentA(results[0].percent_a);
        setPercentB(results[0].percent_b);
        setTotalVotes(results[0].total_votes);
      }
      setPhase('results');
    })();
  }, [user, id]);

  const handleVote = useCallback(async (choice: 'A' | 'B') => {
    if (!poll || isVoting) return;
    setIsVoting(true);
    setMyChoice(choice);

    // Insert vote if logged in
    if (user) {
      await supabase.from('votes').insert({
        poll_id: poll.id,
        user_id: user.id,
        choice,
        ...(poll.category ? { category: poll.category } : {}),
      });
    }

    // Fetch results
    const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: [poll.id] });
    if (results?.[0]) {
      setPercentA(results[0].percent_a);
      setPercentB(results[0].percent_b);
      setTotalVotes(results[0].total_votes);
    }

    setPhase('results');
    setIsVoting(false);
  }, [poll, isVoting, user]);

  const handleNextFromResults = useCallback(() => {
    if (sharerChoice) {
      setPhase('friend-reveal');
    } else if (!user) {
      setPhase('signup');
    } else {
      navigate('/home', { replace: true });
    }
  }, [sharerChoice, user, navigate]);

  const handleAfterFriendReveal = useCallback(() => {
    if (!user) {
      setPhase('signup');
    } else {
      navigate('/home', { replace: true });
    }
  }, [user, navigate]);

  const handleSocialLogin = useCallback(async (provider: 'google' | 'apple') => {
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error('Sign in failed');
      return;
    }
    if (result.redirected) return;
    navigate('/home', { replace: true });
  }, [navigate]);

  const handleSkipSignup = useCallback(async () => {
    // Load 5 more polls for guest continuation
    const { data } = await supabase
      .from('polls')
      .select('id, question, option_a, option_b, image_a_url, image_b_url, category')
      .eq('is_active', true)
      .neq('id', id!)
      .limit(5);
    setExtraPolls(data || []);
    setExtraIndex(0);
    setGuestVoteCount(0);
    setPhase('continue');
  }, [id]);

  // Guest continuation voting
  const handleGuestVote = useCallback(async (choice: 'A' | 'B') => {
    const currentPoll = extraPolls[extraIndex];
    if (!currentPoll || isVoting) return;
    setIsVoting(true);

    // Track guest vote count
    const newCount = guestVoteCount + 1;
    setGuestVoteCount(newCount);

    // Show nudge every 5 votes
    if (newCount % 5 === 0) {
      setShowNudge(true);
      setIsVoting(false);
      return;
    }

    // Move to next poll
    if (extraIndex + 1 < extraPolls.length) {
      setExtraIndex(extraIndex + 1);
    } else {
      // Ran out of extra polls, show signup
      setPhase('signup');
    }
    setIsVoting(false);
  }, [extraPolls, extraIndex, isVoting, guestVoteCount]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 gap-4">
        <p className="text-lg font-semibold text-foreground">Poll not found</p>
        <Button onClick={() => navigate('/')}>Go to Versa</Button>
      </div>
    );
  }

  // ── VOTE PHASE ──
  if (phase === 'vote') {
    const imgA = getPollDisplayImageSrc({ imageUrl: poll.image_a_url, option: poll.option_a, question: poll.question, side: 'A' });
    const imgB = getPollDisplayImageSrc({ imageUrl: poll.image_b_url, option: poll.option_b, question: poll.question, side: 'B' });

    return (
      <div className="min-h-screen flex flex-col bg-[#0F172A]">
        {/* Header */}
        <div className="pt-safe px-4 pt-6 pb-2 text-center">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-white/40 mb-3">VERSA</p>
          <p className="text-sm text-white/60 italic">
            {sharerName} voted on this — what would you choose?
          </p>
        </div>

        {/* Question */}
        <div className="px-6 py-4 text-center">
          <h1 className="text-xl font-bold text-white leading-tight">{poll.question}</h1>
        </div>

        {/* Options */}
        <div className="flex-1 flex flex-col justify-center px-4 gap-4 pb-8">
          {/* Option A */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => handleVote('A')}
            disabled={isVoting}
            className="relative rounded-2xl overflow-hidden aspect-[16/10] w-full"
          >
            <img src={imgA} alt={poll.option_a} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <p className="text-white font-bold text-lg text-left">{poll.option_a}</p>
            </div>
          </motion.button>

          <div className="text-center text-white/30 text-xs font-bold tracking-widest">OR</div>

          {/* Option B */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => handleVote('B')}
            disabled={isVoting}
            className="relative rounded-2xl overflow-hidden aspect-[16/10] w-full"
          >
            <img src={imgB} alt={poll.option_b} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <p className="text-white font-bold text-lg text-left">{poll.option_b}</p>
            </div>
          </motion.button>
        </div>

        {isVoting && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-50">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        )}
      </div>
    );
  }

  // ── RESULTS PHASE (inline simple) ──
  if (phase === 'results' && myChoice) {
    const userPercent = myChoice === 'A' ? percentA : percentB;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 gap-6">
        <div className="text-center space-y-2">
          <p className="text-5xl font-bold text-foreground">{userPercent}%</p>
          <p className="text-muted-foreground">voted with you on "{poll.option_a} vs {poll.option_b}"</p>
        </div>
        <div className="w-full max-w-sm space-y-2">
          <div className="flex justify-between text-sm font-semibold text-foreground">
            <span>{poll.option_a} {percentA}%</span>
            <span>{percentB}% {poll.option_b}</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden flex">
            <div className="bg-primary h-full" style={{ width: `${percentA}%` }} />
            <div className="bg-secondary h-full" style={{ width: `${percentB}%` }} />
          </div>
          <p className="text-xs text-muted-foreground text-center">{totalVotes.toLocaleString()} votes</p>
        </div>
        <Button onClick={handleNextFromResults} className="rounded-2xl px-8">Next</Button>
      </div>
    );
  }

  // ── FRIEND REVEAL PHASE ──
  if (phase === 'friend-reveal' && myChoice && sharerChoice) {
    const sameChoice = myChoice === sharerChoice;
    const friendOption = sharerChoice === 'A' ? poll.option_a : poll.option_b;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F172A] px-6">
        <AnimatePresence>
          {!showFriendChoice ? (
            <motion.div
              key="reveal-btn"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center"
            >
              <p className="text-white/60 text-sm mb-6">Curious what they picked?</p>
              <Button
                onClick={() => setShowFriendChoice(true)}
                className="h-14 px-8 rounded-2xl font-bold text-base gap-2"
                style={{ backgroundColor: '#2563EB' }}
              >
                See how {sharerName} voted <ArrowRight className="h-5 w-5" />
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="reveal-result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 15 }}
                className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center ${
                  sameChoice ? 'bg-green-500/20' : 'bg-amber-500/20'
                }`}
              >
                <span className="text-4xl">{sameChoice ? '🤝' : '⚡'}</span>
              </motion.div>

              <h2 className="text-2xl font-bold text-white">
                {sameChoice ? 'You both chose the same!' : 'You chose differently!'}
              </h2>
              <p className="text-white/60 text-sm">
                {sharerName} chose <span className="text-white font-semibold">{friendOption}</span>
              </p>

              <Button
                onClick={handleAfterFriendReveal}
                className="mt-8 h-12 px-8 rounded-2xl font-bold gap-2"
                style={{ backgroundColor: '#2563EB' }}
              >
                Continue <ArrowRight className="h-5 w-5" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── SIGNUP PHASE ──
  if (phase === 'signup') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F172A] px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6 max-w-sm w-full"
        >
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-white/40">VERSA</p>
          <h2 className="text-xl font-bold text-white leading-tight">
            Create a free account to save your votes and see your taste profile.
          </h2>

          <div className="space-y-3 pt-4">
            <Button
              onClick={() => handleSocialLogin('google')}
              className="w-full h-14 rounded-2xl font-bold text-base gap-3 bg-white text-gray-900 hover:bg-gray-100"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Continue with Google
            </Button>
            <Button
              onClick={() => handleSocialLogin('apple')}
              className="w-full h-14 rounded-2xl font-bold text-base gap-3 bg-white text-gray-900 hover:bg-gray-100"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
              Continue with Apple
            </Button>
          </div>

          <button
            onClick={handleSkipSignup}
            className="text-white/40 text-sm font-medium pt-2 hover:text-white/60 transition-colors"
          >
            Skip for now
          </button>
        </motion.div>
      </div>
    );
  }

  // ── CONTINUE PHASE (Guest extra polls) ──
  if (phase === 'continue') {
    const currentPoll = extraPolls[extraIndex];

    // Nudge overlay
    if (showNudge) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F172A] px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-5 max-w-sm"
          >
            <p className="text-3xl">🔥</p>
            <h2 className="text-lg font-bold text-white">You've voted on {guestVoteCount} polls!</h2>
            <p className="text-white/50 text-sm">
              Create a free account to save your votes and discover your taste profile.
            </p>
            <div className="space-y-3 pt-2">
              <Button
                onClick={() => handleSocialLogin('google')}
                className="w-full h-12 rounded-2xl font-bold gap-3 bg-white text-gray-900 hover:bg-gray-100"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Continue with Google
              </Button>
              <Button
                onClick={() => handleSocialLogin('apple')}
                className="w-full h-12 rounded-2xl font-bold gap-3 bg-white text-gray-900 hover:bg-gray-100"
              >
                Continue with Apple
              </Button>
            </div>
            <button
              onClick={() => setShowNudge(false)}
              className="text-white/40 text-sm hover:text-white/60"
            >
              Keep voting
            </button>
          </motion.div>
        </div>
      );
    }

    if (!currentPoll) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F172A] px-6 gap-4">
          <p className="text-white text-lg font-bold">You're all caught up! 🎉</p>
          <Button onClick={() => setPhase('signup')} className="rounded-2xl">
            Create account to continue
          </Button>
        </div>
      );
    }

    const gImgA = getPollDisplayImageSrc({ imageUrl: currentPoll.image_a_url, option: currentPoll.option_a, question: currentPoll.question, side: 'A' });
    const gImgB = getPollDisplayImageSrc({ imageUrl: currentPoll.image_b_url, option: currentPoll.option_b, question: currentPoll.question, side: 'B' });

    return (
      <div className="min-h-screen flex flex-col bg-[#0F172A]">
        <div className="pt-safe px-4 pt-6 pb-2 text-center">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-white/40">VERSA</p>
        </div>
        <div className="px-6 py-4 text-center">
          <h1 className="text-xl font-bold text-white leading-tight">{currentPoll.question}</h1>
        </div>
        <div className="flex-1 flex flex-col justify-center px-4 gap-4 pb-8">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => handleGuestVote('A')}
            disabled={isVoting}
            className="relative rounded-2xl overflow-hidden aspect-[16/10] w-full"
          >
            <img src={gImgA} alt={currentPoll.option_a} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-4 left-4"><p className="text-white font-bold text-lg">{currentPoll.option_a}</p></div>
          </motion.button>
          <div className="text-center text-white/30 text-xs font-bold tracking-widest">OR</div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => handleGuestVote('B')}
            disabled={isVoting}
            className="relative rounded-2xl overflow-hidden aspect-[16/10] w-full"
          >
            <img src={gImgB} alt={currentPoll.option_b} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-4 left-4"><p className="text-white font-bold text-lg">{currentPoll.option_b}</p></div>
          </motion.button>
        </div>
      </div>
    );
  }

  return null;
}
