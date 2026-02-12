import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowRight, Flame, Sparkles, TrendingUp, Users, Zap, X } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

// Compact ring indicator
function MiniRing({ percent, color }: { percent: number; color: string }) {
  const r = 14;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" className="shrink-0">
      <circle cx="18" cy="18" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="3" opacity="0.3" />
      <motion.circle
        cx="18" cy="18" r={r} fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        transform="rotate(-90 18 18)"
      />
    </svg>
  );
}

const tagConfig = {
  trending: { icon: Flame, label: 'TRENDING', color: 'text-destructive', bg: 'bg-destructive/15' },
  fresh: { icon: Sparkles, label: 'NEW', color: 'text-accent', bg: 'bg-accent/15' },
  popular: { icon: TrendingUp, label: 'POPULAR', color: 'text-primary', bg: 'bg-primary/15' },
};

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState('all');
  const [resultsPoll, setResultsPoll] = useState<PollCard | null>(null);

  // User's voted poll IDs
  const { data: votedPollIds } = useQuery({
    queryKey: ['user-voted-ids', user?.id],
    queryFn: async () => {
      if (!user) return new Set<string>();
      const { data: votes } = await supabase
        .from('votes')
        .select('poll_id')
        .eq('user_id', user.id);
      return new Set(votes?.map(v => v.poll_id) || []);
    },
    staleTime: 1000 * 60 * 2,
  });

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
      const voted = new Set(votes?.map(v => v.poll_id) || []);
      return polls.filter(p => !voted.has(p.id)).length;
    },
    staleTime: 1000 * 60 * 2,
  });

  // Mixed poll feed
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
      const resultsMap = new Map(results?.map((r: any) => [r.poll_id, r]) || []);
      const enriched = polls.map(p => {
        const r = resultsMap.get(p.id);
        return { ...p, totalVotes: (r?.total_votes as number) || 0, percentA: (r?.percent_a as number) || 0, percentB: (r?.percent_b as number) || 0 };
      });
      const trending = [...enriched].filter(p => p.totalVotes > 0).sort((a, b) => b.totalVotes - a.totalVotes).slice(0, 2).map(p => ({ ...p, tag: 'trending' as const }));
      const trendingIds = new Set(trending.map(p => p.id));
      const fresh = enriched.filter(p => !trendingIds.has(p.id)).slice(0, 2).map(p => ({ ...p, tag: 'fresh' as const }));
      const usedIds = new Set([...trendingIds, ...fresh.map(p => p.id)]);
      const popular = [...enriched].filter(p => p.totalVotes > 0 && !usedIds.has(p.id)).sort((a, b) => b.totalVotes - a.totalVotes).slice(0, 1).map(p => ({ ...p, tag: 'popular' as const }));
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
      const { data } = await supabase.from('users').select('points, current_streak, total_days_active').eq('id', user.id).single();
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
  const filtered = activeCategory === 'all' ? mixedPolls : mixedPolls?.filter(p => p.category?.toLowerCase() === activeCategory);

  const handlePollTap = (poll: PollCard) => {
    const hasVoted = votedPollIds?.has(poll.id);
    if (hasVoted) {
      setResultsPoll(poll);
    } else {
      navigate(`/vote?pollId=${poll.id}`);
    }
  };

  const ctaText = (unseenCount || 0) >= 3
    ? `${unseenCount} hot debates waiting 🔥`
    : unseenCount === 1
      ? `1 fresh perspective just dropped`
      : `${unseenCount} new perspectives to explore`;

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col p-4 pb-24 gap-6">
        {/* Header */}
        <header className="pt-1">
          <h1 className="text-3xl font-display font-bold text-gradient tracking-tight">VERSA</h1>
          <p className="text-xs text-muted-foreground mt-1 tracking-wide">Where perspectives collide</p>
        </header>

        {/* Hot debates CTA */}
        {hasUnseen && (
          <motion.button
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            onClick={() => navigate('/vote')}
            className="relative w-full rounded-2xl bg-gradient-primary p-5 text-left overflow-hidden group active:scale-[0.97] transition-transform"
          >
            <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-accent/10 blur-2xl" />
            <div className="absolute bottom-0 left-0 w-20 h-20 rounded-full bg-primary-foreground/5 blur-xl" />
            <div className="relative flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-base font-display font-bold text-primary-foreground leading-tight">
                  {ctaText}
                </p>
                <p className="text-[11px] text-primary-foreground/60 font-medium">
                  Tap to jump in
                </p>
              </div>
              <motion.div
                animate={{ x: [0, 4, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                className="h-11 w-11 rounded-full bg-primary-foreground/15 flex items-center justify-center"
              >
                <ArrowRight className="h-5 w-5 text-primary-foreground" />
              </motion.div>
            </div>
          </motion.button>
        )}

        {/* Discover Section */}
        <section className="space-y-4">
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-display font-bold text-foreground tracking-tight">Discover</h2>
            <span className="text-[10px] text-muted-foreground tracking-widest uppercase">what's happening</span>
          </div>

          {/* Category pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-[11px] font-bold tracking-wide transition-all duration-200 ${
                  activeCategory === cat.key
                    ? 'bg-primary text-primary-foreground shadow-glow'
                    : 'bg-secondary/60 text-secondary-foreground hover:bg-secondary'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Poll Cards — varied layout */}
          <div className="space-y-3">
            {filtered && filtered.length > 0 ? (
              filtered.map((poll, i) => {
                const Tag = tagConfig[poll.tag];
                const TagIcon = Tag.icon;
                const hasVoted = votedPollIds?.has(poll.id);
                const isFeature = i === 0; // first card gets extra presence

                return (
                  <motion.div
                    key={poll.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06, type: 'spring', stiffness: 260, damping: 20 }}
                    onClick={() => handlePollTap(poll)}
                    className={`rounded-2xl bg-card border border-border/60 cursor-pointer active:scale-[0.98] transition-transform ${
                      isFeature ? 'p-5 shadow-card' : 'p-4'
                    }`}
                  >
                    {/* Tag badge */}
                    <div className="flex items-center justify-between mb-3">
                      <motion.span
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: i * 0.06 + 0.15, type: 'spring', stiffness: 400 }}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-extrabold tracking-[0.1em] ${Tag.color} ${Tag.bg}`}
                      >
                        <TagIcon className="h-3 w-3" />
                        {Tag.label}
                      </motion.span>
                      <div className="flex items-center gap-1.5">
                        {hasVoted && (
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-semibold">
                            ✓ Voted
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {poll.totalVotes.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Question */}
                    <p className={`font-display font-bold leading-snug text-foreground mb-4 ${
                      isFeature ? 'text-base' : 'text-sm'
                    }`}>
                      {poll.question}
                    </p>

                    {/* Options with ring indicators */}
                    <div className="flex items-center gap-3">
                      {/* Option A */}
                      <div className="flex-1 flex items-center gap-2.5 min-w-0">
                        <MiniRing percent={poll.percentA} color="hsl(var(--option-a))" />
                        <div className="min-w-0">
                          <span className="text-lg font-display font-bold text-foreground">{poll.percentA}%</span>
                          <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">{poll.option_a}</p>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="w-px h-9 bg-border/50 shrink-0" />

                      {/* Option B */}
                      <div className="flex-1 flex items-center gap-2.5 min-w-0 justify-end text-right">
                        <div className="min-w-0">
                          <span className="text-lg font-display font-bold text-foreground">{poll.percentB}%</span>
                          <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">{poll.option_b}</p>
                        </div>
                        <MiniRing percent={poll.percentB} color="hsl(var(--option-b))" />
                      </div>
                    </div>

                    {/* Tap hint */}
                    <p className="text-[9px] text-muted-foreground/50 text-right mt-3 font-medium tracking-wide">
                      {hasVoted ? 'Tap for results' : 'Tap to vote →'}
                    </p>
                  </motion.div>
                );
              })
            ) : (
              <div className="text-center py-10 text-sm text-muted-foreground">
                No perspectives in this category yet.
              </div>
            )}
          </div>
        </section>

        {/* Explore CTA */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          onClick={() => navigate('/vote')}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-primary text-primary-foreground font-display font-bold text-sm tracking-wide hover:bg-primary/90 transition-colors"
        >
          <Zap className="h-4 w-4" />
          {hasUnseen ? 'Jump Into Voting' : 'Explore Perspectives'}
        </motion.button>

        {/* Compressed Stats — minimal */}
        {userStats && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex items-center justify-around rounded-2xl bg-card/40 border border-border/30 px-3 py-3"
          >
            {[
              { label: 'PTS', value: userStats.points || 0 },
              { label: 'STREAK', value: `${userStats.current_streak || 0}🔥` },
              { label: 'DAYS', value: userStats.total_days_active || 0 },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-sm font-display font-bold text-foreground">{stat.value}</p>
                <p className="text-[8px] text-muted-foreground/60 font-bold tracking-[0.15em] mt-0.5">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Results Modal */}
      <AnimatePresence>
        {resultsPoll && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setResultsPoll(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 24 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl bg-card border border-border p-6 space-y-5 shadow-card"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1 pr-4">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-bold">Results</p>
                  <p className="text-base font-display font-bold leading-snug text-foreground">
                    {resultsPoll.question}
                  </p>
                </div>
                <button
                  onClick={() => setResultsPoll(null)}
                  className="p-1.5 rounded-full bg-secondary hover:bg-secondary/80 transition-colors shrink-0"
                >
                  <X className="h-4 w-4 text-foreground" />
                </button>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {resultsPoll.totalVotes.toLocaleString()} votes
              </div>

              <div className="space-y-4">
                {[
                  { label: resultsPoll.option_a, percent: resultsPoll.percentA, ringColor: 'hsl(var(--option-a))' },
                  { label: resultsPoll.option_b, percent: resultsPoll.percentB, ringColor: 'hsl(var(--option-b))' },
                ].map((opt) => (
                  <div key={opt.label} className="flex items-center gap-4">
                    <MiniRing percent={opt.percent} color={opt.ringColor} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{opt.label}</p>
                    </div>
                    <span className="text-xl font-display font-bold text-foreground">{opt.percent}%</span>
                  </div>
                ))}
              </div>

              <div className="text-center pt-1">
                <span className="text-[10px] text-muted-foreground/60 italic">
                  You already shared your perspective.
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
