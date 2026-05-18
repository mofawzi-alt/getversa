import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { applyAgeSequencing } from '@/lib/ageSequencing';
import { useSkippedPollIds } from '@/hooks/useSkippedPollIds';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronUp, X, ArrowLeft, Radio } from 'lucide-react';
import { BrowseFeedNudgeCard } from '@/components/onboarding/GuestNudges';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

import BottomNav from '@/components/layout/BottomNav';
import SharePollToFriendSheet from '@/components/messages/SharePollToFriendSheet';
import BrowseCard, { computeDemoTags, type BrowsePoll, type DemoTag } from '@/components/browse/BrowseCard';
import { getOptimizedPollImageSrc } from '@/lib/pollImages';

// (BrowsePoll, DemoTag, computeDemoTags imported from shared BrowseCard component)

// Share image generator
function useShareImage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const c = document.createElement('canvas');
    c.style.display = 'none';
    document.body.appendChild(c);
    canvasRef.current = c;
    return () => { document.body.removeChild(c); };
  }, []);

  const generate = useCallback(async (poll: BrowsePoll): Promise<Blob | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const W = 1080, H = 1920;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0a0a0a');
    grad.addColorStop(0.5, '#111');
    grad.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    for (let y = 0; y < H; y += 60) {
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(0, y, W, 1);
    }

    // Question
    let y = 280;
    ctx.font = 'bold 56px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    const words = poll.question.split(' ');
    let lines: string[] = [], line = '';
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (ctx.measureText(t).width > W - 160) { lines.push(line); line = w; } else { line = t; }
    }
    if (line) lines.push(line);
    for (const l of lines) { ctx.fillText(l, W / 2, y); y += 70; }

    y += 60;
    // Option A
    ctx.font = 'bold 72px system-ui';
    ctx.fillStyle = poll.winner === 'A' ? '#22c55e' : 'rgba(255,255,255,0.5)';
    ctx.fillText(poll.option_a.length > 15 ? poll.option_a.slice(0, 15) + '…' : poll.option_a, W / 2, y);
    y += 50;
    ctx.font = 'bold 96px system-ui';
    ctx.fillText(`${poll.percentA}%`, W / 2, y);
    y += 70;
    ctx.font = '36px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('vs', W / 2, y);
    y += 70;
    // Option B
    ctx.font = 'bold 72px system-ui';
    ctx.fillStyle = poll.winner === 'B' ? '#22c55e' : 'rgba(255,255,255,0.5)';
    ctx.fillText(poll.option_b.length > 15 ? poll.option_b.slice(0, 15) + '…' : poll.option_b, W / 2, y);
    y += 50;
    ctx.font = 'bold 96px system-ui';
    ctx.fillText(`${poll.percentB}%`, W / 2, y);
    y += 80;

    ctx.font = '32px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText(`${poll.totalVotes.toLocaleString()} votes`, W / 2, y);

    ctx.font = 'bold 48px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('VERSA', W / 2, H - 80);
    ctx.font = '24px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillText('Decision Infrastructure', W / 2, H - 40);

    return new Promise(r => canvas.toBlob(r, 'image/png'));
  }, []);

  const share = useCallback(async (poll: BrowsePoll) => {
    try {
      const blob = await generate(poll);
      if (!blob) { toast.error('Failed to generate image'); return; }
      const file = new File([blob], 'versa-result.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'VERSA', text: `📊 ${poll.question}`, files: [file] });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'versa-result.png'; a.click();
        URL.revokeObjectURL(url);
        toast.success('Image downloaded! Share it 📸');
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') toast.error('Failed to share');
    }
  }, [generate]);

  return { share };
}

// FireReactionButton and BrowseCard moved to @/components/browse/BrowseCard

