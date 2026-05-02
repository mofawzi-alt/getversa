import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import ShareableTasteCard from '@/components/taste/ShareableTasteCard';
import { Loader2, Flame, BarChart3, Sparkles, TrendingUp, Eye, Clock, ShieldCheck } from 'lucide-react';
import TasteEvolutionTimeline from '@/components/taste/TasteEvolutionTimeline';
import { motion } from 'framer-motion';
import PersonalityTypeCard from '@/components/profile/PersonalityTypeCard';
import { computePersonalityType } from '@/lib/personalityType';

// ── Archetype engine ──
interface TraitEntry { tag: string; vote_count: number }

const ARCHETYPE_MAP: Record<string, { name: string; emoji: string }> = {
  risk_taker: { name: 'The Risk Taker', emoji: '🎲' },
  conservative: { name: 'The Loyalist', emoji: '🛡️' },
  experience: { name: 'The Explorer', emoji: '🧭' },
  practical: { name: 'The Minimalist', emoji: '✨' },
  brand_oriented: { name: 'The Trendsetter', emoji: '👑' },
  price_sensitive: { name: 'The Strategist', emoji: '🎯' },
  growth: { name: 'The Visionary', emoji: '🚀' },
  convenience: { name: 'The Optimizer', emoji: '⚡' },
};

const TRAIT_DESCRIPTORS: Record<string, { positive: string; versus: string }> = {
  risk_taker: { positive: 'bold choices', versus: 'risk over safety' },
  conservative: { positive: 'stability', versus: 'tradition over novelty' },
  experience: { positive: 'experiences over things', versus: 'lifestyle over material' },
  practical: { positive: 'practical value', versus: 'function over form' },
  brand_oriented: { positive: 'trusted brands', versus: 'premium over budget' },
  price_sensitive: { positive: 'smart spending', versus: 'value over hype' },
  growth: { positive: 'long-term growth', versus: 'future over present' },
  convenience: { positive: 'convenience', versus: 'ease over effort' },
};

function computeArchetype(traits: TraitEntry[]): { name: string; description: string; emoji: string } {
  if (!traits.length) return { name: 'The Newcomer', description: 'Vote on more polls to discover your taste identity', emoji: '🌱' };
  const topTrait = traits[0]?.tag;
  const secondTrait = traits[1]?.tag;
  const archetype = ARCHETYPE_MAP[topTrait] || { name: 'The Individual', emoji: '💎' };
  const desc1 = TRAIT_DESCRIPTORS[topTrait];
  const desc2 = secondTrait ? TRAIT_DESCRIPTORS[secondTrait] : null;
  let description = '';
  if (desc1 && desc2) {
    description = `You prefer ${desc1.versus}, ${desc2.versus}`;
  } else if (desc1) {
    description = `You consistently choose ${desc1.positive}`;
  } else {
    description = 'Your choices define a unique perspective';
  }
  return { ...archetype, description };
}

// ── Dimensions config ──
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

const DIMENSION_GRADIENTS: Record<string, string> = {
  'Tradition vs Innovation': 'from-amber-500 to-orange-400',
  'Budget vs Premium': 'from-emerald-500 to-teal-400',
  'Local vs Global': 'from-blue-500 to-cyan-400',
  'Practicality vs Experience': 'from-violet-500 to-purple-400',
  'Health vs Indulgence': 'from-rose-500 to-pink-400',
};

const DIMENSION_COLORS: Record<string, { bg: string; bar: string; text: string }> = {
  'Tradition vs Innovation': { bg: 'bg-amber-50', bar: 'bg-amber-500', text: 'text-amber-700' },
  'Budget vs Premium': { bg: 'bg-emerald-50', bar: 'bg-emerald-500', text: 'text-emerald-700' },
  'Local vs Global': { bg: 'bg-blue-50', bar: 'bg-blue-500', text: 'text-blue-700' },
  'Practicality vs Experience': { bg: 'bg-violet-50', bar: 'bg-violet-500', text: 'text-violet-700' },
  'Health vs Indulgence': { bg: 'bg-rose-50', bar: 'bg-rose-500', text: 'text-rose-700' },
};

