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

interface DemoTag {
  emoji: string;
  label: string;
  choice: 'A' | 'B';
}

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
  demoTags: DemoTag[];
  egyptPct: number;
}

// Compute up to 3 demographic deviation tags (>10% off national avg for the WINNING option)
function computeDemoTags(votes: any[], nationalWinnerPct: number, winner: 'A' | 'B'): DemoTag[] {
  if (!votes || votes.length < 8) return [];
  const tags: DemoTag[] = [];
  const threshold = 10; // percentage points

  const groupPct = (filterFn: (v: any) => boolean): { pct: number; total: number } | null => {
    const subset = votes.filter(filterFn);
    if (subset.length < 4) return null;
    const winCount = subset.filter(v => v.choice === winner).length;
    return { pct: Math.round((winCount / subset.length) * 100), total: subset.length };
  };

  // Cities — pick city with biggest deviation
  const cities = Array.from(new Set(votes.map(v => v.voter_city).filter(Boolean)));
  let bestCity: { name: string; deviation: number; chose: 'A' | 'B' } | null = null;
  for (const city of cities) {
    const stats = groupPct(v => v.voter_city === city);
    if (!stats) continue;
    const deviation = stats.pct - nationalWinnerPct;
    if (Math.abs(deviation) > threshold && (!bestCity || Math.abs(deviation) > Math.abs(bestCity.deviation))) {
      bestCity = { name: city, deviation, chose: deviation > 0 ? winner : (winner === 'A' ? 'B' : 'A') };
    }
  }
  if (bestCity) tags.push({ emoji: '🏙', label: `${bestCity.name} chose this`, choice: bestCity.chose });

  // Generation (Gen Z = 18-24, older = 25+)
  const genZ = groupPct(v => ['18-24', '13-17'].includes(v.voter_age_range));
  const older = groupPct(v => ['25-34', '35-44', '45-54', '55+'].includes(v.voter_age_range));
  if (genZ && older) {
    const dev = genZ.pct - older.pct;
    if (Math.abs(dev) > threshold) {
      tags.push({
        emoji: '⚡',
        label: dev > 0 ? 'Gen Z chose this' : '25+ chose this',
        choice: dev > 0 ? winner : (winner === 'A' ? 'B' : 'A'),
      });
    }
  }

  // Gender split
  const female = groupPct(v => v.voter_gender === 'Female');
  const male = groupPct(v => v.voter_gender === 'Male');
  if (female && male) {
    const dev = female.pct - male.pct;
    if (Math.abs(dev) > threshold) {
      tags.push({
        emoji: dev > 0 ? '👩' : '👨',
        label: dev > 0 ? 'Females chose this' : 'Males chose this',
        choice: dev > 0 ? winner : (winner === 'A' ? 'B' : 'A'),
      });
    }
  }

  return tags.slice(0, 3);
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
  const winnerLabel = poll.winner === 'A' ? poll.option_a : poll.option_b;
  const winnerImg = poll.winner === 'A' ? poll.image_a_url : poll.image_b_url;
  const loserLabel = poll.winner === 'A' ? poll.option_b : poll.option_a;
  const loserPct = poll.winner === 'A' ? poll.percentB : poll.percentA;

  const userPickedWinner = userChoice ? userChoice === poll.winner : null;
  const userVoted = !!userChoice;
  const userPct = userChoice ? (userChoice === 'A' ? poll.percentA : poll.percentB) : null;
  const userLabel = userChoice ? (userChoice === 'A' ? poll.option_a : poll.option_b) : null;

  // Independent thinker badge: if user voted for the loser, round their pct down to nearest 5
  const independentPct = !userPickedWinner && userPct != null ? Math.max(5, Math.round(userPct / 5) * 5) : null;

  return (
    <div className="h-full w-full flex flex-col relative bg-[#111111] overflow-hidden">
      {/* TOP BAR: question on dark background */}
      <div className="shrink-0 px-4 pt-3 pb-2 bg-[#111111] z-20 relative">
        <p className="font-display font-bold text-[18px] leading-tight text-white line-clamp-2 pr-12">
          {poll.question}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          {poll.category && (
            <span className="inline-block px-2 py-0.5 rounded-full bg-white/10 text-white/70 text-[10px] font-medium">
              {poll.category}
            </span>
          )}
          {poll.isClosed && (
            <span className="inline-block px-2 py-0.5 rounded-full bg-white/10 text-white/70 text-[10px] font-medium">
              🔒 Closed
            </span>
          )}
        </div>

        {/* Action buttons top-right */}
        <div className="absolute top-3 right-3 flex flex-col gap-2 items-end z-30">
          <button
            onClick={onShare}
            className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            aria-label="Share"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* MIDDLE: full-bleed winner image */}
      <div className="flex-1 relative overflow-hidden min-h-0 bg-black">
        <div
          className="absolute inset-0"
          style={{ filter: userVoted && !userPickedWinner ? 'brightness(0.7)' : 'none' }}
        >
          <PollOptionImage
            imageUrl={winnerImg}
            option={winnerLabel}
            question={poll.question}
            side={poll.winner}
            maxLogoSize="80%"
            loading="lazy"
            variant="browse"
          />
        </div>

        {/* Floating side-actions over image */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-20">
          {isSignedIn && (
            <button
              onClick={onSendToFriend}
              className="w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg"
              aria-label="Send in chat"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
          <FireReactionButton pollId={poll.id} />
        </div>

        {/* Independent thinker badge — top-left of image */}
        {independentPct != null && (
          <div className="absolute top-3 left-3 z-20">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500 text-white shadow-lg">
              <Sparkles className="h-3.5 w-3.5" />
              <span className="text-[11px] font-bold">Top {independentPct}% independent thinker</span>
            </div>
          </div>
        )}

        {/* Bottom 40% gradient overlay with result text */}
        <div
          className="absolute inset-x-0 bottom-0 flex flex-col justify-end p-4 pb-3"
          style={{
            height: '40%',
            background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0) 100%)',
          }}
        >
          {userVoted ? (
            <>
              {/* User's choice line */}
              <div className="flex items-center gap-2 mb-1">
                {userPickedWinner ? (
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 text-white" strokeWidth={3} />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shrink-0">
                    <X className="h-3 w-3 text-white" strokeWidth={3} />
                  </div>
                )}
                <span className="text-[18px] font-bold text-white leading-tight">
                  {userLabel} · {userPct}%
                </span>
              </div>

              {/* Winner label if user lost */}
              {!userPickedWinner && (
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-yellow-400 shrink-0" />
                  <span className="text-[16px] font-bold text-white/90 leading-tight">
                    {winnerLabel} · {poll.winnerPct}%
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-400 shrink-0" />
              <span className="text-[18px] font-bold text-white leading-tight">
                {winnerLabel} · {poll.winnerPct}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* DEMOGRAPHIC TAGS — dark bar */}
      <div className="shrink-0 bg-[#111111] px-4 py-2.5 space-y-1.5">
        {poll.demoTags.length > 0 ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {poll.demoTags.map((tag, i) => (
              <span
                key={i}
                className="text-[14px] leading-snug"
                style={{ color: 'rgba(255,255,255,0.8)' }}
              >
                {tag.emoji} {tag.label}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-[14px]" style={{ color: 'rgba(255,255,255,0.8)' }}>
            🇪🇬 Egypt chose this — {poll.winnerPct}%
          </span>
        )}

        {/* Loser pill — small subtle */}
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-white/40">
            {loserLabel} · {loserPct}%
          </span>
          <span className="text-[11px] text-white/30 ml-auto">
            {poll.totalVotes.toLocaleString()} votes
          </span>
        </div>

        {!userVoted && !poll.isClosed && (
          <button
            onClick={onVote}
            className="w-full text-center text-[12px] text-blue-400 hover:text-blue-300 transition-colors pt-1"
          >
            Vote on today's battles from Home →
          </button>
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
