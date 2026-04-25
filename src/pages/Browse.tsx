import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { applyAgeSequencing } from '@/lib/ageSequencing';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Share2, Flame, Check, ChevronUp, X, ArrowLeft, Radio, Send, Search, Trophy, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { BrowseFeedNudgeCard } from '@/components/onboarding/GuestNudges';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import PollOptionImage from '@/components/poll/PollOptionImage';
import BottomNav from '@/components/layout/BottomNav';
import SharePollToFriendSheet from '@/components/messages/SharePollToFriendSheet';
import { usePollReactions } from '@/hooks/usePollReactions';

interface BrowsePoll {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  image_a_url: string | null;
  image_b_url: string | null;
  category: string | null;
  created_at: string;
  expiry_type?: string | null;
  ends_at?: string | null;
  isClosed?: boolean;
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

function FireReactionButton({ pollId }: { pollId: string }) {
  const { count, reacted, toggle, canReact } = usePollReactions(pollId);
  return (
    <button
      onClick={() => {
        if (!canReact) {
          toast.info('Sign in to react 🔥');
          return;
        }
        toggle();
      }}
      className={`min-w-10 h-10 px-2 rounded-full backdrop-blur-sm border flex items-center justify-center gap-1 transition-all ${
        reacted
          ? 'bg-orange-500/20 border-orange-500/40 text-orange-500 scale-110'
          : 'bg-background/80 border-border/50 text-foreground hover:bg-orange-500/10'
      }`}
      aria-label={reacted ? 'Remove fire reaction' : 'Add fire reaction'}
    >
      <Flame className={`h-4 w-4 ${reacted ? 'fill-current' : ''}`} />
      {count > 0 && (
        <span className="text-[10px] font-bold tabular-nums">
          {count > 999 ? `${(count / 1000).toFixed(1)}k` : count}
        </span>
      )}
    </button>
  );
}

// Single full-screen card
function BrowseCard({
  poll,
  userChoice,
  isActive,
  isSignedIn,
  onVote,
  onShare,
  onSendToFriend,
}: {
  poll: BrowsePoll;
  userChoice: string | null;
  isActive: boolean;
  isSignedIn: boolean;
  onVote: () => void;
  onShare: () => void;
  onSendToFriend: () => void;
}) {
  // Images handled by PollOptionImage component
  const isCloseResult = !isSignedIn && poll.totalVotes >= 5 && poll.percentA >= 45 && poll.percentA <= 55;

  return (
    <div className="h-full w-full flex flex-col relative bg-background">
      {/* Question overlay at top */}
      <div className="shrink-0 px-3 py-1.5 bg-gradient-to-b from-background via-background/90 to-transparent z-20">
        <p className="font-display font-bold text-[13px] leading-tight pr-16 line-clamp-2">{poll.question}</p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {poll.category && (
            <span className="inline-block px-1.5 py-0 rounded-full bg-primary/10 text-primary text-[9px] font-medium">
              {poll.category}
            </span>
          )}
          {poll.isClosed && (
            <span className="inline-block px-1.5 py-0 rounded-full bg-muted text-muted-foreground text-[9px] font-medium border border-border">
              🔒 Closed
            </span>
          )}
        </div>
      </div>

      {/* Side action buttons */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-4 items-end">
        {isSignedIn && (
          <button
            onClick={onSendToFriend}
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors shadow-lg"
            aria-label="Send in chat"
          >
            <Send className="h-4 w-4" />
          </button>
        )}
        <button onClick={onShare} className="w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 flex items-center justify-center text-foreground hover:bg-primary/10 transition-colors">
          <Share2 className="h-4 w-4" />
        </button>
        <FireReactionButton pollId={poll.id} />
      </div>


      {/* Images — filling available space */}
      <div className="flex-1 flex relative min-h-0">
        {/* Option A */}
        <div className="w-1/2 h-full relative overflow-hidden">
          <PollOptionImage imageUrl={poll.image_a_url} option={poll.option_a} question={poll.question} side="A" maxLogoSize="65%" loading="lazy" variant="browse" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          {poll.winner === 'A' && <div className="absolute inset-0 border-2 border-green-500/60 pointer-events-none" />}
          <div className="absolute bottom-0 left-0 right-0 p-2.5 text-white">
            <div className="flex items-center gap-1.5 mb-0.5">
              {userChoice === 'A' && (
                <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                  <Check className="h-2.5 w-2.5 text-white" />
                </div>
              )}
              <span className="font-bold text-[13px] leading-tight line-clamp-2 break-words">{poll.option_a}</span>
            </div>
            <span className={`text-xl font-display font-bold ${poll.winner === 'A' ? 'text-green-400' : 'text-white/70'}`}>
              {poll.percentA}%
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="absolute inset-y-0 left-1/2 w-[2px] bg-white/20 z-10" />

        {/* Option B */}
        <div className="w-1/2 h-full relative overflow-hidden">
          <PollOptionImage imageUrl={poll.image_b_url} option={poll.option_b} question={poll.question} side="B" maxLogoSize="65%" loading="lazy" variant="browse" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          {poll.winner === 'B' && <div className="absolute inset-0 border-2 border-green-500/60 pointer-events-none" />}
          <div className="absolute bottom-0 left-0 right-0 p-2.5 text-white">
            <div className="flex items-center gap-1.5 mb-0.5">
              {userChoice === 'B' && (
                <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                  <Check className="h-2.5 w-2.5 text-white" />
                </div>
              )}
              <span className="font-bold text-[13px] leading-tight line-clamp-2 break-words">{poll.option_b}</span>
            </div>
            <span className={`text-xl font-display font-bold ${poll.winner === 'B' ? 'text-green-400' : 'text-white/70'}`}>
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

        {/* Nudge: Vote from Home for unvoted polls (hide when closed) */}
        {!userChoice && !poll.isClosed && (
          <button
            onClick={onVote}
            className="w-full text-center text-xs text-primary/80 hover:text-primary transition-colors py-0.5"
          >
            Vote on today's battles from Home →
          </button>
        )}
        {poll.isClosed && (
          <p className="w-full text-center text-[11px] text-muted-foreground py-0.5">
            Results only — voting has ended
          </p>
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
  
  const [shareToFriendPoll, setShareToFriendPoll] = useState<BrowsePoll | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
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
        .limit(liveFilter ? 300 : 250);

      if (pollsError) throw pollsError;
      if (!polls || polls.length === 0) return [];

      const pollIds = polls.map(p => p.id);
      const { data: results, error: resultsError } = await supabase.rpc('get_poll_results', { poll_ids: pollIds });
      if (resultsError) throw resultsError;
      const resultsMap = new Map(results?.map((r: any) => [r.poll_id, r]) || []);

      const sampleIds = pollIds.slice(0, 30);
      const { data: demoVotes, error: demoVotesError } = await supabase
        .from('votes')
        .select('poll_id, choice, voter_gender, voter_age_range, voter_city')
        .in('poll_id', sampleIds)
        .limit(1000);

      if (demoVotesError) throw demoVotesError;

      const demoMap = new Map<string, any[]>();
      demoVotes?.forEach(v => {
        if (!demoMap.has(v.poll_id)) demoMap.set(v.poll_id, []);
        demoMap.get(v.poll_id)!.push(v);
      });

      let enriched = polls.map(p => {
        const r = resultsMap.get(p.id) as any;
        const total = r?.total_votes || 0;
        const votesA = r?.votes_a || 0;
        const votesB = r?.votes_b || 0;
        const pctA = total > 0 ? Math.round((votesA / total) * 100) : 50;
        const pctB = 100 - pctA;
        const isClosed = (p as any).expiry_type !== 'evergreen' && p.ends_at && new Date(p.ends_at) <= new Date();
        return {
          ...p,
          isClosed,
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

  // Generate a daily seed that changes each calendar day + a per-visit jitter
  const [sessionSeed] = useState(() => {
    const today = new Date();
    const daySeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    return daySeed + Math.random(); // daily base + per-visit variation
  });

  const sortedFeed = useMemo(() => {
    if (!feedPolls || feedPolls.length === 0) return [];

    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const h24Ago = now - 24 * 60 * 60 * 1000;

    const seededRandom = (seed: number, index: number) => {
      const x = Math.sin(seed * 9999 + index * 7919) * 10000;
      return x - Math.floor(x);
    };

    const votedIds = userVotes ? new Set(Array.from(userVotes.keys())) : new Set<string>();
    const recencySort = <T extends { created_at: string; score: number }>(a: T, b: T) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || b.score - a.score;

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

    const scored = feedPolls.map((p, i) => {
      const createdAt = new Date(p.created_at).getTime();
      const isToday = createdAt > h24Ago;
      const isRecent = createdAt > weekAgo;
      const recencyScore = isToday ? 200 : isRecent ? 30 : 0;
      const voteScore = Math.min(p.totalVotes / 10, 40);
      const debateScore = p.totalVotes >= 5 ? (50 - Math.abs(p.percentA - 50)) * 0.6 : 0;
      const randomBoost = (seededRandom(sessionSeed, i) - 0.5) * 70;
      return { ...p, score: recencyScore + voteScore + debateScore + randomBoost };
    });

    const freshPolls = scored.filter((p) => new Date(p.created_at).getTime() > h24Ago);
    const olderPolls = scored.filter((p) => new Date(p.created_at).getTime() <= h24Ago);

    const freshUnvoted = freshPolls.filter((p) => !votedIds.has(p.id)).sort(recencySort);
    const freshVoted = freshPolls.filter((p) => votedIds.has(p.id)).sort(recencySort);

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
  }, [feedPolls, profile?.age_range, userVotes, targetPollId, sessionSeed]);

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
    // Browse is results-only — redirect to home for voting
    toast.info('Vote on today\'s battles from the Home screen! 🔥');
    navigate('/home');
  }, [user, navigate]);


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
      {/* Top header — search trigger + (optional) live filter */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-background z-30">
        {liveFilter && (
          <button onClick={() => navigate(-1)} className="p-1 rounded-full hover:bg-muted/50">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
        )}
        {liveFilter ? (
          <>
            <Radio className="h-4 w-4 text-destructive animate-pulse" />
            <span className="text-sm font-display font-bold text-foreground">Live Debates</span>
          </>
        ) : (
          <span className="text-sm font-display font-bold text-foreground">Browse</span>
        )}

        {searchOpen ? (
          <div className="flex-1 flex items-center gap-2 ml-1">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Search polls, brands, options…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-muted/40 border-border/60 rounded-lg"
              />
            </div>
            <button
              onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
              className="p-1 rounded-full hover:bg-muted/50 text-muted-foreground"
              aria-label="Close search"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/50 hover:bg-muted transition-colors text-muted-foreground"
            aria-label="Search"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="text-[11px] font-medium">{visibleFeed.length}</span>
          </button>
        )}
      </div>

      {visibleFeed.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">No polls match "{searchQuery}"</p>
        </div>
      ) : (
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-scroll snap-y snap-mandatory pb-16"
          style={{ scrollSnapType: 'y mandatory' }}
        >
          {visibleFeed.map((poll, i) => (
            <div key={poll.id}>
              {/* NUDGE 2: Insert signup card after 5th card for guests */}
              {i === 5 && !user && !feedNudgeDismissed && !searchQuery && (
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
                  onSendToFriend={() => setShareToFriendPoll(poll)}
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
