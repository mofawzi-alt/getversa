import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { applyAgeSequencing } from '@/lib/ageSequencing';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Share2, Flame, Check, ChevronUp, X, ArrowLeft, Radio } from 'lucide-react';
import { BrowseFeedNudgeCard } from '@/components/onboarding/GuestNudges';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import PollOptionImage from '@/components/poll/PollOptionImage';
import BottomNav from '@/components/layout/BottomNav';

interface BrowsePoll {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  image_a_url: string | null;
  image_b_url: string | null;
  category: string | null;
  created_at: string;
  totalVotes: number;
  votesA: number;
  votesB: number;
  percentA: number;
  percentB: number;
  winner: 'A' | 'B';
  winnerPct: number;
  demographicInsight: string | null;
}

function generateDemographicInsight(votes: any[]): string | null {
  if (!votes || votes.length < 5) return null;

  // Gender split
  const genderMap: Record<string, { a: number; b: number }> = {};
  votes.forEach(v => {
    const g = v.voter_gender || 'Unknown';
    if (!genderMap[g]) genderMap[g] = { a: 0, b: 0 };
    if (v.choice === 'A') genderMap[g].a++; else genderMap[g].b++;
  });

  const genders = Object.entries(genderMap).filter(([k]) => k !== 'Unknown' && k !== 'Prefer not to say');
  if (genders.length >= 2) {
    const [g1Name, g1] = genders[0];
    const [g2Name, g2] = genders[1];
    const g1PrefA = g1.a / (g1.a + g1.b);
    const g2PrefA = g2.a / (g2.a + g2.b);
    if (Math.abs(g1PrefA - g2PrefA) > 0.15) {
      return `${g1Name} and ${g2Name} voted differently on this one`;
    }
  }

  // Age split
  const ageMap: Record<string, { a: number; b: number }> = {};
  votes.forEach(v => {
    const age = v.voter_age_range;
    if (!age) return;
    if (!ageMap[age]) ageMap[age] = { a: 0, b: 0 };
    if (v.choice === 'A') ageMap[age].a++; else ageMap[age].b++;
  });

  const ages = Object.entries(ageMap).filter(([, v]) => (v.a + v.b) >= 3);
  if (ages.length >= 2) {
    const sorted = ages.sort((a, b) => {
      const aRatio = a[1].a / (a[1].a + a[1].b);
      const bRatio = b[1].a / (b[1].a + b[1].b);
      return bRatio - aRatio;
    });
    const topAge = sorted[0][0];
    const bottomAge = sorted[sorted.length - 1][0];
    if (topAge !== bottomAge) {
      return `${topAge} and ${bottomAge} had the biggest opinion gap`;
    }
  }

  // City insight
  const cityMap: Record<string, number> = {};
  votes.forEach(v => {
    if (v.voter_city) cityMap[v.voter_city] = (cityMap[v.voter_city] || 0) + 1;
  });
  const topCity = Object.entries(cityMap).sort((a, b) => b[1] - a[1])[0];
  if (topCity && topCity[1] >= 3) {
    return `Most popular in ${topCity[0]}`;
  }

  return null;
}

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

