import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { 
  Search, TrendingUp, ArrowUp, ArrowDown, Minus, Zap, Users, Timer, ChevronLeft, CheckCircle2,
  Flame, Utensils, Shirt, Laptop, Plane, Heart, ShoppingBag, Building2, Sparkles, Music, 
  Gamepad2, Dumbbell, BookOpen, Globe, Star, LayoutGrid, Trophy
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

// Category icon & color mapping
const CATEGORY_STYLE: Record<string, { icon: React.ReactNode; gradient: string; accent: string }> = {
  'Food': { icon: <Utensils className="h-5 w-5" />, gradient: 'from-orange-500 to-amber-400', accent: 'text-orange-500' },
  'Eat & Drink': { icon: <Utensils className="h-5 w-5" />, gradient: 'from-orange-500 to-amber-400', accent: 'text-orange-500' },
  'Fashion': { icon: <Shirt className="h-5 w-5" />, gradient: 'from-pink-500 to-rose-400', accent: 'text-pink-500' },
  'Style': { icon: <Shirt className="h-5 w-5" />, gradient: 'from-pink-500 to-rose-400', accent: 'text-pink-500' },
  'Tech': { icon: <Laptop className="h-5 w-5" />, gradient: 'from-blue-500 to-cyan-400', accent: 'text-blue-500' },
  'Travel': { icon: <Plane className="h-5 w-5" />, gradient: 'from-emerald-500 to-teal-400', accent: 'text-emerald-500' },
  'Lifestyle': { icon: <Heart className="h-5 w-5" />, gradient: 'from-red-500 to-pink-400', accent: 'text-red-500' },
  'Everyday Life': { icon: <Heart className="h-5 w-5" />, gradient: 'from-red-500 to-pink-400', accent: 'text-red-500' },
  'Consumer': { icon: <ShoppingBag className="h-5 w-5" />, gradient: 'from-violet-500 to-purple-400', accent: 'text-violet-500' },
  'Shopping': { icon: <ShoppingBag className="h-5 w-5" />, gradient: 'from-violet-500 to-purple-400', accent: 'text-violet-500' },
  'Brands': { icon: <Star className="h-5 w-5" />, gradient: 'from-amber-500 to-yellow-400', accent: 'text-amber-500' },
  'Platforms': { icon: <Globe className="h-5 w-5" />, gradient: 'from-indigo-500 to-blue-400', accent: 'text-indigo-500' },
  'Money': { icon: <Building2 className="h-5 w-5" />, gradient: 'from-green-600 to-emerald-400', accent: 'text-green-600' },
  'Spending & Money': { icon: <Building2 className="h-5 w-5" />, gradient: 'from-green-600 to-emerald-400', accent: 'text-green-600' },
  'Culture': { icon: <BookOpen className="h-5 w-5" />, gradient: 'from-amber-600 to-orange-400', accent: 'text-amber-600' },
  'Music': { icon: <Music className="h-5 w-5" />, gradient: 'from-fuchsia-500 to-pink-400', accent: 'text-fuchsia-500' },
  'Gaming': { icon: <Gamepad2 className="h-5 w-5" />, gradient: 'from-purple-600 to-indigo-400', accent: 'text-purple-600' },
  'Fitness': { icon: <Dumbbell className="h-5 w-5" />, gradient: 'from-lime-500 to-green-400', accent: 'text-lime-600' },
  'Entertainment': { icon: <Sparkles className="h-5 w-5" />, gradient: 'from-yellow-500 to-orange-400', accent: 'text-yellow-500' },
  'Egyptian Football': { icon: <Trophy className="h-5 w-5" />, gradient: 'from-emerald-600 to-green-400', accent: 'text-emerald-600' },
  'Sports': { icon: <Trophy className="h-5 w-5" />, gradient: 'from-emerald-600 to-green-400', accent: 'text-emerald-600' },
  'Apps & Tech': { icon: <Globe className="h-5 w-5" />, gradient: 'from-indigo-500 to-blue-400', accent: 'text-indigo-500' },
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

export default function Explore() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [modalPoll, setModalPoll] = useState<PollItem | null>(null);

  useEffect(() => {
    const catParam = searchParams.get('category');
    if (catParam) setSelectedCategory(catParam);
    const searchParam = searchParams.get('search');
    if (searchParam) setSearch(searchParam);
  }, [searchParams]);

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
    return polls
      .filter(p => p.option_a.toLowerCase().includes(q) || p.option_b.toLowerCase().includes(q) || p.question.toLowerCase().includes(q))
      .sort((a, b) => b.totalVotes - a.totalVotes);
  }, [search, polls]);

  const categoryPolls = useMemo(() => {
    if (!selectedCategory) return [];
    return polls
      .filter(p => (p.category || 'Uncategorized') === selectedCategory)
      .sort((a, b) => {
        if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
        return b.totalVotes - a.totalVotes;
      });
  }, [selectedCategory, polls]);

  // ── CATEGORY DETAIL VIEW ──
  if (selectedCategory) {
    const style = getCategoryStyle(selectedCategory);
    return (
      <AppLayout>
        <div className="min-h-screen flex flex-col pb-24">
          <div className="px-4 pt-4 pb-3">
            <button onClick={() => setSelectedCategory(null)} className="flex items-center gap-1 text-muted-foreground mb-3">
              <ChevronLeft className="h-4 w-4" />
              <span className="text-xs font-medium">Explore</span>
            </button>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${style.gradient} flex items-center justify-center text-white shadow-sm`}>
                {style.icon}
              </div>
              <div>
                <h1 className="text-xl font-display font-bold text-foreground">{selectedCategory}</h1>
                <p className="text-[11px] text-muted-foreground">{categoryPolls.length} active polls</p>
              </div>
            </div>
          </div>

          <div className="px-3 space-y-2.5">
            {categoryPolls.map((poll, i) => (
              <PollCard key={poll.id} poll={poll} index={i} votes24hMap={votes24hMap} onTap={setModalPoll} />
            ))}
            {categoryPolls.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-sm">No active polls in this category</p>
              </div>
            )}
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
          <p className="text-xs text-muted-foreground mt-0.5">Discover polls across every category</p>
        </div>

        {/* Search */}
        <div className="px-4 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search brands, options, polls…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-card border-border/60 rounded-xl text-sm h-10"
            />
          </div>
        </div>

        {/* Search results */}
        {search && search.length >= 2 && searchResults.length > 0 && (
          <section className="px-3 mb-4">
            <div className="flex items-center gap-1.5 mb-2 px-1">
              <Search className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wider">
                {searchResults.length} poll{searchResults.length !== 1 ? 's' : ''} matching "{search}"
              </span>
            </div>
            <div className="space-y-2.5">
              {searchResults.map((poll, i) => (
                <PollCard key={poll.id} poll={poll} index={i} votes24hMap={votes24hMap} onTap={setModalPoll} />
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

// ── Extracted Poll Card ──
function PollCard({ poll, index, votes24hMap, onTap }: { poll: PollItem; index: number; votes24hMap: Map<string, number>; onTap: (p: PollItem) => void }) {
  const recentVotes = votes24hMap.get(poll.id) || 0;
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
            <span className="text-lg font-extrabold text-option-a drop-shadow-lg">{poll.percentA}%</span>
          </div>
        </div>
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/15 z-10" />
        <div className="w-1/2 h-full relative overflow-hidden">
          <PollOptionImage imageUrl={poll.image_b_url} option={poll.option_b} question={poll.question} side="B" maxLogoSize="55%" loading="lazy" variant="browse" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-3 right-3 text-right">
            <p className="text-white text-base font-extrabold drop-shadow-lg">{poll.option_b}</p>
            <span className="text-lg font-extrabold text-option-b drop-shadow-lg">{poll.percentB}%</span>
          </div>
        </div>
      </div>
      <div className="absolute top-0 inset-x-0 px-3 pt-2.5 pb-6 bg-gradient-to-b from-black/70 to-transparent">
        <h3 className="text-white text-base font-bold drop-shadow-lg leading-snug">{poll.question}</h3>
      </div>
      <div className="absolute bottom-1.5 inset-x-2.5 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          {poll.isLive && <LiveIndicator variant="overlay" />}
          <span className="text-xs text-white/80 font-semibold flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {poll.totalVotes}
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
