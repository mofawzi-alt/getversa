import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { motion } from 'framer-motion';
import { Loader2, Lock, ShieldCheck } from 'lucide-react';

const TENDENCY_LABELS: Record<string, Record<string, { label: string; description: string; emoji: string }>> = {
  'Tradition vs Innovation': {
    strong_a: { label: 'Rooted', description: 'You find meaning in what endures.', emoji: '🏛️' },
    lean_a: { label: 'Grounded', description: 'You value the familiar, with room for the new.', emoji: '🌿' },
    balanced: { label: 'Adaptive', description: 'You hold both the old and the new.', emoji: '🔄' },
    lean_b: { label: 'Forward-leaning', description: 'You are drawn to what is emerging.', emoji: '🚀' },
    strong_b: { label: 'Visionary', description: 'You seek what has not been built yet.', emoji: '✨' },
  },
  'Budget vs Premium': {
    strong_a: { label: 'Saver', description: 'You optimize for value and savings.', emoji: '💰' },
    lean_a: { label: 'Budget-minded', description: 'You lean toward deals, but treat yourself sometimes.', emoji: '🏷️' },
    balanced: { label: 'Balanced spender', description: 'You weigh cost and quality equally.', emoji: '⚖️' },
    lean_b: { label: 'Quality-first', description: 'You invest in what lasts.', emoji: '💎' },
    strong_b: { label: 'Premium', description: 'You choose the best, cost aside.', emoji: '👑' },
  },
  'Local vs Global': {
    strong_a: { label: 'Homegrown', description: 'You champion what is local.', emoji: '🏠' },
    lean_a: { label: 'Local-leaning', description: 'You prefer homegrown, but stay open.', emoji: '📍' },
    balanced: { label: 'Glocal', description: 'You blend the local and the global.', emoji: '🌍' },
    lean_b: { label: 'World-curious', description: 'You gravitate toward international choices.', emoji: '✈️' },
    strong_b: { label: 'Global citizen', description: 'You reach for the world stage.', emoji: '🌐' },
  },
  'Practicality vs Experience': {
    strong_a: { label: 'Pragmatist', description: 'You prioritize function and value.', emoji: '🔧' },
    lean_a: { label: 'Practical', description: 'You lean toward what works, with room for flair.', emoji: '📐' },
    balanced: { label: 'Versatile', description: 'You balance practicality and experience.', emoji: '🎭' },
    lean_b: { label: 'Experience-seeker', description: 'You value moments over material.', emoji: '🎪' },
    strong_b: { label: 'Experientialist', description: 'You live for feelings and moments.', emoji: '🌈' },
  },
  'Health vs Indulgence': {
    strong_a: { label: 'Wellness-driven', description: 'You consistently choose what is healthy.', emoji: '🥗' },
    lean_a: { label: 'Health-conscious', description: 'You lean toward wellness with occasional treats.', emoji: '🍎' },
    balanced: { label: 'Balanced', description: 'You enjoy both discipline and indulgence.', emoji: '☯️' },
    lean_b: { label: 'Treat-yourself', description: 'You enjoy life\'s pleasures freely.', emoji: '🍫' },
    strong_b: { label: 'Indulgent', description: 'You follow your cravings without apology.', emoji: '🎂' },
  },
};

const FALLBACK_LABEL = { label: 'Emerging', description: 'This dimension is still forming.', emoji: '🌱' };

const DIMENSION_ICONS: Record<string, string> = {
  'Tradition vs Innovation': '⚡',
  'Budget vs Premium': '💳',
  'Local vs Global': '🗺️',
  'Practicality vs Experience': '🎯',
  'Health vs Indulgence': '🍃',
};

const DIMENSION_POLES: Record<string, [string, string]> = {
  'Tradition vs Innovation': ['Tradition', 'Innovation'],
  'Budget vs Premium': ['Budget', 'Premium'],
  'Local vs Global': ['Local', 'Global'],
  'Practicality vs Experience': ['Practicality', 'Experience'],
  'Health vs Indulgence': ['Health', 'Indulgence'],
};

const DIMENSION_COLORS: Record<string, { bg: string; accent: string; bar: string }> = {
  'Tradition vs Innovation': { bg: 'bg-amber-50', accent: 'text-amber-600', bar: 'bg-amber-500' },
  'Budget vs Premium': { bg: 'bg-emerald-50', accent: 'text-emerald-600', bar: 'bg-emerald-500' },
  'Local vs Global': { bg: 'bg-blue-50', accent: 'text-blue-600', bar: 'bg-blue-500' },
  'Practicality vs Experience': { bg: 'bg-violet-50', accent: 'text-violet-600', bar: 'bg-violet-500' },
  'Health vs Indulgence': { bg: 'bg-rose-50', accent: 'text-rose-600', bar: 'bg-rose-500' },
};

function getTendencyDisplay(dimension: string, tendency: string) {
  const dimLabels = TENDENCY_LABELS[dimension];
  if (dimLabels && dimLabels[tendency]) return dimLabels[tendency];
  return FALLBACK_LABEL;
}