// Single full-screen card
function BrowseCard({
  poll,
  userChoice,
  isActive,
  isSignedIn,
  onVote,
  onShare,
  onReact,
  reacted,
}: {
  poll: BrowsePoll;
  userChoice: string | null;
  isActive: boolean;
  isSignedIn: boolean;
  onVote: () => void;
  onShare: () => void;
  onReact: () => void;
  reacted: boolean;
}) {
  // Images handled by PollOptionImage component
  const isCloseResult = !isSignedIn && poll.totalVotes >= 5 && poll.percentA >= 45 && poll.percentA <= 55;

  return (
    <div className="h-full w-full flex flex-col relative bg-background">
      {/* Question overlay at top */}
      <div className="shrink-0 px-4 py-2.5 bg-gradient-to-b from-background via-background/90 to-transparent z-20">
        <p className="font-display font-bold text-sm leading-tight pr-10">{poll.question}</p>
        {poll.category && (
          <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
            {poll.category}
          </span>
        )}
      </div>

      {/* Side action buttons */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-4">
        <button onClick={onShare} className="w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 flex items-center justify-center text-foreground hover:bg-primary/10 transition-colors">
          <Share2 className="h-4 w-4" />
        </button>
        <button onClick={onReact} className={`w-10 h-10 rounded-full backdrop-blur-sm border flex items-center justify-center transition-all ${reacted ? 'bg-orange-500/20 border-orange-500/40 text-orange-500 scale-110' : 'bg-background/80 border-border/50 text-foreground hover:bg-orange-500/10'}`}>
          <Flame className={`h-4 w-4 ${reacted ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Images — filling available space */}
      <div className="flex-1 flex relative min-h-0">
        {/* Option A */}
        <div className="w-1/2 h-full relative overflow-hidden">
          <PollOptionImage imageUrl={poll.image_a_url} option={poll.option_a} question={poll.question} side="A" maxLogoSize="65%" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          {poll.winner === 'A' && <div className="absolute inset-0 border-2 border-green-500/60 pointer-events-none" />}
          <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
            <div className="flex items-center gap-1.5">
              {userChoice === 'A' && (
                <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
              <span className="font-bold text-sm truncate">{poll.option_a}</span>
            </div>
            <span className={`text-2xl font-display font-bold ${poll.winner === 'A' ? 'text-green-400' : 'text-white/70'}`}>
              {poll.percentA}%
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="absolute inset-y-0 left-1/2 w-[2px] bg-white/20 z-10" />

        {/* Option B */}
        <div className="w-1/2 h-full relative overflow-hidden">
          <PollOptionImage imageUrl={poll.image_b_url} option={poll.option_b} question={poll.question} side="B" maxLogoSize="65%" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          {poll.winner === 'B' && <div className="absolute inset-0 border-2 border-green-500/60 pointer-events-none" />}
          <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
            <div className="flex items-center gap-1.5">
              {userChoice === 'B' && (
                <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
              <span className="font-bold text-sm truncate">{poll.option_b}</span>
            </div>
            <span className={`text-2xl font-display font-bold ${poll.winner === 'B' ? 'text-green-400' : 'text-white/70'}`}>
              {poll.percentB}%
            </span>
          </div>
        </div>
      </div>

      {/* Bottom info bar — compact, no extra padding */}
      <div className="shrink-0 bg-background border-t border-border/30 px-4 py-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium">{poll.totalVotes.toLocaleString()} votes</span>
          {poll.demographicInsight && (
            <span className="text-[11px] text-muted-foreground italic">{poll.demographicInsight}</span>
          )}
        </div>

        {/* Result bar */}
        <div className="h-1.5 rounded-full bg-muted overflow-hidden flex">
          <div className="bg-primary h-full transition-all duration-500" style={{ width: `${poll.percentA}%` }} />
          <div className="bg-accent h-full transition-all duration-500" style={{ width: `${poll.percentB}%` }} />
        </div>

        {/* Nudge 3: Close result trigger for non-signed-in users */}
        {isCloseResult && (
          <button onClick={onVote} className="w-full text-center text-xs text-primary/80 hover:text-primary transition-colors py-0.5">
            ⚡ Too close to call — add your vote
          </button>
        )}

        {/* Add your vote CTA (only for unvoted polls) */}
        {!userChoice && (
          <motion.button
            onClick={onVote}
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-full py-2 rounded-xl bg-primary text-primary-foreground font-display font-bold text-sm"
          >
            Add Your Vote
          </motion.button>
        )}
      </div>
    </div>
  );
}

export default function Browse() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const liveFilter = searchParams.get('filter') === 'live';
  const targetPollId = searchParams.get('pollId');
  const { share } = useShareImage();
  const [reactedPolls, setReactedPolls] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const hasScrolledToTarget = useRef(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [feedNudgeDismissed, setFeedNudgeDismissed] = useState(false);
  const showSignupBanner = !user && activeIndex >= 10 && !bannerDismissed;

  // Fetch all polls with results — no auth required
  const { data: feedPolls, isLoading } = useQuery({
    queryKey: ['browse-feed', liveFilter],
    queryFn: async () => {
      let query = supabase
        .from('polls')
        .select('id, question, option_a, option_b, image_a_url, image_b_url, category, created_at, starts_at, ends_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (liveFilter) {
        const now = new Date().toISOString();
        query = query.lte('starts_at', now).gte('ends_at', now);
      }

      const { data: polls } = await query.limit(100);

      if (!polls || polls.length === 0) return [];

      const pollIds = polls.map(p => p.id);
      const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: pollIds });
      const resultsMap = new Map(results?.map((r: any) => [r.poll_id, r]) || []);

      const sampleIds = pollIds.slice(0, 30);
      const { data: demoVotes } = await supabase
        .from('votes')
        .select('poll_id, choice, voter_gender, voter_age_range, voter_city')
        .in('poll_id', sampleIds)
        .limit(1000);

      const demoMap = new Map<string, any[]>();
      demoVotes?.forEach(v => {
        if (!demoMap.has(v.poll_id)) demoMap.set(v.poll_id, []);
        demoMap.get(v.poll_id)!.push(v);
      });

      return polls.map(p => {
        const r = resultsMap.get(p.id) as any;
        const total = r?.total_votes || 0;
        const votesA = r?.votes_a || 0;
        const votesB = r?.votes_b || 0;
        const pctA = total > 0 ? Math.round((votesA / total) * 100) : 50;
        const pctB = 100 - pctA;
        return {
          ...p,
          totalVotes: total,
          votesA,
          votesB,
          percentA: pctA,
          percentB: pctB,
          winner: (pctA >= pctB ? 'A' : 'B') as 'A' | 'B',
          winnerPct: Math.max(pctA, pctB),
          demographicInsight: generateDemographicInsight(demoMap.get(p.id) || []),
        };
      });
    },
    staleTime: 1000 * 60 * 2,
  });

  const { data: userVotes } = useQuery({
    queryKey: ['browse-user-votes', user?.id],
    queryFn: async () => {
      if (!user) return new Map<string, string>();
      const { data } = await supabase
        .from('votes')
        .select('poll_id, choice')
        .eq('user_id', user.id);
      return new Map(data?.map(v => [v.poll_id, v.choice]) || []);
    },
    staleTime: 1000 * 60 * 2,
  });

  const sortedFeed = useMemo(() => {
    if (!feedPolls || feedPolls.length === 0) return [];

    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

    const scored = feedPolls.map(p => {
      const createdAt = new Date(p.created_at).getTime();
      const isRecent = createdAt > weekAgo;
      const recencyScore = isRecent ? 30 : 0;
      const voteScore = Math.min(p.totalVotes / 10, 40);
      const debateScore = p.totalVotes >= 5 ? (50 - Math.abs(p.percentA - 50)) * 0.6 : 0;
      return { ...p, score: recencyScore + voteScore + debateScore };
    });

    scored.sort((a, b) => b.score - a.score);

    // Apply age-based sequencing first
    const votedIds = userVotes ? new Set(Array.from(userVotes.keys())) : undefined;
    const ageSequenced = applyAgeSequencing(scored, profile?.age_range, votedIds);

    // Then diversify by category
    const result: typeof ageSequenced = [];
    const remaining = [...ageSequenced];
    let lastCategory: string | null = null;

    while (remaining.length > 0) {
      const idx = remaining.findIndex(p => (p.category || 'Other') !== lastCategory);
      const pick = idx >= 0 ? remaining.splice(idx, 1)[0] : remaining.splice(0, 1)[0];
      lastCategory = pick.category || 'Other';
      result.push(pick);
    }

    // If navigated with a target poll, move it to the front
    if (targetPollId) {
      const targetIdx = result.findIndex(p => p.id === targetPollId);
      if (targetIdx > 0) {
        const [target] = result.splice(targetIdx, 1);
        result.unshift(target);
      }
    }

    return result;
  }, [feedPolls, profile?.age_range, userVotes, targetPollId]);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const scrollTop = container.scrollTop;
    const cardHeight = container.clientHeight;
    const newIndex = Math.round(scrollTop / cardHeight);
    if (newIndex !== activeIndex) setActiveIndex(newIndex);
  }, [activeIndex]);

  const handleVote = useCallback((pollId: string) => {
    if (!user) {
      navigate('/auth');
      return;
    }
    navigate('/home');
  }, [user, navigate]);

  const handleReact = useCallback((pollId: string) => {
    setReactedPolls(prev => {
      const next = new Set(prev);
      if (next.has(pollId)) next.delete(pollId); else next.add(pollId);
      return next;
    });
  }, []);

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

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      {/* Live filter header */}
      {liveFilter && (
        <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-border/40 bg-background z-30">
          <button onClick={() => navigate(-1)} className="p-1 rounded-full hover:bg-muted/50">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <Radio className="h-4 w-4 text-destructive animate-pulse" />
          <span className="text-sm font-display font-bold text-foreground">Live Debates</span>
          <span className="text-xs text-muted-foreground ml-auto">{sortedFeed.length} active</span>
        </div>
      )}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-scroll snap-y snap-mandatory pb-16"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {sortedFeed.map((poll, i) => (
          <div key={poll.id}>
            {/* NUDGE 2: Insert signup card after 5th card for guests */}
            {i === 5 && !user && !feedNudgeDismissed && (
              <div
                className="snap-start snap-always"
                style={{ scrollSnapAlign: 'start', height: 'calc(100dvh - 4rem)' }}
              >
                <BrowseFeedNudgeCard onDismiss={() => setFeedNudgeDismissed(true)} />
              </div>
            )}
            <div
              className="snap-start snap-always"
              style={{ scrollSnapAlign: 'start', height: 'calc(100dvh - 4rem)' }}
            >
              <BrowseCard
                poll={poll}
                userChoice={userVotes?.get(poll.id) || null}
                isActive={i === activeIndex}
                isSignedIn={!!user}
                onVote={() => handleVote(poll.id)}
                onShare={() => share(poll)}
                onReact={() => handleReact(poll.id)}
                reacted={reactedPolls.has(poll.id)}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Scroll hint */}
      {activeIndex === 0 && sortedFeed.length > 1 && (
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
    </div>
  );
}
