import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowRight, Flame, Sparkles, TrendingUp, Users, Zap, X, Radio } from 'lucide-react';
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
  const [showOverlay, setShowOverlay] = useState(false);

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
      const trending = [...enriched].filter(p => p.totalVotes > 0).sort((a, b) => b.totalVotes - a.totalVotes).slice(0, 3).map(p => ({ ...p, tag: 'trending' as const }));
      const trendingIds = new Set(trending.map(p => p.id));
      const fresh = enriched.filter(p => !trendingIds.has(p.id)).slice(0, 2).map(p => ({ ...p, tag: 'fresh' as const }));
      const usedIds = new Set([...trendingIds, ...fresh.map(p => p.id)]);
      const popular = [...enriched].filter(p => p.totalVotes > 0 && !usedIds.has(p.id)).sort((a, b) => b.totalVotes - a.totalVotes).slice(0, 2).map(p => ({ ...p, tag: 'popular' as const }));
      const mixed: PollCard[] = [];
      const sources = [trending, fresh, popular];
      const maxLen = Math.max(...sources.map(s => s.length));
      for (let i = 0; i < maxLen; i++) {
        for (const src of sources) {
          if (src[i]) mixed.push(src[i]);
        }
      }
      return mixed.slice(0, 7);
    },
    staleTime: 1000 * 60 * 5,
  });

  // Show overlay once per session when unseen polls exist
  useEffect(() => {
    if (unseenCount && unseenCount > 0 && !sessionStorage.getItem('home-overlay-dismissed')) {
      setShowOverlay(true);
    }
  }, [unseenCount]);

  const dismissOverlay = () => {
    setShowOverlay(false);
    sessionStorage.setItem('home-overlay-dismissed', 'true');
  };

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

  // Separate trending for LIVE NOW section
  const liveNowPolls = mixedPolls?.filter(p => p.tag === 'trending') || [];
  const discoverPolls = filtered?.filter(p => p.tag !== 'trending') || [];

  const handlePollTap = (poll: PollCard) => {
    const hasVoted = votedPollIds?.has(poll.id);
    if (hasVoted) {
      setResultsPoll(poll);
    } else {
      navigate(`/vote?pollId=${poll.id}`);
    }
  };

  return (
    <AppLayout>
      <div className="min-h-screen flex flex-col p-4 pb-24 gap-5">
        {/* Header */}
        <header className="pt-1">
          <h1 className="text-3xl font-display font-bold text-gradient tracking-tight">VERSA</h1>
          <p className="text-xs text-muted-foreground mt-1 tracking-wide">Where perspectives collide</p>
        </header>

        {/* === HERO SECTION === */}
        {hasUnseen ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className="relative rounded-2xl bg-gradient-primary p-6 overflow-hidden"
          >
            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-accent/10 blur-2xl" />
            <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-primary-foreground/5 blur-xl" />
            <div className="relative space-y-4">
              <div className="space-y-1">
                <p className="text-2xl font-display font-bold text-primary-foreground leading-tight">
                  🔥 {unseenCount} new {unseenCount === 1 ? 'debate' : 'debates'} waiting
                </p>
                <p className="text-sm text-primary-foreground/60 font-medium">
                  Your perspective matters — jump in now.
                </p>
              </div>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => navigate('/vote')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary-foreground/15 backdrop-blur-sm text-primary-foreground font-display font-bold text-sm tracking-wide border border-primary-foreground/20 hover:bg-primary-foreground/25 transition-colors"
              >
                <Zap className="h-4 w-4" />
                Jump In
                <ArrowRight className="h-4 w-4" />
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl bg-card border border-border/50 p-5 text-center space-y-2"
          >
            <p className="text-lg font-display font-bold text-foreground">✨ You're all caught up</p>
            <p className="text-xs text-muted-foreground">New debates drop regularly — check back soon.</p>
          </motion.div>
        )}

        {/* === LIVE NOW SECTION === */}
        {liveNowPolls.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Radio className="h-4 w-4 text-destructive" />
              </motion.div>
              <h2 className="text-sm font-display font-extrabold text-foreground tracking-widest uppercase">Live Now</h2>
              <span className="text-[10px] text-muted-foreground">Most active</span>
            </div>

            <div className="space-y-2">
              {liveNowPolls.map((poll, i) => {
                const hasVoted = votedPollIds?.has(poll.id);
                return (
                  <motion.div
                    key={poll.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08, type: 'spring', stiffness: 260, damping: 22 }}
                    onClick={() => handlePollTap(poll)}
                    className="flex items-center gap-3 rounded-xl bg-card border border-border/50 p-3.5 cursor-pointer active:scale-[0.98] transition-transform"
                  >
                    <div className="shrink-0 h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                      <Flame className="h-4 w-4 text-destructive" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-display font-bold text-foreground truncate">{poll.question}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Users className="h-2.5 w-2.5" /> {poll.totalVotes.toLocaleString()}
                        </span>
                        {hasVoted && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-semibold">✓ Voted</span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* === DISCOVER SECTION === */}
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

          {/* Poll Cards */}
          <div className="space-y-3">
            {discoverPolls.length > 0 ? (
              discoverPolls.map((poll, i) => {
                const Tag = tagConfig[poll.tag];
                const TagIcon = Tag.icon;
                const hasVoted = votedPollIds?.has(poll.id);

                return (
                  <motion.div
                    key={poll.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06, type: 'spring', stiffness: 260, damping: 20 }}
                    onClick={() => handlePollTap(poll)}
                    className="rounded-2xl bg-card border border-border/60 p-4 cursor-pointer active:scale-[0.98] transition-transform"
                  >
                    {/* Tag + meta row */}
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
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-semibold">✓ Voted</span>
                        )}
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Users className="h-3 w-3" /> {poll.totalVotes.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Question */}
                    <p className="text-sm font-display font-bold leading-snug text-foreground mb-3">{poll.question}</p>

                    {/* Compact result rings */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 flex items-center gap-2.5 min-w-0">
                        <MiniRing percent={poll.percentA} color="hsl(var(--option-a))" />
                        <div className="min-w-0">
                          <span className="text-lg font-display font-bold text-foreground">{poll.percentA}%</span>
                          <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">{poll.option_a}</p>
                        </div>
                      </div>
                      <div className="w-px h-9 bg-border/50 shrink-0" />
                      <div className="flex-1 flex items-center gap-2.5 min-w-0 justify-end text-right">
                        <div className="min-w-0">
                          <span className="text-lg font-display font-bold text-foreground">{poll.percentB}%</span>
                          <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">{poll.option_b}</p>
                        </div>
                        <MiniRing percent={poll.percentB} color="hsl(var(--option-b))" />
                      </div>
                    </div>

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
      </div>

      {/* === RESULTS MODAL === */}
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
                  <p className="text-base font-display font-bold leading-snug text-foreground">{resultsPoll.question}</p>
                </div>
                <button onClick={() => setResultsPoll(null)} className="p-1.5 rounded-full bg-secondary hover:bg-secondary/80 transition-colors shrink-0">
                  <X className="h-4 w-4 text-foreground" />
                </button>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> {resultsPoll.totalVotes.toLocaleString()} votes
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
                <span className="text-[10px] text-muted-foreground/60 italic">You already shared your perspective.</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === UNSEEN POLLS OVERLAY === */}
      <AnimatePresence>
        {showOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/70 backdrop-blur-md flex items-end sm:items-center justify-center p-4"
            onClick={dismissOverlay}
          >
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl bg-card border border-border p-6 space-y-5 shadow-card mb-4 sm:mb-0"
            >
              <div className="text-center space-y-2">
                <motion.p
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.15, type: 'spring', stiffness: 400 }}
                  className="text-3xl"
                >
                  ✨
                </motion.p>
                <p className="text-lg font-display font-bold text-foreground">
                  {unseenCount} new {(unseenCount || 0) === 1 ? 'perspective' : 'perspectives'} just dropped
                </p>
                <p className="text-xs text-muted-foreground">
                  Share your take and see how others think.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { dismissOverlay(); navigate('/vote'); }}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-primary text-primary-foreground font-display font-bold text-sm tracking-wide"
                >
                  <Zap className="h-4 w-4" />
                  Start Voting
                </motion.button>
                <button
                  onClick={dismissOverlay}
                  className="w-full px-5 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                >
                  Maybe Later
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
