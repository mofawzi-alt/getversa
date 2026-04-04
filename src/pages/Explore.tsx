import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Search, TrendingUp, ArrowUp, ArrowDown, Minus, Zap, Users, Timer, ChevronLeft, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';
import LiveIndicator from '@/components/poll/LiveIndicator';
import { Input } from '@/components/ui/input';
import { getPollDisplayImageSrc, getStablePollFallbackImage, handlePollImageError } from '@/lib/pollImages';

function getFallbackImage(seed: string, index: number): string {
  return getStablePollFallbackImage(seed, index);
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
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Fetch user's voted poll IDs
  const { data: votedPollIds } = useQuery({
    queryKey: ['user-voted-ids-explore', user?.id],
    queryFn: async () => {
      if (!user) return new Set<string>();
      const { data: votes } = await supabase.from('votes').select('poll_id').eq('user_id', user.id);
      return new Set(votes?.map(v => v.poll_id) || []);
    },
    staleTime: 1000 * 60 * 2,
  });

  // Fetch all active polls with results
  const { data: pollsData } = useQuery({
    queryKey: ['explore-polls'],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data: rawPolls } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, image_a_url, image_b_url, category, created_at, starts_at, ends_at')
        .eq('is_active', true)
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .order('created_at', { ascending: false })
        .limit(200);

      if (!rawPolls?.length) return { polls: [] as PollItem[], votes24hMap: new Map<string, number>() };

      const pollIds = rawPolls.map(p => p.id);
      const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: pollIds });
      const resultsMap = new Map(results?.map((r: any) => [r.poll_id, r]) || []);

      // Get votes in last 24h per poll for momentum
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentVotes } = await supabase
        .from('votes')
        .select('poll_id')
        .gte('created_at', since24h);
      
      const votes24hMap = new Map<string, number>();
      recentVotes?.forEach(v => {
        votes24hMap.set(v.poll_id, (votes24hMap.get(v.poll_id) || 0) + 1);
      });

      const nowDate = new Date();
      const polls: PollItem[] = rawPolls.map(p => {
        const r = resultsMap.get(p.id) as any;
        const total = (r?.total_votes as number) || 0;
        const votesA = (r?.votes_a as number) || 0;
        const pctA = total > 0 ? Math.round((votesA / total) * 100) : 50;
        const hasStarted = p.starts_at ? new Date(p.starts_at) <= nowDate : true;
        const isExpired = p.ends_at ? new Date(p.ends_at) < nowDate : false;
        return {
          ...p,
          totalVotes: total,
          percentA: pctA,
          percentB: 100 - pctA,
          isLive: hasStarted && !isExpired,
          contestedness: Math.abs(pctA - 50),
        };
      });

      return { polls, votes24hMap };
    },
    staleTime: 1000 * 30,
  });

  const polls = pollsData?.polls || [];
  const votes24hMap = pollsData?.votes24hMap || new Map();

  // Build categories
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

  const trendingCategories = categories.slice(0, 5);

  // Filter for search
  const filteredCategories = search
    ? categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : categories;

  // Category detail polls
  const categoryPolls = useMemo(() => {
    if (!selectedCategory) return [];
    return polls
      .filter(p => (p.category || 'Uncategorized') === selectedCategory)
      .sort((a, b) => {
        // Live first, then most voted, then most contested
        if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
        return b.totalVotes - a.totalVotes;
      });
  }, [selectedCategory, polls]);

  // ── CATEGORY DETAIL VIEW ──
  if (selectedCategory) {
    return (
      <AppLayout>
        <div className="min-h-screen flex flex-col pb-24">
          {/* Header */}
          <div className="px-4 pt-4 pb-3">
            <button onClick={() => setSelectedCategory(null)} className="flex items-center gap-1 text-muted-foreground mb-2">
              <ChevronLeft className="h-4 w-4" />
              <span className="text-xs font-medium">Back</span>
            </button>
            <h1 className="text-xl font-display font-bold text-foreground">{selectedCategory}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Browse & vote</p>
          </div>

          {/* Poll list */}
          <div className="px-3 space-y-2.5">
            {categoryPolls.map((poll, i) => {
              const imgA = getPollDisplayImageSrc({ imageUrl: poll.image_a_url, option: poll.option_a, question: poll.question, side: 'A' }) || getFallbackImage(poll.id, 0);
              const imgB = getPollDisplayImageSrc({ imageUrl: poll.image_b_url, option: poll.option_b, question: poll.question, side: 'B' }) || getFallbackImage(poll.id, 1);
              const recentVotes = votes24hMap.get(poll.id) || 0;

              return (
                <motion.div
                  key={poll.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(`/vote?pollId=${poll.id}`)}
                  className="relative rounded-xl overflow-hidden cursor-pointer group shadow-card"
                >
                  <div className="flex h-32 relative">
                    <div className="w-1/2 h-full relative overflow-hidden">
                      <img src={imgA} alt={poll.option_a} className="w-full h-full object-cover bg-muted transition-transform duration-300 group-hover:scale-105" onError={(e) => handlePollImageError(e, { option: poll.option_a, question: poll.question, side: 'A' })} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                      <div className="absolute bottom-2 left-2">
                        <p className="text-white text-[10px] font-bold drop-shadow-lg">{poll.option_a}</p>
                        <span className="text-xs font-bold text-option-a drop-shadow-lg">{poll.percentA}%</span>
                      </div>
                    </div>
                    <div className="absolute inset-y-0 left-1/2 w-px bg-white/15 z-10" />
                    <div className="w-1/2 h-full relative overflow-hidden">
                      <img src={imgB} alt={poll.option_b} className="w-full h-full object-cover bg-muted transition-transform duration-300 group-hover:scale-105" onError={(e) => handlePollImageError(e, { option: poll.option_b, question: poll.question, side: 'B' })} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                      <div className="absolute bottom-2 right-2 text-right">
                        <p className="text-white text-[10px] font-bold drop-shadow-lg">{poll.option_b}</p>
                        <span className="text-xs font-bold text-option-b drop-shadow-lg">{poll.percentB}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Question & meta */}
                  <div className="absolute top-0 inset-x-0 px-2.5 pt-2 pb-4 bg-gradient-to-b from-black/60 to-transparent">
                    <h3 className="text-white text-[11px] font-bold drop-shadow-lg leading-tight">{poll.question}</h3>
                  </div>

                  <div className="absolute bottom-1.5 inset-x-2 flex items-center justify-between z-10">
                    <div className="flex items-center gap-1.5">
                      {poll.isLive && <LiveIndicator variant="overlay" />}
                      <span className="text-[8px] text-white/60 flex items-center gap-0.5">
                        <Users className="h-2.5 w-2.5" /> {poll.totalVotes}
                      </span>
                      {recentVotes > 0 && (
                        <span className="text-[8px] text-white/60 flex items-center gap-0.5">
                          <Zap className="h-2.5 w-2.5" /> {recentVotes}/hr
                        </span>
                      )}
                    </div>
                    {poll.ends_at && (
                      <span className="text-[8px] text-white/50 flex items-center gap-0.5">
                        <Timer className="h-2.5 w-2.5" /> {getTimeLeft(poll.ends_at)}
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {categoryPolls.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-sm">No active polls in this category</p>
              </div>
            )}
          </div>
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
          <p className="text-xs text-muted-foreground mt-0.5">Browse polls by category</p>
        </div>

        {/* Search */}
        <div className="px-4 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search polls…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-card border-border/60 rounded-xl text-sm h-10"
            />
          </div>
        </div>

        {/* Trending Categories (horizontal) */}
        {!search && trendingCategories.length > 0 && (
          <section className="mb-4">
            <div className="px-4 flex items-center gap-1.5 mb-2">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wider">Trending Categories</span>
            </div>
            <div className="flex gap-2.5 overflow-x-auto px-4 scrollbar-hide pb-1">
              {trendingCategories.map((cat, i) => (
                <motion.div
                  key={cat.name}
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedCategory(cat.name)}
                  className="shrink-0 w-36 rounded-xl bg-card border border-border/60 p-3 cursor-pointer hover:border-primary/40 transition-colors"
                >
                  <p className="text-xs font-display font-bold text-foreground truncate">{cat.name}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {cat.momentum === 'rising' && <ArrowUp className="h-3 w-3 text-success" />}
                    {cat.momentum === 'slowing' && <ArrowDown className="h-3 w-3 text-destructive" />}
                    {cat.momentum === 'steady' && <Minus className="h-3 w-3 text-muted-foreground" />}
                    <span className={`text-[10px] font-bold ${
                      cat.momentum === 'rising' ? 'text-success' : cat.momentum === 'slowing' ? 'text-destructive' : 'text-muted-foreground'
                    }`}>
                      {cat.growthPercent > 0 ? `+${cat.growthPercent}%` : `${cat.growthPercent}%`} today
                    </span>
                  </div>
                  {cat.momentum === 'rising' && (
                    <div className="flex items-center gap-0.5 mt-1">
                      <ArrowUp className="h-2.5 w-2.5 text-success" />
                      <span className="text-[9px] font-bold text-success">Trending</span>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* All Categories Grid */}
        <section className="px-4">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wider">All Categories</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {filteredCategories.map((cat, i) => (
              <motion.div
                key={cat.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setSelectedCategory(cat.name)}
                className="rounded-xl bg-card border border-border/60 p-3 cursor-pointer hover:border-primary/30 transition-colors relative"
              >
                <div className="flex items-start justify-between">
                  <p className="text-xs font-display font-bold text-foreground truncate flex-1">{cat.name}</p>
                  {cat.hasLive && (
                    <span className="text-[7px] font-bold px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive uppercase tracking-wider shrink-0 ml-1">
                      Live
                    </span>
                  )}
                </div>
                {/* Progress bar: voted / total */}
                {user && (
                  <div className="mt-1.5">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[9px] text-muted-foreground">
                        {cat.votedPolls}/{cat.activePolls} voted
                      </span>
                      {cat.votedPolls >= cat.activePolls && cat.activePolls > 0 && (
                        <span className="flex items-center gap-0.5 text-[8px] font-bold text-success">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Complete!
                        </span>
                      )}
                    </div>
                    <Progress value={cat.activePolls > 0 ? (cat.votedPolls / cat.activePolls) * 100 : 0} className="h-1.5" />
                  </div>
                )}
                {!user && (
                  <p className="text-[10px] text-muted-foreground mt-1">{cat.activePolls} active poll{cat.activePolls !== 1 ? 's' : ''}</p>
                )}
                {cat.momentum === 'rising' && (
                  <div className="flex items-center gap-0.5 mt-1">
                    <ArrowUp className="h-2.5 w-2.5 text-success" />
                    <span className="text-[9px] font-bold text-success">Trending</span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {filteredCategories.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-sm">No categories found</p>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