export default function Browse() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const liveFilter = searchParams.get('filter') === 'live';
  const targetPollId = searchParams.get('pollId');
  const { share } = useShareImage();
  
  const [shareToFriendPoll, setShareToFriendPoll] = useState<BrowsePoll | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const searchQuery = '';
  const [showSwipeHint, setShowSwipeHint] = useState(() => {
    if (!liveFilter) return false;
    return !localStorage.getItem('versa_live_swipe_hint_seen');
  });

  useEffect(() => {
    if (showSwipeHint) {
      const timer = setTimeout(() => {
        setShowSwipeHint(false);
        localStorage.setItem('versa_live_swipe_hint_seen', '1');
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [showSwipeHint]);
  const [feedNudgeDismissed, setFeedNudgeDismissed] = useState(false);
  const showSignupBanner = !user && activeIndex >= 10 && !bannerDismissed;

  // Fetch all polls with results — no auth required
  const { data: feedPolls, isLoading } = useQuery({
    queryKey: ['browse-feed', liveFilter, user?.id, profile?.age_range],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data: polls, error: pollsError } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, image_a_url, image_b_url, category, created_at, starts_at, ends_at, weight_score, expiry_type')
        .eq('is_active', true)
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .order('weight_score', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(liveFilter ? 60 : 40);

      if (pollsError) throw pollsError;
      if (!polls || polls.length === 0) return [];

      const pollIds = polls.map(p => p.id);
      const { data: results, error: resultsError } = await supabase.rpc('get_poll_results', { poll_ids: pollIds });
      if (resultsError) throw resultsError;
      const resultsMap = new Map(results?.map((r: any) => [r.poll_id, r]) || []);

      // Demo tags are nice-to-have — skip the heavy votes query on initial load
      // to dramatically speed up Browse cold-start. Cards still render with %.
      const demoMap = new Map<string, any[]>();

      let enriched = polls.map(p => {
        const r = resultsMap.get(p.id) as any;
        const total = r?.total_votes || 0;
        const votesA = r?.votes_a || 0;
        const votesB = r?.votes_b || 0;
        const pctA = total > 0 ? Math.round((votesA / total) * 100) : 50;
        const pctB = 100 - pctA;
        const isClosed = (p as any).expiry_type !== 'evergreen' && p.ends_at && new Date(p.ends_at) <= new Date();
        const winner: 'A' | 'B' = pctA >= pctB ? 'A' : 'B';
        const winnerPct = Math.max(pctA, pctB);
        return {
          ...p,
          isClosed,
          totalVotes: total,
          votesA,
          votesB,
          percentA: pctA,
          percentB: pctB,
          winner,
          winnerPct,
          egyptPct: winnerPct,
          demoTags: computeDemoTags(demoMap.get(p.id) || [], winnerPct, winner),
        };
      });

      if (liveFilter) {
        const nowDate = new Date();
        enriched = enriched.filter(p => {
          const hasStarted = p.starts_at ? new Date(p.starts_at) <= nowDate : true;
          const isExpired = p.ends_at ? new Date(p.ends_at) < nowDate : false;
          return hasStarted && !isExpired;
        });
      }

      return enriched;
    },
    staleTime: 1000 * 60 * 2,
  });

  const feedPollIds = useMemo(() => feedPolls?.map((p) => p.id) || [], [feedPolls]);

  const { data: userVotes } = useQuery({
    queryKey: ['browse-user-votes', user?.id, feedPollIds.join('|')],
    queryFn: async () => {
      if (!user || feedPollIds.length === 0) return new Map<string, string>();
      const { data } = await supabase
        .from('votes')
        .select('poll_id, choice')
        .eq('user_id', user.id)
        .in('poll_id', feedPollIds);
      return new Map(data?.map(v => [v.poll_id, v.choice]) || []);
    },
    staleTime: 1000 * 60 * 2,
    enabled: !user || feedPollIds.length > 0,
  });

  const { data: skippedIdsSet } = useSkippedPollIds();

  // Per-visit random seed so the Browse feed reshuffles every time the user opens it.
  const [sessionSeed] = useState(() => Math.random() * 1000000 + Date.now());

  const sortedFeed = useMemo(() => {
    if (!feedPolls || feedPolls.length === 0) return [];

    const skipSet = skippedIdsSet || new Set<string>();
    const filteredFeed = feedPolls.filter(p => !skipSet.has(p.id));
    if (filteredFeed.length === 0) return [];

    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const h24Ago = now - 24 * 60 * 60 * 1000;

    const seededRandom = (seed: number, index: number) => {
      const x = Math.sin(seed * 9999 + index * 7919) * 10000;
      return x - Math.floor(x);
    };

    const votedIds = userVotes ? new Set(Array.from(userVotes.keys())) : new Set<string>();

    const diversifyByCategory = <T extends { category: string | null }>(items: T[]) => {
      const result: T[] = [];
      const remaining = [...items];
      let lastCategory: string | null = null;

      while (remaining.length > 0) {
        const idx = remaining.findIndex((p) => (p.category || 'Other') !== lastCategory);
        const pick = idx >= 0 ? remaining.splice(idx, 1)[0] : remaining.splice(0, 1)[0];
        lastCategory = pick.category || 'Other';
        result.push(pick);
      }

      return result;
    };

    const scored = filteredFeed.map((p, i) => {
      const createdAt = new Date(p.created_at).getTime();
      const isToday = createdAt > h24Ago;
      const isRecent = createdAt > weekAgo;
      const recencyScore = isToday ? 80 : isRecent ? 20 : 0;
      const voteScore = Math.min(p.totalVotes / 10, 30);
      const debateScore = p.totalVotes >= 5 ? (50 - Math.abs(p.percentA - 50)) * 0.4 : 0;
      // Big per-visit random boost so the feed order shuffles every time the user opens Browse.
      const randomBoost = seededRandom(sessionSeed, i) * 200;
      return { ...p, score: recencyScore + voteScore + debateScore + randomBoost };
    });

    const freshPolls = scored.filter((p) => new Date(p.created_at).getTime() > h24Ago);
    const olderPolls = scored.filter((p) => new Date(p.created_at).getTime() <= h24Ago);

    const freshUnvoted = freshPolls.filter((p) => !votedIds.has(p.id)).sort((a, b) => b.score - a.score);
    const freshVoted = freshPolls.filter((p) => votedIds.has(p.id)).sort((a, b) => b.score - a.score);

    const olderUnvoted = olderPolls.filter((p) => !votedIds.has(p.id));
    const olderVoted = olderPolls.filter((p) => votedIds.has(p.id));
    olderUnvoted.sort((a, b) => b.score - a.score);
    olderVoted.sort((a, b) => b.score - a.score);

    const olderSequenced = applyAgeSequencing([...olderUnvoted, ...olderVoted], profile?.age_range, votedIds);
    const result = [...freshUnvoted, ...freshVoted, ...diversifyByCategory(olderSequenced)];

    if (targetPollId) {
      const targetIdx = result.findIndex((p) => p.id === targetPollId);
      if (targetIdx > 0) {
        const [target] = result.splice(targetIdx, 1);
        result.unshift(target);
      }
    }

    return result;
  }, [feedPolls, profile?.age_range, userVotes, targetPollId, sessionSeed, skippedIdsSet]);

  // Apply keyword search across question + options + category
  const visibleFeed = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedFeed;
    return sortedFeed.filter(p =>
      p.question.toLowerCase().includes(q) ||
      p.option_a.toLowerCase().includes(q) ||
      p.option_b.toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q)
    );
  }, [sortedFeed, searchQuery]);

  // Preload first 3 browse cards' images so the initial scroll feels instant
  // without saturating iOS WKWebView's small network queue.
  // IMPORTANT: preload the SAME optimized URL the card will request, otherwise
  // we double-download (full-res original AND the transformed variant).
  useEffect(() => {
    visibleFeed.slice(0, 3).forEach((p, idx) => {
      [p.image_a_url, p.image_b_url].forEach((url) => {
        if (!url) return;
        const img = new Image();
        img.decoding = 'async';
        if (idx < 2) (img as any).fetchPriority = 'high';
        img.src = getOptimizedPollImageSrc(url, { width: 900, height: 1200, quality: idx < 2 ? 74 : 68 }) || url;
      });
    });
  }, [visibleFeed]);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const scrollTop = container.scrollTop;
    const cardHeight = container.clientHeight;
    const newIndex = Math.round(scrollTop / cardHeight);
    if (newIndex !== activeIndex) setActiveIndex(newIndex);
  }, [activeIndex]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!sortedFeed.length) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background gap-4">
        <p className="text-muted-foreground">No polls to browse yet</p>
        <BottomNav />
      </div>
    );
  }

  const handleVote = useCallback(() => {
    if (!user) { navigate('/auth'); return; }
    toast.info("Vote on today's battles from the Home screen! 🔥");
    navigate('/home');
  }, [user, navigate]);

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      {/* Floating back chip — only when launched as Live Debates filter */}
      {liveFilter && (
        <div
          className="absolute left-3 z-40 flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-background/80 backdrop-blur-md border border-border/40 shadow-sm"
          style={{ top: 'calc(env(safe-area-inset-top, 8px) + 8px)' }}
        >
          <button onClick={() => navigate(-1)} aria-label="Back" className="p-0.5 -ml-0.5">
            <ArrowLeft className="h-4 w-4 text-foreground" />
          </button>
          <Radio className="h-3.5 w-3.5 text-destructive animate-pulse" />
          <span className="text-[11px] font-display font-bold text-foreground">Live Debates</span>
        </div>
      )}

      {visibleFeed.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">No polls match "{searchQuery}"</p>
        </div>
      ) : (
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-scroll snap-y snap-mandatory"
          style={{ scrollSnapType: 'y mandatory' }}
        >
          {visibleFeed.map((poll, i) => (
            <div key={poll.id}>
              {/* NUDGE 2: Insert signup card after 5th card for guests */}
              {i === 5 && !user && !feedNudgeDismissed && !searchQuery && (
                <div
                  className="snap-start snap-always w-full"
                  style={{ scrollSnapAlign: 'start', height: 'calc(100dvh - 64px - env(safe-area-inset-bottom, 0px))' }}
                >
                  <BrowseFeedNudgeCard onDismiss={() => setFeedNudgeDismissed(true)} />
                </div>
              )}
              <div
                className="snap-start snap-always w-full"
                style={{ scrollSnapAlign: 'start', height: 'calc(100dvh - 64px - env(safe-area-inset-bottom, 0px))' }}
              >
                <BrowseCard
                  poll={poll}
                  userChoice={userVotes?.get(poll.id) || null}
                  isActive={i === activeIndex}
                  isSignedIn={!!user}
                  onVote={() => handleVote()}
                  onShare={() => share(poll)}
                  onSendToFriend={() => setShareToFriendPoll(poll)}
                  eagerImages={i < 2}
                  safeAreaTop
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scroll hint */}
      {activeIndex === 0 && visibleFeed.length > 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1 pointer-events-none"
        >
          <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          </motion.div>
          <span className="text-[10px] text-muted-foreground font-medium">Scroll for more</span>
        </motion.div>
      )}

      {/* Live Debates swipe tutorial overlay — shown once */}
      <AnimatePresence>
        {showSwipeHint && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
            onClick={() => {
              setShowSwipeHint(false);
              localStorage.setItem('versa_live_swipe_hint_seen', '1');
            }}
          >
            <div className="flex flex-col items-center gap-4 text-center px-8">
              <motion.div
                animate={{ y: [0, -30, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                className="text-4xl"
              >
                👆
              </motion.div>
              <p className="text-lg font-display font-bold text-foreground">Swipe up to see more battles</p>
              <p className="text-sm text-muted-foreground">Scroll through all live debates like a feed</p>
              <span className="text-xs text-muted-foreground/60 mt-2">Tap anywhere to continue</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nudge 2: Sticky sign-up banner after 10 cards */}
      <AnimatePresence>
        {showSignupBanner && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-20 left-3 right-3 z-40 rounded-2xl bg-card/95 backdrop-blur-lg border border-border/60 shadow-lg px-4 py-3 flex items-center gap-3"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground leading-tight">Sign up free to add your vote to any battle</p>
              <p className="text-[10px] text-muted-foreground">30 seconds — no spam, ever</p>
            </div>
            <button
              onClick={() => navigate('/auth')}
              className="shrink-0 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold"
            >
              Sign Up
            </button>
            <button
              onClick={() => setBannerDismissed(true)}
              className="shrink-0 p-1.5 rounded-full hover:bg-muted/50 text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />

      <SharePollToFriendSheet
        pollId={shareToFriendPoll?.id || ''}
        pollQuestion={shareToFriendPoll?.question}
        open={!!shareToFriendPoll}
        onOpenChange={(o) => { if (!o) setShareToFriendPoll(null); }}
      />
    </div>
  );
}