function scoreToPercent(score: number): number {
  const clamped = Math.max(-6, Math.min(6, score));
  return ((clamped + 6) / 12) * 100;
}

function SpectrumBar({ score, poleA, poleB, barColor }: { score: number; poleA: string; poleB: string; barColor: string }) {
  const pct = scoreToPercent(score);

  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex justify-between text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
        <span>{poleA}</span>
        <span>{poleB}</span>
      </div>
      <div className="relative h-2.5 rounded-full bg-muted/60 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-full w-px bg-border/40 z-10" />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.abs(pct - 50)}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
          className={`absolute top-0 h-full ${barColor} opacity-40 rounded-full`}
          style={{
            left: pct < 50 ? `${pct}%` : '50%',
          }}
        />
        <motion.div
          initial={{ left: '50%' }}
          animate={{ left: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-4 w-4 rounded-full ${barColor} border-2 border-background shadow-md z-20`}
        />
      </div>
    </div>
  );
}

export default function InsightProfile() {
  const { user } = useAuth();

  const { data: totalVotes, isLoading: votesLoading } = useQuery({
    queryKey: ['user-vote-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase
        .from('votes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      return count || 0;
    },
    enabled: !!user,
  });

  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: ['insight-profile', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.rpc('get_insight_profile', {
        p_user_id: user.id,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && (totalVotes ?? 0) >= 20,
  });

  const isLoading = votesLoading || insightsLoading;
  const isUnlocked = (totalVotes ?? 0) >= 20;
  const votesRemaining = Math.max(0, 20 - (totalVotes ?? 0));

  return (
    <AppLayout>
      <div className="min-h-screen p-4 pb-24">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔮</span>
            <h1 className="text-2xl font-display font-bold text-foreground">Your Dimensions</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1 ml-9">
            A private reflection shaped by your choices.
          </p>
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center mt-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !isUnlocked ? (
          /* Locked state */
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-10 space-y-6"
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                <span className="text-3xl">🔒</span>
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-display font-semibold text-foreground">
                  Your profile is forming
                </h2>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Share {votesRemaining} more perspective{votesRemaining !== 1 ? 's' : ''} to reveal your dimensions ✨
                </p>
              </div>
            </div>

            <div className="max-w-xs mx-auto">
              <div className="flex justify-between text-xs text-muted-foreground mb-2">
                <span>{totalVotes} shared</span>
                <span>20 needed</span>
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, ((totalVotes ?? 0) / 20) * 100)}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70"
                />
              </div>
            </div>

            <p className="text-center text-xs text-muted-foreground italic">
              Every swipe shapes the picture 🎨
            </p>
          </motion.div>
        ) : (
          /* Unlocked — show dimensions */
          <div className="space-y-4">
            {/* Privacy badge */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center gap-2 py-2 px-4 rounded-full bg-muted/40 w-fit mx-auto"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] text-muted-foreground font-medium tracking-wide">
                Private · only you can see this
              </span>
            </motion.div>

            {insights && insights.length > 0 ? (
              <div className="space-y-3">
                {insights.map((insight: { dimension_name: string; tendency: string; score: number; vote_count: number }, index: number) => {
                  const display = getTendencyDisplay(insight.dimension_name, insight.tendency);
                  const poles = DIMENSION_POLES[insight.dimension_name] || ['A', 'B'];
                  const colors = DIMENSION_COLORS[insight.dimension_name] || { bg: 'bg-muted/30', accent: 'text-foreground', bar: 'bg-primary' };
                  const dimIcon = DIMENSION_ICONS[insight.dimension_name] || '📊';

                  return (
                    <motion.div
                      key={insight.dimension_name}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1, duration: 0.4 }}
                      className={`${colors.bg} rounded-2xl p-5 space-y-1 border border-black/[0.03]`}
                    >
                      {/* Dimension header */}
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs">{dimIcon}</span>
                        <span className={`text-[10px] font-semibold uppercase tracking-wider ${colors.accent}`}>
                          {insight.dimension_name}
                        </span>
                      </div>

                      {/* Label + emoji */}
                      <div className="flex items-baseline justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{display.emoji}</span>
                          <span className="text-xl font-display font-bold text-foreground">
                            {display.label}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground bg-background/60 px-2 py-0.5 rounded-full">
                          {insight.vote_count} votes
                        </span>
                      </div>

                      <p className="text-sm text-muted-foreground pl-9">
                        {display.description}
                      </p>

                      <SpectrumBar
                        score={insight.score}
                        poleA={poles[0]}
                        poleB={poles[1]}
                        barColor={colors.bar}
                      />
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="glass rounded-2xl p-6 text-center space-y-2">
                <span className="text-3xl">🌱</span>
                <p className="text-sm text-muted-foreground">
                  Your dimensions are still emerging. Keep sharing perspectives.
                </p>
              </div>
            )}

            {/* Footer stats */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-center pt-4 space-y-1"
            >
              <p className="text-xs text-muted-foreground">
                📊 Based on {totalVotes} perspectives shared
              </p>
              <p className="text-[10px] text-muted-foreground/50 italic">
                🔒 This is a private reflection. It is not shared with anyone.
              </p>
            </motion.div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
