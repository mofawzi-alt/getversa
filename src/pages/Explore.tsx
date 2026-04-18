import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { 
  Search, TrendingUp, ArrowUp, ArrowDown, Minus, Zap, Users, Timer, ChevronLeft, CheckCircle2,
  Flame, Star, Briefcase, DollarSign, Palette, Sparkles, Trophy, Heart, Radio, LayoutGrid,
  Crown, Scale, ThumbsUp, UserCheck, Brain, UtensilsCrossed, UserRound, HeartHandshake, Smartphone
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';
import LiveIndicator from '@/components/poll/LiveIndicator';
import { Input } from '@/components/ui/input';
import { getPollDisplayImageSrc, getStablePollFallbackImage, handlePollImageError } from '@/lib/pollImages';
import PollOptionImage from '@/components/poll/PollOptionImage';
import HomeResultsModal from '@/components/home/HomeResultsModal';
import { useCelebrityPresence } from '@/hooks/useCelebrityVotes';
import VerifiedBadge from '@/components/VerifiedBadge';

function getFallbackImage(seed: string, index: number): string {
  return getStablePollFallbackImage(seed, index);
}

// Category icon & color mapping (10 official Versa categories)
import {
  ShoppingBasket, Banknote, Popcorn, ShoppingBag, Wifi, Utensils, Car,
} from 'lucide-react';

const CATEGORY_STYLE: Record<string, { icon: React.ReactNode; gradient: string; accent: string }> = {
  'FMCG & Food':            { icon: <ShoppingBasket className="h-5 w-5" />, gradient: 'from-green-500 to-emerald-400',  accent: 'text-green-600' },
  'Beauty & Personal Care': { icon: <Sparkles className="h-5 w-5" />,       gradient: 'from-pink-500 to-rose-400',      accent: 'text-pink-500' },
  'Financial Services':     { icon: <Banknote className="h-5 w-5" />,       gradient: 'from-blue-600 to-sky-400',       accent: 'text-blue-600' },
  'Media & Entertainment':  { icon: <Popcorn className="h-5 w-5" />,        gradient: 'from-amber-500 to-yellow-400',   accent: 'text-amber-500' },
  'Retail & E-commerce':    { icon: <ShoppingBag className="h-5 w-5" />,    gradient: 'from-purple-500 to-fuchsia-400', accent: 'text-purple-500' },
  'Telco & Tech':           { icon: <Wifi className="h-5 w-5" />,           gradient: 'from-teal-500 to-cyan-400',      accent: 'text-teal-500' },
  'Food Delivery & Dining': { icon: <Utensils className="h-5 w-5" />,       gradient: 'from-orange-500 to-amber-400',   accent: 'text-orange-500' },
  'Automotive & Mobility':  { icon: <Car className="h-5 w-5" />,            gradient: 'from-slate-600 to-slate-400',    accent: 'text-slate-600' },
  'Lifestyle & Society':    { icon: <Heart className="h-5 w-5" />,          gradient: 'from-rose-500 to-pink-400',      accent: 'text-rose-500' },
  'The Pulse':              { icon: <Flame className="h-5 w-5" />,          gradient: 'from-red-500 to-orange-400',     accent: 'text-red-500' },
};

function getCategoryStyle(name: string) {
  return CATEGORY_STYLE[name] || { icon: <LayoutGrid className="h-5 w-5" />, gradient: 'from-slate-500 to-slate-400', accent: 'text-muted-foreground' };
}

type CategoryData = {
  name: string;
  activePolls: number;
  votedPolls: number;
  hasLive: boolean;
  votes24h: number;
  growthPercent: number;
  momentum: 'rising' | 'slowing' | 'steady';
};

type PollItem = {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  image_a_url: string | null;
  image_b_url: string | null;
  category: string | null;
  created_at: string;
  starts_at: string | null;
  ends_at: string | null;
  totalVotes: number;
  percentA: number;
  percentB: number;
  isLive: boolean;
  contestedness: number;
};

function getTimeLeft(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) return `${Math.floor(hours / 24)}d left`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function getVerdictBadge(poll: PollItem): { label: string; icon: React.ReactNode; className: string } | null {
  if (poll.totalVotes < 3) return null;
  const winnerPct = Math.max(poll.percentA, poll.percentB);
  if (winnerPct >= 65) return { label: 'Crowd Favorite', icon: <Crown className="h-3 w-3" />, className: 'bg-amber-500/20 text-amber-600' };
  if (winnerPct <= 55 && poll.totalVotes >= 10) return { label: 'Highly Debated', icon: <Scale className="h-3 w-3" />, className: 'bg-orange-500/20 text-orange-600' };
  return null;
}

function getWinnerInfo(poll: PollItem): { option: string; pct: number; side: 'A' | 'B' } {
  if (poll.percentA >= poll.percentB) return { option: poll.option_a, pct: poll.percentA, side: 'A' };
  return { option: poll.option_b, pct: poll.percentB, side: 'B' };
}

function formatVoteCount(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toString();
}

export default function Explore() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [modalPoll, setModalPoll] = useState<PollItem | null>(null);
  const [peopleLikeYou, setPeopleLikeYou] = useState(false);
  const [categorySort, setCategorySort] = useState<'most_voted' | 'most_recent' | 'most_controversial'>('most_voted');
  const [unvotedOnly, setUnvotedOnly] = useState(true);

  useEffect(() => {
    const catParam = searchParams.get('category');
    if (catParam) setSelectedCategory(catParam);
    const searchParam = searchParams.get('search');
    if (searchParam) setSearch(searchParam);
  }, [searchParams]);

  // Fetch user profile for "People Like You" filtering
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile-explore', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from('users').select('age_range, gender').eq('id', user.id).single();
      return data;
    },
    staleTime: 1000 * 60 * 10,
    enabled: !!user,
  });

  const { data: votedPollIds } = useQuery({
    queryKey: ['user-voted-ids-explore', user?.id],
    queryFn: async () => {
      if (!user) return new Set<string>();
      const { data: votes } = await supabase.from('votes').select('poll_id').eq('user_id', user.id);
      return new Set(votes?.map(v => v.poll_id) || []);
    },
    staleTime: 1000 * 60 * 2,
  });

  const { data: pollsData } = useQuery({
    queryKey: ['explore-polls', user?.id],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data: rawPolls, error: rawPollsError } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, image_a_url, image_b_url, category, created_at, starts_at, ends_at, weight_score')
        .eq('is_active', true)
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .order('weight_score', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(300);

      if (rawPollsError) throw rawPollsError;
      if (!rawPolls?.length) return { polls: [] as PollItem[], votes24hMap: new Map<string, number>() };

      const pollIds = rawPolls.map(p => p.id);
      const { data: results, error: resultsError } = await supabase.rpc('get_poll_results', { poll_ids: pollIds });
      if (resultsError) throw resultsError;
      const resultsMap = new Map(results?.map((r: any) => [r.poll_id, r]) || []);

      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentVotes, error: recentVotesError } = await supabase
        .from('votes').select('poll_id').gte('created_at', since24h).limit(1000);
      if (recentVotesError) throw recentVotesError;

      const votes24hMap = new Map<string, number>();
      recentVotes?.forEach(v => { votes24hMap.set(v.poll_id, (votes24hMap.get(v.poll_id) || 0) + 1); });

      const nowDate = new Date();
      const polls: PollItem[] = rawPolls.map(p => {
        const r = resultsMap.get(p.id) as any;
        const total = (r?.total_votes as number) || 0;
        const votesA = (r?.votes_a as number) || 0;
        const pctA = total > 0 ? Math.round((votesA / total) * 100) : 50;
        const hasStarted = p.starts_at ? new Date(p.starts_at) <= nowDate : true;
        const isExpired = p.ends_at ? new Date(p.ends_at) < nowDate : false;
        return { ...p, totalVotes: total, percentA: pctA, percentB: 100 - pctA, isLive: hasStarted && !isExpired, contestedness: Math.abs(pctA - 50) };
      });

      return { polls, votes24hMap };
    },
    staleTime: 1000 * 30,
  });

  // Demographic results for "People Like You"
  const categoryPollsBase = useMemo(() => {
    if (!selectedCategory) return [];
    const allPolls = pollsData?.polls || [];
    const filtered = allPolls.filter(p => (p.category || 'Uncategorized') === selectedCategory);

    const sorted = [...filtered].sort((a, b) => {
      if (categorySort === 'most_recent') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (categorySort === 'most_controversial') {
        // Controversy = closeness to 50/50, gated by minimum votes
        const aGap = a.totalVotes >= 5 ? Math.abs(a.percentA - 50) : 100;
        const bGap = b.totalVotes >= 5 ? Math.abs(b.percentA - 50) : 100;
        if (aGap !== bGap) return aGap - bGap;
        return b.totalVotes - a.totalVotes;
      }
      // Default: most_voted
      return b.totalVotes - a.totalVotes;
    });
    return sorted;
  }, [selectedCategory, pollsData?.polls, categorySort]);

  const categoryPollIds = useMemo(() => categoryPollsBase.map(p => p.id), [categoryPollsBase]);

  const { data: demoResults } = useQuery({
    queryKey: ['demo-results', categoryPollIds, userProfile?.age_range, userProfile?.gender],
    queryFn: async () => {
      if (!userProfile?.age_range || !userProfile?.gender || categoryPollIds.length === 0) return new Map();
      const results = new Map<string, { demo_percent_a: number; demo_percent_b: number; demo_total: number }>();
      // Batch fetch demographic results for category polls
      const batchSize = 10;
      for (let i = 0; i < categoryPollIds.length; i += batchSize) {
        const batch = categoryPollIds.slice(i, i + batchSize);
        const promises = batch.map(pid =>
          supabase.rpc('get_demographic_poll_result', {
            p_poll_id: pid,
            p_age_range: userProfile.age_range!,
          }).then(({ data }) => ({ pid, data: data?.[0] }))
        );
        const batchResults = await Promise.all(promises);
        batchResults.forEach(({ pid, data }) => {
          if (data && data.demo_total > 0) {
            results.set(pid, { demo_percent_a: data.demo_percent_a, demo_percent_b: data.demo_percent_b, demo_total: data.demo_total });
          }
        });
      }
      return results;
    },
    staleTime: 1000 * 60 * 5,
    enabled: peopleLikeYou && !!userProfile?.age_range && categoryPollIds.length > 0,
  });

  const polls = pollsData?.polls || [];
  const votes24hMap = pollsData?.votes24hMap || new Map();

  // Celebrity presence for all polls
  const allPollIds = useMemo(() => polls.map(p => p.id), [polls]);
  const { data: celebrityPresence = {} } = useCelebrityPresence(allPollIds);

  const categories: CategoryData[] = useMemo(() => {
    const catMap = new Map<string, { name: string; activePolls: number; votedPolls: number; hasLive: boolean; votes24h: number; totalVotes: number }>();
    polls.forEach(p => {
      const cat = p.category || 'Uncategorized';
      const existing = catMap.get(cat) || { name: cat, activePolls: 0, votedPolls: 0, hasLive: false, votes24h: 0, totalVotes: 0 };
      existing.activePolls++;
      if (votedPollIds?.has(p.id)) existing.votedPolls++;
      if (p.isLive) existing.hasLive = true;
      existing.votes24h += (votes24hMap.get(p.id) || 0);
      existing.totalVotes += p.totalVotes;
      catMap.set(cat, existing);
    });

    return [...catMap.values()].map(c => {
      const growthPercent = c.totalVotes > 0 ? Math.round((c.votes24h / Math.max(c.totalVotes, 1)) * 100) : 0;
      const momentum: 'rising' | 'slowing' | 'steady' = growthPercent > 15 ? 'rising' : growthPercent < 5 ? 'slowing' : 'steady';
      return { ...c, growthPercent, momentum };
    }).sort((a, b) => b.votes24h - a.votes24h);
  }, [polls, votes24hMap, votedPollIds]);

  const trendingCategories = categories.filter(c => c.momentum === 'rising').slice(0, 4);

  const filteredCategories = search
    ? categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : categories;

  const searchResults = useMemo(() => {
    if (!search || search.length < 2) return [];
    const q = search.toLowerCase();
    const now = Date.now();
    const h24 = 24 * 60 * 60 * 1000;
    return polls
      .filter(p => p.option_a.toLowerCase().includes(q) || p.option_b.toLowerCase().includes(q) || p.question.toLowerCase().includes(q))
      .sort((a, b) => {
        const aNew = (now - new Date(a.created_at).getTime()) < h24;
        const bNew = (now - new Date(b.created_at).getTime()) < h24;
        if (aNew !== bNew) return aNew ? -1 : 1;
        return b.totalVotes - a.totalVotes;
      });
  }, [search, polls]);

  // Decision Hub data for selected category
  const decisionHub = useMemo(() => {
    if (!selectedCategory || categoryPollsBase.length === 0) return null;
    const withVotes = categoryPollsBase.filter(p => p.totalVotes >= 5);
    const clearWinners = withVotes
      .filter(p => Math.max(p.percentA, p.percentB) >= 65)
      .sort((a, b) => b.totalVotes - a.totalVotes)
      .slice(0, 5);
    const mostDebated = withVotes
      .filter(p => Math.max(p.percentA, p.percentB) <= 55)
      .sort((a, b) => b.totalVotes - a.totalVotes)
      .slice(0, 5);
    const trendingNow = [...categoryPollsBase]
      .sort((a, b) => (votes24hMap.get(b.id) || 0) - (votes24hMap.get(a.id) || 0))
      .filter(p => (votes24hMap.get(p.id) || 0) > 0)
      .slice(0, 5);
    
    if (clearWinners.length === 0 && mostDebated.length === 0 && trendingNow.length === 0) return null;
    return { clearWinners, mostDebated, trendingNow };
  }, [selectedCategory, categoryPollsBase, votes24hMap]);

  // ── CATEGORY DETAIL VIEW ──
  if (selectedCategory) {
    const style = getCategoryStyle(selectedCategory);
    return (
      <AppLayout>
        <div className="min-h-screen flex flex-col pb-24">
          <div className="px-4 pt-4 pb-3">
            <button onClick={() => { setSelectedCategory(null); setPeopleLikeYou(false); }} className="flex items-center gap-1 text-muted-foreground mb-3">
              <ChevronLeft className="h-4 w-4" />
              <span className="text-xs font-medium">Explore</span>
            </button>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${style.gradient} flex items-center justify-center text-white shadow-sm`}>
                {style.icon}
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-display font-bold text-foreground">{selectedCategory}</h1>
                <p className="text-[11px] text-muted-foreground">{categoryPollsBase.length} active polls</p>
              </div>
            </div>

            {/* Unvoted / All filter */}
            <div className="mt-3 inline-flex items-center gap-1 p-1 rounded-full bg-muted">
              <button
                onClick={() => setUnvotedOnly(true)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  unvotedOnly ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                Unvoted
              </button>
              <button
                onClick={() => setUnvotedOnly(false)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  !unvotedOnly ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                All
              </button>
            </div>
          </div>

          {/* All Polls in Category */}
          <div className="px-3 space-y-2.5">
            {(() => {
              const visiblePolls = unvotedOnly
                ? categoryPollsBase.filter(p => !votedPollIds?.has(p.id))
                : categoryPollsBase;
              if (visiblePolls.length === 0) {
                return (
                  <div className="text-center py-12 px-6">
                    <div className={`w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br ${style.gradient} flex items-center justify-center text-white shadow-sm`}>
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-display font-bold text-foreground mb-1">
                      {unvotedOnly && categoryPollsBase.length > 0 ? "You're all caught up" : 'No active polls'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {unvotedOnly && categoryPollsBase.length > 0
                        ? `You've voted on every poll in ${selectedCategory}`
                        : 'Check back soon for new polls in this category'}
                    </p>
                    {unvotedOnly && categoryPollsBase.length > 0 && (
                      <button
                        onClick={() => setUnvotedOnly(false)}
                        className="mt-4 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-bold"
                      >
                        See all polls
                      </button>
                    )}
                  </div>
                );
              }
              return visiblePolls.map((poll, i) => (
                <PollCard
                  key={poll.id}
                  poll={poll}
                  index={i}
                  votes24hMap={votes24hMap}
                  onTap={setModalPoll}
                  celebrityNames={celebrityPresence[poll.id]}
                  peopleLikeYou={false}
                  demoResult={undefined}
                  userProfile={userProfile}
                />
              ));
            })()}
          </div>

          <HomeResultsModal
            open={!!modalPoll}
            onOpenChange={(open) => !open && setModalPoll(null)}
            poll={modalPoll}
            imageA={modalPoll ? (getPollDisplayImageSrc({ imageUrl: modalPoll.image_a_url, option: modalPoll.option_a, question: modalPoll.question, side: 'A' }) || getFallbackImage(modalPoll.id, 0)) : ''}
            imageB={modalPoll ? (getPollDisplayImageSrc({ imageUrl: modalPoll.image_b_url, option: modalPoll.option_b, question: modalPoll.question, side: 'B' }) || getFallbackImage(modalPoll.id, 1)) : ''}
          />
        </div>
      </AppLayout>
    );
  }

  // ── EXPLORE MAIN VIEW ──
  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col pb-24">
        {/* Header */}
        <div className="px-4 pt-4 pb-2">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-muted-foreground mb-2">
            <ChevronLeft className="h-4 w-4" />
            <span className="text-xs font-medium">Back</span>
          </button>
          <h1 className="text-xl font-display font-bold text-foreground">Explore</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Discover polls & see what people choose</p>
        </div>

        {/* Search */}
        <div className="px-4 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search brands, products, decisions…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-card border-border/60 rounded-xl text-sm h-10"
            />
          </div>
        </div>

        {/* Search results with verdict badges */}
        {search && search.length >= 2 && searchResults.length > 0 && (
          <section className="px-3 mb-4">
            <div className="flex items-center gap-1.5 mb-2 px-1">
              <Search className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wider">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{search}"
              </span>
            </div>
            <div className="space-y-2.5">
              {searchResults.map((poll, i) => (
                <PollCard key={poll.id} poll={poll} index={i} votes24hMap={votes24hMap} onTap={setModalPoll} celebrityNames={celebrityPresence[poll.id]} showVerdict />
              ))}
            </div>
          </section>
        )}

        {search && search.length >= 2 && searchResults.length === 0 && (
          <div className="text-center py-12 px-4">
            <p className="text-muted-foreground text-sm">No polls found for "{search}"</p>
          </div>
        )}

        {/* Trending Now — hot categories */}
        {!search && trendingCategories.length > 0 && (
          <section className="mb-5">
            <div className="px-4 flex items-center gap-1.5 mb-2.5">
              <Flame className="h-4 w-4 text-orange-500" />
              <span className="text-xs font-display font-bold text-foreground">Trending Now</span>
            </div>
            <div className="flex gap-2.5 overflow-x-auto px-4 scrollbar-hide pb-1">
              {trendingCategories.map((cat, i) => {
                const style = getCategoryStyle(cat.name);
                return (
                  <motion.div
                    key={cat.name}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.06 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedCategory(cat.name)}
                    className="shrink-0 w-32 rounded-2xl bg-card border border-border/50 overflow-hidden cursor-pointer hover:shadow-md transition-all group"
                  >
                    <div className={`h-16 bg-gradient-to-br ${style.gradient} flex items-center justify-center relative`}>
                      <div className="text-white/90">{style.icon}</div>
                      <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-white/20 backdrop-blur-sm">
                        <ArrowUp className="h-3 w-3 text-white" />
                        <span className="text-xs font-bold text-white">Hot</span>
                      </div>
                    </div>
                    <div className="p-2.5">
                      <p className="text-base font-bold text-foreground truncate">{cat.name}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {cat.votes24h > 0 ? `${cat.votes24h} votes today` : `${cat.activePolls} polls`}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* All Categories — icon grid */}
        {!search && (
          <section className="px-4">
            <div className="flex items-center gap-1.5 mb-3">
              <LayoutGrid className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-display font-bold text-foreground">All Categories</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {filteredCategories.map((cat, i) => {
                const style = getCategoryStyle(cat.name);
                return (
                  <motion.div
                    key={cat.name}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setSelectedCategory(cat.name)}
                    className="rounded-2xl bg-card border border-border/50 p-3.5 cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${style.gradient} flex items-center justify-center text-white shadow-sm`}>
                        {style.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-bold text-foreground truncate">{cat.name}</p>
                        <p className="text-sm text-muted-foreground">{cat.activePolls} polls</p>
                      </div>
                    </div>
                    
                    {/* Status badges */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {cat.hasLive && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-xs font-bold">
                         <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" /> Live
                        </span>
                      )}
                      {cat.momentum === 'rising' && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 text-xs font-bold">
                          <TrendingUp className="h-3.5 w-3.5" /> Trending
                        </span>
                      )}
                      {cat.votes24h > 0 && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                          <Zap className="h-3.5 w-3.5" /> {cat.votes24h} today
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {filteredCategories.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-sm">No categories found</p>
              </div>
            )}
          </section>
        )}

        <HomeResultsModal
          open={!!modalPoll}
          onOpenChange={(open) => !open && setModalPoll(null)}
          poll={modalPoll}
          imageA={modalPoll ? (getPollDisplayImageSrc({ imageUrl: modalPoll.image_a_url, option: modalPoll.option_a, question: modalPoll.question, side: 'A' }) || getFallbackImage(modalPoll.id, 0)) : ''}
          imageB={modalPoll ? (getPollDisplayImageSrc({ imageUrl: modalPoll.image_b_url, option: modalPoll.option_b, question: modalPoll.question, side: 'B' }) || getFallbackImage(modalPoll.id, 1)) : ''}
        />
      </div>
    </AppLayout>
  );
}

// ── Extracted Poll Card with Verdict Badges ──
function PollCard({
  poll, index, votes24hMap, onTap, celebrityNames, showVerdict = false,
  peopleLikeYou = false, demoResult, userProfile,
}: {
  poll: PollItem;
  index: number;
  votes24hMap: Map<string, number>;
  onTap: (p: PollItem) => void;
  celebrityNames?: { username: string }[];
  showVerdict?: boolean;
  peopleLikeYou?: boolean;
  demoResult?: { demo_percent_a: number; demo_percent_b: number; demo_total: number };
  userProfile?: { age_range: string | null; gender: string | null } | null;
}) {
  const recentVotes = votes24hMap.get(poll.id) || 0;
  const verdict = getVerdictBadge(poll);
  const pctA = peopleLikeYou && demoResult ? demoResult.demo_percent_a : poll.percentA;
  const pctB = peopleLikeYou && demoResult ? demoResult.demo_percent_b : poll.percentB;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onTap(poll)}
      className="relative rounded-xl overflow-hidden cursor-pointer group shadow-card"
    >
      <div className="flex relative" style={{ aspectRatio: '4/5' }}>
        <div className="w-1/2 h-full relative overflow-hidden">
          <PollOptionImage imageUrl={poll.image_a_url} option={poll.option_a} question={poll.question} side="A" maxLogoSize="55%" loading="lazy" variant="browse" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-3 left-3">
            <p className="text-white text-base font-extrabold drop-shadow-lg">{poll.option_a}</p>
            <span className="text-lg font-extrabold text-option-a drop-shadow-lg">{pctA}%</span>
          </div>
        </div>
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/15 z-10" />
        <div className="w-1/2 h-full relative overflow-hidden">
          <PollOptionImage imageUrl={poll.image_b_url} option={poll.option_b} question={poll.question} side="B" maxLogoSize="55%" loading="lazy" variant="browse" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-3 right-3 text-right">
            <p className="text-white text-base font-extrabold drop-shadow-lg">{poll.option_b}</p>
            <span className="text-lg font-extrabold text-option-b drop-shadow-lg">{pctB}%</span>
          </div>
        </div>
      </div>
      <div className="absolute top-0 inset-x-0 px-3 pt-2.5 pb-6 bg-gradient-to-b from-black/70 to-transparent">
        <h3 className="text-white text-base font-bold drop-shadow-lg leading-snug">{poll.question}</h3>
        {/* Verdict + People Like You badges */}
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {(showVerdict || peopleLikeYou) && verdict && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${verdict.className}`}>
              {verdict.icon} {verdict.label}
            </span>
          )}
          {peopleLikeYou && demoResult && demoResult.demo_total > 0 && userProfile && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm text-[10px] font-semibold text-white">
              <UserCheck className="h-3 w-3" />
              {demoResult.demo_total} {userProfile.gender} {userProfile.age_range}
            </span>
          )}
          {/* Celebrity indicator */}
          {celebrityNames && celebrityNames.length > 0 && (
            <>
              {celebrityNames.slice(0, 2).map((celeb, ci) => (
                <span key={ci} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-sm">
                  <VerifiedBadge size="sm" />
                  <span className="text-[10px] font-semibold text-white/90">{celeb.username} voted</span>
                </span>
              ))}
            </>
          )}
        </div>
      </div>
      <div className="absolute bottom-1.5 inset-x-2.5 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          {poll.isLive && <LiveIndicator variant="overlay" />}
          <span className="text-xs text-white/80 font-semibold flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {formatVoteCount(poll.totalVotes)}
          </span>
          {recentVotes > 0 && (
            <span className="text-xs text-white/80 font-semibold flex items-center gap-1">
              <Zap className="h-3.5 w-3.5" /> {recentVotes}/hr
            </span>
          )}
        </div>
        {poll.ends_at && (
          <span className="text-xs text-white/70 font-medium flex items-center gap-1">
            <Timer className="h-3.5 w-3.5" /> {getTimeLeft(poll.ends_at)}
          </span>
        )}
      </div>
    </motion.div>
  );
}