const DIMENSION_POLES: Record<string, [string, string]> = {
  'Tradition vs Innovation': ['Tradition', 'Innovation'],
  'Budget vs Premium': ['Budget', 'Premium'],
  'Local vs Global': ['Local', 'Global'],
  'Practicality vs Experience': ['Practicality', 'Experience'],
  'Health vs Indulgence': ['Health', 'Indulgence'],
};

const FALLBACK_LABEL = { label: 'Emerging', description: 'This dimension is still forming.', emoji: '🌱' };

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
    <div className="mt-2 space-y-1">
      <div className="flex justify-between text-[10px] text-foreground/50 font-bold uppercase tracking-wider">
        <span>{poleA}</span>
        <span>{poleB}</span>
      </div>
      <div className="relative h-2 rounded-full bg-black/[0.06] overflow-hidden">
        <div className="absolute left-1/2 top-0 h-full w-px bg-black/10 z-10" />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.abs(pct - 50)}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
          className={`absolute top-0 h-full ${barColor} opacity-30 rounded-full`}
          style={{ left: pct < 50 ? `${pct}%` : '50%' }}
        />
        <motion.div
          initial={{ left: '50%' }}
          animate={{ left: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3.5 w-3.5 rounded-full ${barColor} border-2 border-background shadow-md z-20`}
        />
      </div>
    </div>
  );
}

// ── Day/time helpers ──
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getMostActiveDay(votes: { created_at: string }[]): string {
  if (!votes.length) return '—';
  const counts = new Map<number, number>();
  votes.forEach(v => {
    const day = new Date(v.created_at).getDay();
    counts.set(day, (counts.get(day) || 0) + 1);
  });
  let maxDay = 0, maxCount = 0;
  counts.forEach((count, day) => { if (count > maxCount) { maxCount = count; maxDay = day; } });
  return DAY_NAMES[maxDay];
}

function getMostActiveTime(votes: { created_at: string }[]): string {
  if (!votes.length) return '—';
  const counts = new Map<number, number>();
  votes.forEach(v => {
    const hour = new Date(v.created_at).getHours();
    counts.set(hour, (counts.get(hour) || 0) + 1);
  });
  let maxHour = 0, maxCount = 0;
  counts.forEach((count, hour) => { if (count > maxCount) { maxCount = count; maxHour = hour; } });
  const ampm = maxHour >= 12 ? 'PM' : 'AM';
  const h = maxHour % 12 || 12;
  return `${h}:00 ${ampm}`;
}

// ── Main page ──
export default function TasteProfile() {
  const { user, profile } = useAuth();

  const { data: allVotes, isLoading: loadingVotes } = useQuery({
    queryKey: ['taste-all-votes', profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase.from('votes')
        .select('id, created_at, poll_id, choice, category')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!profile,
  });

  const { data: traits } = useQuery({
    queryKey: ['taste-traits', profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase.rpc('get_user_voting_traits', { p_user_id: profile.id });
      return (data || []) as TraitEntry[];
    },
    enabled: !!profile,
  });

  const { data: userStats } = useQuery({
    queryKey: ['taste-user-stats', profile?.id],
    queryFn: async () => {
      if (!profile) return null;
      const { data } = await supabase.from('users')
        .select('current_streak, longest_streak, points')
        .eq('id', profile.id)
        .single();
      return data;
    },
    enabled: !!profile,
  });

  // Dimensions data
  const { data: dimensionInsights } = useQuery({
    queryKey: ['insight-profile', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.rpc('get_insight_profile', { p_user_id: user.id });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && (allVotes?.length ?? 0) >= 20,
  });

  const { data: majorityRatio } = useQuery({
    queryKey: ['taste-majority-ratio', profile?.id],
    queryFn: async () => {
      if (!profile || !allVotes?.length) return null;
      const recentVotes = allVotes.slice(0, 200);
      if (recentVotes.length < 5) return null;
      const pollIds = recentVotes.map(v => v.poll_id);
      const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: pollIds });
      if (!results?.length) return null;
      const resultsMap = new Map(results.map((r: any) => [r.poll_id, r]));
      let majority = 0;
      let minority = 0;
      for (const vote of recentVotes) {
        const r = resultsMap.get(vote.poll_id) as any;
        if (!r || r.total_votes < 5) continue;
        const userPct = vote.choice === 'A' ? r.percent_a : r.percent_b;
        if (userPct > 50) majority++;
        else if (userPct < 50) minority++;
      }
      const total = majority + minority;
      if (total === 0) return null;
      return { majorityPct: Math.round((majority / total) * 100), minorityPct: Math.round((minority / total) * 100) };
    },
    enabled: !!profile && !!allVotes?.length,
    staleTime: 1000 * 60 * 10,
  });

  const { data: surprisingResult } = useQuery({
    queryKey: ['taste-surprising', profile?.id],
    queryFn: async () => {
      if (!profile || !allVotes?.length) return null;
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const weeklyVotes = allVotes.filter(v => new Date(v.created_at) >= oneWeekAgo);
      if (!weeklyVotes.length) return null;
      const pollIds = weeklyVotes.map(v => v.poll_id);
      const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: pollIds });
      if (!results?.length) return null;
      const resultsMap = new Map(results.map((r: any) => [r.poll_id, r]));
      let mostMinority: { pollId: string; question: string; userPercent: number; choice: string } | null = null;
      let lowestPercent = 100;
      for (const vote of weeklyVotes) {
        const r = resultsMap.get(vote.poll_id);
        if (!r || r.total_votes < 5) continue;
        const userPct = vote.choice === 'A' ? r.percent_a : r.percent_b;
        if (userPct < lowestPercent) {
          lowestPercent = userPct;
          mostMinority = { pollId: vote.poll_id, question: '', userPercent: userPct, choice: vote.choice };
        }
      }
      if (!mostMinority || lowestPercent >= 45) return null;
      const { data: poll } = await supabase.from('polls')
        .select('question, option_a, option_b')
        .eq('id', mostMinority.pollId)
        .single();
      if (poll) mostMinority.question = poll.question;
      return mostMinority;
    },
    enabled: !!profile && !!allVotes?.length,
  });

  if (loadingVotes) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const totalVotes = allVotes?.length || 0;
  const currentStreak = userStats?.current_streak || 0;
  const longestStreak = userStats?.longest_streak || 0;
  const dimensionsUnlocked = totalVotes >= 20;

  const categoryCounts = new Map<string, number>();
  allVotes?.forEach(v => {
    if (v.category) categoryCounts.set(v.category, (categoryCounts.get(v.category) || 0) + 1);
  });
  let topCategory = '—';
  let topCatCount = 0;
  categoryCounts.forEach((count, cat) => { if (count > topCatCount) { topCatCount = count; topCategory = cat; } });

  const archetype = computeArchetype(traits || []);
  const personality = computePersonalityType(traits || [], totalVotes, profile?.id);

  const dynamicDescription = (() => {
    if (!majorityRatio) return archetype.description;
    if (majorityRatio.minorityPct > 25) return 'You go against the crowd more than most — classic independent thinker.';
    if (majorityRatio.majorityPct > 75) return 'You have your finger on the pulse — you think like the majority.';
    return "You're unpredictable — half maverick, half mainstream.";
  })();

  const mostActiveDay = getMostActiveDay(allVotes || []);
  const mostActiveTime = getMostActiveTime(allVotes || []);

  const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
  const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

  return (
    <AppLayout>
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="p-4 pb-24 space-y-5"
      >
        {/* Header */}
        <motion.header variants={fadeUp} className="text-center pt-2">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold text-primary uppercase tracking-wider">Your Taste Profile</span>
          </div>
          <p className="text-muted-foreground text-sm">Discover who you are through your choices</p>
        </motion.header>

        {/* ── TASTE IDENTITY ── */}
        <motion.section variants={fadeUp}>
          <ShareableTasteCard
            archetype={archetype.name}
            description={dynamicDescription}
            topCategory={topCategory}
            totalVotes={totalVotes}
            streak={currentStreak}
            personalityCode={personality.ready ? personality.code : undefined}
            personalityName={personality.ready ? personality.name : undefined}
          />
        </motion.section>

        {/* ── PERSONALITY TYPE ── */}
        {profile && (
          <motion.section variants={fadeUp}>
            <PersonalityTypeCard userId={profile.id} isOwnProfile />
          </motion.section>
        )}

         {/* ── TASTE PROFILE ── */}
         <motion.section variants={fadeUp} className="space-y-3">
           <div className="flex items-center justify-between">
             <h3 className="text-sm font-bold text-foreground/70 uppercase tracking-wider flex items-center gap-2">
               🔮 Taste Profile
            </h3>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <ShieldCheck className="h-3 w-3" />
              <span>Private</span>
            </div>
          </div>

          {!dimensionsUnlocked ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass rounded-2xl p-6 text-center space-y-4"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mx-auto">
                <span className="text-2xl">🔒</span>
              </div>
              <div>
                <p className="text-base font-display font-bold text-foreground">Your taste profile is forming</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {Math.max(0, 20 - totalVotes)} more vote{Math.max(0, 20 - totalVotes) !== 1 ? 's' : ''} to unlock ✨
                </p>
              </div>
              <div className="max-w-[200px] mx-auto">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (totalVotes / 20) * 100)}%` }}
                    transition={{ duration: 1 }}
                    className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">{totalVotes}/20</p>
              </div>
            </motion.div>
          ) : dimensionInsights && dimensionInsights.length > 0 ? (
            <div className="space-y-3">
              {dimensionInsights.map((insight: { dimension_name: string; tendency: string; score: number; vote_count: number }, index: number) => {
                const display = getTendencyDisplay(insight.dimension_name, insight.tendency);
                const poles = DIMENSION_POLES[insight.dimension_name] || ['A', 'B'];
                const colors = DIMENSION_COLORS[insight.dimension_name] || { bg: 'bg-muted/30', bar: 'bg-primary', text: 'text-foreground' };
                const gradient = DIMENSION_GRADIENTS[insight.dimension_name] || 'from-primary to-primary/70';

                return (
                  <motion.div
                    key={insight.dimension_name}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.08, duration: 0.4 }}
                    className={`${colors.bg} rounded-2xl p-4 border border-black/[0.04] relative overflow-hidden`}
                  >
                    {/* Gradient accent bar at top */}
                    <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient}`} />

                    <div className="flex items-start gap-3 mt-1">
                      <span className="text-2xl mt-0.5">{display.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={`text-xl font-display font-black ${colors.text} leading-tight`}>
                            {display.label}
                          </span>
                          <span className="text-[9px] font-semibold text-muted-foreground bg-background/70 px-2 py-0.5 rounded-full">
                            {insight.vote_count} votes
                          </span>
                        </div>
                        <p className="text-[12px] text-foreground/60 font-medium mt-0.5 leading-snug">
                          {display.description}
                        </p>
                        <SpectrumBar
                          score={insight.score}
                          poleA={poles[0]}
                          poleB={poles[1]}
                          barColor={colors.bar}
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="glass rounded-2xl p-6 text-center">
              <span className="text-2xl">🌱</span>
              <p className="text-sm text-muted-foreground mt-2">Your dimensions are still emerging. Keep voting.</p>
            </div>
          )}
        </motion.section>

        {/* ── TASTE STATS ── */}
        <motion.section variants={fadeUp} className="space-y-3">
          <h3 className="text-sm font-bold text-foreground/70 uppercase tracking-wider flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Taste Stats
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Total Votes', value: totalVotes, icon: '🗳️' },
              { label: 'Current Streak', value: `${currentStreak}d`, icon: '🔥' },
              { label: 'Longest Streak', value: `${longestStreak}d`, icon: '🏆' },
              { label: 'Favorite Category', value: topCategory, icon: '⭐' },
              { label: 'Most Active Day', value: mostActiveDay, icon: '📅' },
              { label: 'Most Active Time', value: mostActiveTime, icon: '⏰' },
            ].map((stat) => (
              <div key={stat.label} className="glass rounded-2xl p-4">
                <div className="text-lg mb-1">{stat.icon}</div>
                <div className="text-lg font-bold font-display">{stat.value}</div>
                <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── MOST SURPRISING RESULT ── */}
        {surprisingResult && (
          <motion.section variants={fadeUp}>
            <h3 className="text-sm font-bold text-foreground/70 uppercase tracking-wider flex items-center gap-2 mb-3">
              <Eye className="h-4 w-4" /> Most Surprising Result
            </h3>
            <div className="glass rounded-2xl p-5 border-l-4 border-destructive">
              <p className="text-sm text-muted-foreground mb-2">{surprisingResult.question}</p>
              <p className="text-lg font-display font-bold text-destructive">
                👀 You were in the {surprisingResult.userPercent}% minority
              </p>
            </div>
          </motion.section>
        )}

        {/* ── STREAK TRACKER ── */}
        <motion.section variants={fadeUp}>
          <h3 className="text-sm font-bold text-foreground/70 uppercase tracking-wider flex items-center gap-2 mb-3">
            <Flame className="h-4 w-4" /> Streak Journey
          </h3>
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center">
                <Flame className="h-8 w-8 text-primary-foreground" />
              </div>
              <div>
                <div className="text-3xl font-display font-bold">{currentStreak}</div>
                <div className="text-xs text-muted-foreground">Day Streak</div>
              </div>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((currentStreak / 30) * 100, 100)}%` }}
                transition={{ duration: 1, delay: 0.5 }}
                className="h-full rounded-full bg-gradient-primary"
              />
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-[10px] text-muted-foreground">0</span>
              {[3, 7, 14, 30].map(m => (
                <span key={m} className={`text-[10px] font-bold ${currentStreak >= m ? 'text-primary' : 'text-muted-foreground/40'}`}>
                  {m}d {currentStreak >= m ? '✓' : ''}
                </span>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ── TASTE EVOLUTION TIMELINE ── */}
        <motion.section variants={fadeUp}>
          <h3 className="text-sm font-bold text-foreground/70 uppercase tracking-wider flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4" /> Your Evolution
          </h3>
          <TasteEvolutionTimeline />
        </motion.section>

        {/* ── TASTE TRAITS ── */}
        <motion.section variants={fadeUp}>
          <h3 className="text-sm font-bold text-foreground/70 uppercase tracking-wider flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4" /> Taste Traits
          </h3>
          <div className="glass rounded-2xl p-5">
            <p className="text-sm text-muted-foreground mb-3">Your top decision traits:</p>
            <div className="space-y-2.5">
              {(traits || []).filter(t => t.vote_count >= 3).slice(0, 5).map((t, i, arr) => {
                const maxCount = arr[0]?.vote_count || 1;
                const pct = Math.round((t.vote_count / maxCount) * 100);
                const label = TRAIT_DESCRIPTORS[t.tag]?.positive || t.tag.replace(/_/g, ' ');
                return (
                  <div key={t.tag}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium capitalize">{label}</span>
                      <span className="text-muted-foreground">{t.vote_count} votes</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: 0.3 + i * 0.1 }}
                        className="h-full rounded-full bg-primary"
                        style={{ opacity: 1 - i * 0.12 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.section>
      </motion.div>
    </AppLayout>
  );
}
