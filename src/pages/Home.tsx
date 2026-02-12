import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowRight, Flame, Sparkles, TrendingUp, Clock, Users, Zap } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'lifestyle', label: 'Lifestyle' },
  { key: 'food', label: 'Food' },
  { key: 'culture', label: 'Culture' },
  { key: 'fashion', label: 'Fashion' },
  { key: 'tech', label: 'Tech' },
  { key: 'travel', label: 'Travel' },
];

type PollCard = {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  category: string | null;
  totalVotes: number;
  percentA: number;
  percentB: number;
  tag: 'trending' | 'fresh' | 'popular';
};

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState('all');

  // Unseen poll count
  const { data: unseenCount, isLoading: loadingUnseen } = useQuery({
    queryKey: ['unseen-poll-count', user?.id],
    queryFn: async () => {
      const { data: polls } = await supabase
        .from('polls')
        .select('id')
        .eq('is_active', true);

      if (!polls || !user) return polls?.length || 0;

      const { data: votes } = await supabase
        .from('votes')
        .select('poll_id')
        .eq('user_id', user.id);

      const votedIds = new Set(votes?.map(v => v.poll_id) || []);
      return polls.filter(p => !votedIds.has(p.id)).length;
    },
    staleTime: 1000 * 60 * 2,
  });

  // Mixed poll feed: trending + fresh + popular
  const { data: mixedPolls, isLoading: loadingPolls } = useQuery({
    queryKey: ['mixed-polls-home'],
    queryFn: async () => {
      const { data: polls } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, category, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!polls || polls.length === 0) return [];

      const pollIds = polls.map(p => p.id);
      const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: pollIds });

      const resultsMap = new Map(
        results?.map((r: any) => [r.poll_id, r]) || []
      );

      const enriched = polls.map(p => {
        const r = resultsMap.get(p.id);
        return {
          ...p,
          totalVotes: (r?.total_votes as number) || 0,
          percentA: (r?.percent_a as number) || 0,
          percentB: (r?.percent_b as number) || 0,
        };
      });

      // Trending: most votes
      const trending = [...enriched]
        .filter(p => p.totalVotes > 0)
        .sort((a, b) => b.totalVotes - a.totalVotes)
        .slice(0, 2)
        .map(p => ({ ...p, tag: 'trending' as const }));

      const trendingIds = new Set(trending.map(p => p.id));

      // Fresh: newest with some votes
      const fresh = enriched
        .filter(p => !trendingIds.has(p.id))
        .slice(0, 2)
        .map(p => ({ ...p, tag: 'fresh' as const }));

      const usedIds = new Set([...trendingIds, ...fresh.map(p => p.id)]);

      // Popular: high votes not already used
      const popular = [...enriched]
        .filter(p => p.totalVotes > 0 && !usedIds.has(p.id))
        .sort((a, b) => b.totalVotes - a.totalVotes)
        .slice(0, 1)
        .map(p => ({ ...p, tag: 'popular' as const }));

      // Interleave: trending, fresh, popular
      const mixed: PollCard[] = [];
      const sources = [trending, fresh, popular];
      const maxLen = Math.max(...sources.map(s => s.length));
      for (let i = 0; i < maxLen; i++) {
        for (const src of sources) {
          if (src[i]) mixed.push(src[i]);
        }
      }
      return mixed.slice(0, 5);
    },
    staleTime: 1000 * 60 * 5,
  });

  // User stats
  const { data: userStats } = useQuery({
    queryKey: ['user-home-stats', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('users')
        .select('points, current_streak, total_days_active')
        .eq('id', user.id)
        .single();
      return data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const isLoading = loadingUnseen || loadingPolls;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const hasUnseen = (unseenCount || 0) > 0;

  const filtered = activeCategory === 'all'
    ? mixedPolls
    : mixedPolls?.filter(p => p.category?.toLowerCase() === activeCategory);

  const tagConfig = {
    trending: { icon: Flame, label: 'Trending', color: 'text-destructive' },
    fresh: { icon: Sparkles, label: 'New', color: 'text-accent' },
    popular: { icon: TrendingUp, label: 'Popular', color: 'text-primary' },
  };

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col p-4 pb-24 gap-5">
        {/* Header */}
        <header>
          <h1 className="text-2xl font-display font-bold text-gradient">VERSA</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Discover what the world thinks</p>
        </header>

        {/* New Perspectives CTA */}
        {hasUnseen && (
          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => navigate('/vote')}
            className="relative w-full rounded-2xl bg-gradient-primary p-5 text-left overflow-hidden group active:scale-[0.98] transition-transform"
          >
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-accent/15 blur-2xl" />
            <div className="relative flex items-center justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary-foreground" />
                  <span className="text-sm font-bold text-primary-foreground">
                    {unseenCount} new {unseenCount === 1 ? 'perspective' : 'perspectives'} waiting
                  </span>
                </div>
                <p className="text-xs text-primary-foreground/70">
                  Tap to share your voice
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary-foreground/15 flex items-center justify-center">
                <ArrowRight className="h-5 w-5 text-primary-foreground" />
              </div>
            </div>
          </motion.button>
        )}

        {/* Discover Section */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-destructive" />
            <h2 className="text-sm font-display font-bold text-foreground">Discover</h2>
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  activeCategory === cat.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Poll Cards */}
          <div className="space-y-2.5">
            {filtered && filtered.length > 0 ? (
              filtered.map((poll, i) => {
                const winnerIsA = poll.percentA >= poll.percentB;
                const Tag = tagConfig[poll.tag];
                const TagIcon = Tag.icon;
                return (
                  <motion.div
                    key={poll.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => navigate('/vote')}
                    className="rounded-2xl bg-card border border-border p-4 space-y-2.5 cursor-pointer active:scale-[0.98] transition-transform"
                  >
                    {/* Tag + votes */}
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${Tag.color}`}>
                        <TagIcon className="h-3 w-3" />
                        {Tag.label}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Users className="h-3 w-3" />
                        {poll.totalVotes.toLocaleString()}
                      </span>
                    </div>

                    <p className="text-sm font-semibold leading-snug text-foreground">
                      {poll.question}
                    </p>

                    <div className="flex h-1.5 rounded-full overflow-hidden bg-muted/50">
                      <div
                        className="bg-option-a rounded-l-full transition-all duration-500"
                        style={{ width: `${poll.percentA}%` }}
                      />
                      <div
                        className="bg-option-b rounded-r-full transition-all duration-500"
                        style={{ width: `${poll.percentB}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-[11px]">
                      <span className={winnerIsA ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                        {poll.option_a} ({poll.percentA}%)
                      </span>
                      <span className={!winnerIsA ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                        {poll.option_b} ({poll.percentB}%)
                      </span>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No perspectives in this category yet.
              </div>
            )}
          </div>
        </section>

        {/* Explore CTA */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          onClick={() => navigate('/vote')}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
        >
          <Zap className="h-4 w-4" />
          {hasUnseen ? 'Start Voting' : 'Explore Perspectives'}
        </motion.button>

        {/* Compressed Stats — pushed lower */}
        {userStats && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="flex items-center justify-between rounded-xl bg-card/60 border border-border/50 px-4 py-3"
          >
            {[
              { label: 'Points', value: userStats.points || 0 },
              { label: 'Streak', value: `${userStats.current_streak || 0}🔥` },
              { label: 'Active', value: `${userStats.total_days_active || 0}d` },
            ].map((stat, i) => (
              <div key={stat.label} className="text-center flex-1">
                <p className="text-sm font-bold text-foreground">{stat.value}</p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}
