import { lazy, Suspense, useMemo, useState, useCallback, useEffect } from 'react';
import { useDailyPulse, usePulseSettings, type PulseCard } from '@/hooks/useDailyPulse';
import { useAuth } from '@/contexts/AuthContext';
import StoryViewer, { type StoryCardData } from './StoryViewer';
import { hasSeenLocally } from '@/lib/pulseTime';
import { trackStoryEvent } from '@/lib/storyAnalytics';
import {
  Pin, Flame, MapPin, Building2, Bell, Users, Sparkles,
  Swords, Layers, Brain, Clock, Trophy, PartyPopper, BarChart3, Sunrise,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import {
  useBattleOfTheDay, useFriendsActivity,
  useYourPollsUpdated, usePredictRecap, useClosingSoon,
  useWeeklyVerdict, useNewThisWeek, useLastVisit,
} from '@/hooks/usePulseCircles';
import { useBreakdownFindings, type BreakdownFinding } from '@/hooks/useBreakdownFindings';
const BreakdownShareCard = lazy(() => import('./BreakdownShareCard'));
import { useEditorialStories, type EditorialStory } from '@/hooks/useEditorialStories';
import { EDITORIAL_STORY_META } from '@/lib/editorialStoryTypes';
import EditorialStoryViewer from './EditorialStoryViewer';
import { hasSeenLocally as hasSeenLocallyKey } from '@/lib/pulseTime';
import { useCategoryStories, getHiddenCategories } from '@/hooks/useCategoryStories';
import { getCategoryIcon, getCategoryColorClass } from '@/lib/categoryMeta';
import CategoryStoriesFilter from './CategoryStoriesFilter';

type DotColor = 'red' | 'blue' | 'gold' | null;

type CircleVisual = {
  Icon: LucideIcon;
  tileGradient: string;
  ringGradient: string;
  iconColor: string;
};

const TOPIC_VISUALS: Record<string, CircleVisual> = {
  egypt_today: {
    Icon: MapPin,
    tileGradient: 'bg-gradient-to-br from-rose-500 to-red-600',
    ringGradient: 'bg-gradient-to-tr from-rose-500 via-red-500 to-amber-400',
    iconColor: 'text-white',
  },
  battle: {
    Icon: Swords,
    tileGradient: 'bg-gradient-to-br from-red-600 to-rose-700',
    ringGradient: 'bg-gradient-to-tr from-red-600 via-rose-500 to-orange-400',
    iconColor: 'text-white',
  },
  updates: {
    Icon: Bell,
    tileGradient: 'bg-gradient-to-br from-sky-500 to-indigo-600',
    ringGradient: 'bg-gradient-to-tr from-sky-400 via-indigo-500 to-fuchsia-500',
    iconColor: 'text-white',
  },
  cairo: {
    Icon: Building2,
    tileGradient: 'bg-gradient-to-br from-amber-400 to-orange-600',
    ringGradient: 'bg-gradient-to-tr from-amber-400 via-orange-500 to-rose-500',
    iconColor: 'text-white',
  },
  friends: {
    Icon: Users,
    tileGradient: 'bg-gradient-to-br from-fuchsia-500 to-purple-600',
    ringGradient: 'bg-gradient-to-tr from-amber-400 via-yellow-500 to-fuchsia-500',
    iconColor: 'text-white',
  },
  categories: {
    Icon: Layers,
    tileGradient: 'bg-gradient-to-br from-emerald-500 to-teal-700',
    ringGradient: 'bg-gradient-to-tr from-emerald-400 via-teal-500 to-cyan-500',
    iconColor: 'text-white',
  },
  predict: {
    Icon: Brain,
    tileGradient: 'bg-gradient-to-br from-violet-500 to-purple-700',
    ringGradient: 'bg-gradient-to-tr from-violet-400 via-purple-500 to-pink-500',
    iconColor: 'text-white',
  },
  closing_soon: {
    Icon: Clock,
    tileGradient: 'bg-gradient-to-br from-red-500 to-rose-700',
    ringGradient: 'bg-gradient-to-tr from-red-500 via-rose-500 to-orange-500',
    iconColor: 'text-white',
  },
  weekly: {
    Icon: Trophy,
    tileGradient: 'bg-gradient-to-br from-amber-500 to-yellow-600',
    ringGradient: 'bg-gradient-to-tr from-amber-400 via-yellow-500 to-amber-300',
    iconColor: 'text-white',
  },
  new_this_week: {
    Icon: PartyPopper,
    tileGradient: 'bg-gradient-to-br from-cyan-500 to-blue-600',
    ringGradient: 'bg-gradient-to-tr from-cyan-400 via-blue-500 to-indigo-500',
    iconColor: 'text-white',
  },
  breakdown: {
    Icon: BarChart3,
    tileGradient: 'bg-gradient-to-br from-indigo-600 to-purple-800',
    ringGradient: 'bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500',
    iconColor: 'text-white',
  },
  morning_recap: {
    Icon: Sunrise,
    tileGradient: 'bg-gradient-to-br from-orange-400 to-pink-500',
    ringGradient: 'bg-gradient-to-tr from-amber-300 via-orange-400 to-pink-500',
    iconColor: 'text-white',
  },
};

const FALLBACK_VISUAL: CircleVisual = {
  Icon: Sparkles,
  tileGradient: 'bg-gradient-to-br from-slate-500 to-slate-700',
  ringGradient: 'bg-gradient-to-tr from-primary via-fuchsia-500 to-amber-400',
  iconColor: 'text-white',
};

const CATEGORY_EMOJI: Record<string, string> = {
  'brands': '🏷️', 'food & drinks': '🍔', 'entertainment': '🎬',
  'fintech & money': '💸', 'sports': '⚽', 'beauty': '💄',
  'lifestyle': '✨', 'wellness & habits': '🧠', 'telecom': '📱',
  'style & design': '👗', 'business & startups': '🚀', 'relationships': '💕',
  'personality': '🧬', 'the pulse': '🔥',
  'fmcg & food': '🛒', 'beauty & personal care': '💄',
  'financial services': '💰', 'media & entertainment': '🎬',
  'retail & e-commerce': '🛍️', 'telco & tech': '📱',
  'food delivery & dining': '🍕', 'automotive & mobility': '🚗',
  'lifestyle & society': '✨',
};
const emojiFor = (cat: string) => CATEGORY_EMOJI[cat.toLowerCase()] || '🔥';

// Category circle gradient colors
const CATEGORY_GRADIENTS: Record<string, { tile: string; ring: string }> = {
  'fmcg & food': { tile: 'bg-gradient-to-br from-green-500 to-emerald-600', ring: 'bg-gradient-to-tr from-green-400 via-emerald-500 to-teal-400' },
  'beauty & personal care': { tile: 'bg-gradient-to-br from-pink-500 to-rose-600', ring: 'bg-gradient-to-tr from-pink-400 via-rose-500 to-fuchsia-400' },
  'financial services': { tile: 'bg-gradient-to-br from-blue-500 to-indigo-600', ring: 'bg-gradient-to-tr from-blue-400 via-indigo-500 to-violet-400' },
  'media & entertainment': { tile: 'bg-gradient-to-br from-amber-500 to-orange-600', ring: 'bg-gradient-to-tr from-amber-400 via-orange-500 to-red-400' },
  'retail & e-commerce': { tile: 'bg-gradient-to-br from-purple-500 to-violet-600', ring: 'bg-gradient-to-tr from-purple-400 via-violet-500 to-indigo-400' },
  'telco & tech': { tile: 'bg-gradient-to-br from-teal-500 to-cyan-600', ring: 'bg-gradient-to-tr from-teal-400 via-cyan-500 to-sky-400' },
  'food delivery & dining': { tile: 'bg-gradient-to-br from-orange-500 to-red-600', ring: 'bg-gradient-to-tr from-orange-400 via-red-500 to-rose-400' },
  'automotive & mobility': { tile: 'bg-gradient-to-br from-slate-500 to-gray-700', ring: 'bg-gradient-to-tr from-slate-400 via-gray-500 to-zinc-400' },
  'lifestyle & society': { tile: 'bg-gradient-to-br from-rose-500 to-pink-600', ring: 'bg-gradient-to-tr from-rose-400 via-pink-500 to-fuchsia-400' },
  'the pulse': { tile: 'bg-gradient-to-br from-red-500 to-rose-700', ring: 'bg-gradient-to-tr from-red-400 via-rose-500 to-orange-400' },
};

const isPollMediaUrl = (url?: string | null) =>
  !!url && (/^https?:\/\//i.test(url) || url.startsWith('/'));

const resolvePollStoryMedia = (chosen?: string | null, alternate?: string | null) => {
  if (isPollMediaUrl(chosen)) return chosen;
  if (isPollMediaUrl(alternate)) return alternate;
  return null;
};

type CircleSpec = {
  topic: string;
  label: string;
  cards: StoryCardData[];
  dot: DotColor;
  /** Lower = higher priority. Used for ordering. */
  priority: number;
  /** Special marker for "always force position" — egypt=0, battle=1, updates=2 (when has data). */
  fixedPosition?: number;
  /** Special border (gold for weekly). */
  goldBorder?: boolean;
};

function pulseCardToStory(c: PulseCard, label: string, emoji?: string): StoryCardData {
  return {
    backgroundImage: c.winning_image || c.image_a_url || c.image_b_url,
    label,
    categoryEmoji: emoji,
    headline: c.question,
    primaryText: `${c.winning_option} wins ${c.winning_pct}%`,
    secondaryText: `${c.total_votes.toLocaleString()} votes`,
    splitA: { label: c.option_a, pct: c.pct_a },
    splitB: { label: c.option_b, pct: c.pct_b },
    votePollId: c.poll_id,
    shareable: true,
  };
}

function fmtCountdown(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return 'Ending now';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

function breakdownToCard(f: BreakdownFinding): StoryCardData {
  const d = f.detail || {};
  const poll = d.poll || {};
  let primary = '';
  let secondary = '';
  let splitA: { label: string; pct: number } | undefined;
  let splitB: { label: string; pct: number } | undefined;
  let label = 'The Breakdown';
  let bg = poll.image_a_url || poll.image_b_url || null;

  if (f.finding_type === 'gender_split' && d.female && d.male) {
    label = 'Gender Split';
    primary = `Women ${d.female.pct_a}% • Men ${d.male.pct_a}%`;
    secondary = `${d.gap_pct}pt gap on "${poll.option_a}"`;
    splitA = { label: `♀ ${poll.option_a}`, pct: d.female.pct_a };
    splitB = { label: `♂ ${poll.option_a}`, pct: d.male.pct_a };
  } else if (f.finding_type === 'age_gap' && d.young && d.old) {
    label = 'Age Gap';
    primary = `Gen Z ${d.young.pct_a}% • 35+ ${d.old.pct_a}%`;
    secondary = `${d.gap_pct}% difference between youngest and oldest`;
    splitA = { label: `18-24 ${poll.option_a}`, pct: d.young.pct_a };
    splitB = { label: `35+ ${poll.option_a}`, pct: d.old.pct_a };
  } else if (f.finding_type === 'city_war' && d.cairo && d.alexandria) {
    label = 'City War';
    primary = `Cairo ${d.cairo.pct_a}% • Alex ${d.alexandria.pct_a}%`;
    secondary = `Two cities, two answers`;
    splitA = { label: `Cairo ${poll.option_a}`, pct: d.cairo.pct_a };
    splitB = { label: `Alex ${poll.option_a}`, pct: d.alexandria.pct_a };
  } else if (f.finding_type === 'dominant_demo' && d.segment) {
    label = `${d.demo_label} dominates`;
    primary = `${d.segment.winner_pct}% chose ${d.segment.winner_option}`;
    secondary = `Overall: ${d.overall.pct_a}% / ${d.overall.pct_b}% — one of the strongest verdicts`;
    splitA = { label: `${d.demo_label} ${poll.option_a}`, pct: d.segment.pct_a };
    splitB = { label: `Overall ${poll.option_a}`, pct: d.overall.pct_a };
    bg = d.segment.winner_option === poll.option_a ? poll.image_a_url : poll.image_b_url;
  }

  return {
    backgroundImage: bg,
    label,
    categoryEmoji: '📊',
    headline: f.headline,
    primaryText: primary,
    secondaryText: `${secondary} • Based on ${f.total_votes.toLocaleString()} votes on Versa`,
    splitA,
    splitB,
    votePollId: poll.id,
    shareable: true,
  };
}

export default function PulseStoriesRow() {
  const { user } = useAuth();
  const { data: pulse } = useDailyPulse();
  const { data: settings } = usePulseSettings();
  const lastVisit = useLastVisit();
  const [openTopic, setOpenTopic] = useState<string | null>(null);
  const [openEditorial, setOpenEditorial] = useState<EditorialStory | null>(null);
  const [bump, setBump] = useState(0);
  const [shareFinding, setShareFinding] = useState<BreakdownFinding | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [hiddenCats, setHiddenCats] = useState(() => getHiddenCategories());
  const { data: editorialStories } = useEditorialStories();

  // All circle data
  const { data: battleData } = useBattleOfTheDay();
  const { data: updatesData } = useYourPollsUpdated();
  const { data: friendsData } = useFriendsActivity();
  const { data: categoryStories } = useCategoryStories();
  const { data: predictData } = usePredictRecap();
  const { data: closingData } = useClosingSoon();
  const { data: weeklyData } = useWeeklyVerdict();
  const { data: newPollsData } = useNewThisWeek(lastVisit);
  const { data: breakdownData } = useBreakdownFindings();

  const onFilterUpdate = useCallback(() => {
    setHiddenCats(getHiddenCategories());
    setBump((b) => b + 1);
  }, []);

  const circles: CircleSpec[] = useMemo(() => {
    if (!pulse) return [];
    const list: CircleSpec[] = [];

    // ── 1) Egypt Today (always first if has content)
    if (settings?.egypt_today_enabled !== false && (pulse.egypt_today?.length || 0) > 0) {
      const seen = hasSeenLocally('egypt_today');
      list.push({
        topic: 'egypt_today',
        label: 'Egypt Today',
        cards: pulse.egypt_today.map((c, i) =>
          pulseCardToStory(c, i === 0 ? 'Egypt Today' : 'Today in Egypt', emojiFor(c.category || ''))
        ),
        dot: seen ? null : 'blue',
        priority: 0,
        fixedPosition: 0,
      });
    }

    // ── 2) Battle of the Day (always second)
    if (battleData) {
      const { poll, tally, userVoted } = battleData;
      const pctA = tally.total ? Math.round((tally.a / tally.total) * 100) : 0;
      list.push({
        topic: 'battle',
        label: 'Battle',
        cards: [{
          backgroundImage: poll.image_a_url || poll.image_b_url,
          label: "Today's Big Debate",
          categoryEmoji: '⚔️',
          headline: poll.question,
          primaryText: `${tally.total.toLocaleString()} votes so far`,
          secondaryText: userVoted ? 'You voted ✓' : 'Cast your vote',
          splitA: { label: poll.option_a, pct: pctA },
          splitB: { label: poll.option_b, pct: 100 - pctA },
          votePollId: userVoted ? undefined : poll.id,
          shareable: true,
        }],
        dot: userVoted ? null : 'blue',
        priority: 1,
        fixedPosition: 1,
      });
    }

    // ── 3) Your Polls Updated
    if (user && updatesData && updatesData.length > 0) {
      list.push({
        topic: 'updates',
        label: 'Updates',
        cards: updatesData.map((u: any) => ({
          backgroundImage: u.user_choice === 'A' ? u.poll.image_a_url : u.poll.image_b_url,
          label: u.flipped ? 'Result flipped!' : `${u.delta > 0 ? 'Up' : 'Down'} ${Math.abs(u.delta)}% since you voted`,
          headline: u.poll.question,
          primaryText: `Your pick: ${u.user_choice === 'A' ? u.poll.option_a : u.poll.option_b}`,
          secondaryText: `Now at ${u.user_pct_now}% • ${u.total.toLocaleString()} votes`,
          splitA: {
            label: u.poll.option_a,
            pct: u.user_choice === 'A' ? u.user_pct_now : 100 - u.user_pct_now,
          },
          splitB: {
            label: u.poll.option_b,
            pct: u.user_choice === 'B' ? u.user_pct_now : 100 - u.user_pct_now,
          },
          votePollId: u.poll.id,
          shareable: true,
        })),
        dot: 'blue',
        priority: 2,
        fixedPosition: 2,
      });
    }

    // ── Closing Soon (RED dot)
    if (user && closingData && closingData.length > 0) {
      list.push({
        topic: 'closing_soon',
        label: 'Closing Soon',
        cards: closingData.map((c: any) => ({
          backgroundImage: c.poll.image_a_url || c.poll.image_b_url,
          label: '⏱ Closing Soon',
          categoryEmoji: '⏰',
          headline: c.poll.question,
          primaryText: fmtCountdown(c.ends_at),
          secondaryText: `${c.total.toLocaleString()} votes so far`,
          votePollId: c.poll.id,
          shareable: true,
        })),
        dot: 'red',
        priority: 10,
      });
    }

    // ── Cairo Now (BLUE dot)
    if (settings?.cairo_enabled !== false && (pulse.cairo?.length || 0) > 0) {
      const seen = hasSeenLocally('cairo');
      list.push({
        topic: 'cairo',
        label: 'Cairo Now',
        cards: (pulse.cairo || []).map((c) => {
          const cairoWin = (c.cairo_pct_a ?? c.pct_a) >= 50;
          const cairoPct = cairoWin ? (c.cairo_pct_a ?? c.pct_a) : (c.cairo_pct_b ?? c.pct_b);
          const natPct = cairoWin ? (c.national_pct_a ?? c.pct_a) : (c.national_pct_b ?? c.pct_b);
          const cairoChoice = cairoWin ? c.option_a : c.option_b;
          return {
            backgroundImage: cairoWin ? c.image_a_url : c.image_b_url,
            label: `Cairo chose differently — ${cairoPct}% vs national ${natPct}%`,
            categoryEmoji: '🌆',
            headline: c.question,
            primaryText: `${cairoChoice} wins in Cairo`,
            secondaryText: `${c.total_votes.toLocaleString()} total votes`,
            splitA: { label: c.option_a, pct: c.cairo_pct_a ?? c.pct_a },
            splitB: { label: c.option_b, pct: c.cairo_pct_b ?? c.pct_b },
            votePollId: c.poll_id,
            shareable: true,
          };
        }),
        dot: seen ? null : 'blue',
        priority: 20,
      });
    }

    // ── New This Week (BLUE dot)
    if (user && newPollsData && newPollsData.length >= 1) {
      list.push({
        topic: 'new_this_week',
        label: 'New',
        cards: [{
          headline: `${newPollsData.length} new battles just dropped`,
          label: 'Fresh polls',
          primaryText: 'Tap to explore',
          secondaryText: newPollsData.slice(0, 3).map((p: any) => p.question).join(' • '),
          cta: { label: 'Browse new polls', onClick: () => { window.location.href = '/explore'; } },
        }, ...newPollsData.slice(0, 5).map((p: any) => ({
          backgroundImage: p.image_a_url || p.image_b_url,
          label: 'Just dropped',
          headline: p.question,
          primaryText: `${p.option_a} vs ${p.option_b}`,
          votePollId: p.id,
          shareable: true,
        }))],
        dot: 'blue',
        priority: 30,
      });
    }

    // ── Per-Category circles (one per category with activity, filtered by user prefs)
    if (categoryStories && categoryStories.length > 0) {
      for (const cs of categoryStories) {
        if (hiddenCats.has(cs.category)) continue;
        const total = cs.tally.total;
        const pctA = total ? Math.round((cs.tally.a / total) * 100) : 50;
        const winner = pctA >= 50 ? cs.poll.option_a : cs.poll.option_b;
        const topicKey = `cat:${cs.category}`;
        list.push({
          topic: topicKey,
          label: cs.category.length > 12 ? cs.category.split(' ')[0] : cs.category,
          cards: [{
            backgroundImage: pctA >= 50 ? cs.poll.image_a_url : cs.poll.image_b_url,
            label: cs.category,
            categoryEmoji: emojiFor(cs.category),
            headline: cs.poll.question,
            primaryText: total > 0 ? `${winner} wins ${Math.max(pctA, 100 - pctA)}%` : 'Be the first to vote',
            secondaryText: total > 0 ? `${total.toLocaleString()} votes today` : '',
            splitA: { label: cs.poll.option_a, pct: pctA },
            splitB: { label: cs.poll.option_b, pct: 100 - pctA },
            votePollId: cs.poll.id,
            shareable: true,
          }],
          dot: hasSeenLocally(topicKey) ? null : 'blue',
          priority: 40,
        });
      }
    }

    // ── Predict Results (BLUE dot)
    if (predictData) {
      list.push({
        topic: 'predict',
        label: 'Predictions',
        cards: [{
          headline: `Your prediction was ${predictData.accuracy}% accurate`,
          label: 'Predict the Crowd',
          categoryEmoji: '🧠',
          primaryText: `${predictData.correct}/${predictData.total} correct`,
          secondaryText: 'Last 7 days',
          cta: { label: 'Play Predict', onClick: () => { window.location.href = '/play/predict'; } },
        }, ...predictData.samples.map((s: any) => ({
          backgroundImage: s.poll.image_a_url || s.poll.image_b_url,
          label: s.correct ? '✓ You called it' : '✗ Crowd surprised you',
          headline: s.poll.question,
          primaryText: `You predicted: ${s.predicted === 'A' ? s.poll.option_a : s.poll.option_b}`,
          secondaryText: s.actual ? `Crowd chose: ${s.actual === 'A' ? s.poll.option_a : s.poll.option_b}` : 'Pending',
          shareable: true,
        }))],
        dot: hasSeenLocally('predict') ? null : 'blue',
        priority: 50,
      });
    }

    // ── Friends Activity (GOLD dot)
    if (user && friendsData && friendsData.length > 0) {
      list.push({
        topic: 'friends',
        label: 'Friends',
        cards: friendsData.map((f: any) => {
          const choseLabel = f.choice === 'A' ? f.poll.option_a : f.poll.option_b;
          const chosenImg = f.choice === 'A' ? f.poll.image_a_url : f.poll.image_b_url;
          const otherImg  = f.choice === 'A' ? f.poll.image_b_url : f.poll.image_a_url;
          const bg = resolvePollStoryMedia(chosenImg, otherImg);
          return {
            backgroundImage: bg,
            label: `${f.friendName} just voted`,
            categoryEmoji: '👥',
            headline: f.poll.question,
            primaryText: `Chose ${choseLabel}`,
            secondaryText: 'Open poll to join in',
            votePollId: f.poll.id,
            shareable: true,
          };
        }),
        dot: 'gold',
        priority: 60,
      });
    }

    // ── Weekly Verdict (Sundays only, GOLD dot, gold border)
    if (weeklyData && weeklyData.top5.length > 0) {
      const topCards: StoryCardData[] = weeklyData.top5.map((r: any, i: number) => ({
        backgroundImage: r.pctA >= 50 ? r.poll.image_a_url : r.poll.image_b_url,
        label: `#${i + 1} biggest of the week`,
        categoryEmoji: '🏆',
        headline: r.poll.question,
        primaryText: `${r.pctA >= 50 ? r.poll.option_a : r.poll.option_b} wins ${Math.max(r.pctA, r.pctB)}%`,
        secondaryText: `${r.total.toLocaleString()} votes`,
        splitA: { label: r.poll.option_a, pct: r.pctA },
        splitB: { label: r.poll.option_b, pct: r.pctB },
        votePollId: r.poll.id,
        shareable: true,
      }));
      if (weeklyData.controversial) {
        const c = weeklyData.controversial;
        topCards.push({
          backgroundImage: c.poll.image_a_url || c.poll.image_b_url,
          label: 'Most controversial',
          categoryEmoji: '⚡',
          headline: c.poll.question,
          primaryText: `${c.pctA}% vs ${c.pctB}%`,
          secondaryText: `${c.total.toLocaleString()} votes • a true split`,
          splitA: { label: c.poll.option_a, pct: c.pctA },
          splitB: { label: c.poll.option_b, pct: c.pctB },
          votePollId: c.poll.id,
          shareable: true,
        });
      }
      list.push({
        topic: 'weekly',
        label: 'Weekly',
        cards: topCards,
        dot: 'gold',
        priority: 5,
        goldBorder: true,
      });
    }

    // ── The Breakdown (BLUE dot when has new findings)
    if (breakdownData && breakdownData.length > 0) {
      list.push({
        topic: 'breakdown',
        label: 'Breakdown',
        cards: breakdownData.map((f) => breakdownToCard(f)),
        dot: hasSeenLocally('breakdown') ? null : 'blue',
        priority: 35,
      });
    }

    // ── Morning Recap (yesterday's big result, closest battle, surprise)
    if (settings?.morning_pulse_enabled !== false && pulse.cards) {
      const recapCards: StoryCardData[] = [];
      if (pulse.cards.big_result) {
        const c = pulse.cards.big_result;
        recapCards.push({
          backgroundImage: c.winning_image,
          label: 'While you were sleeping…',
          categoryEmoji: '🌅',
          headline: c.question,
          primaryText: `${c.winning_option} wins ${c.winning_pct}%`,
          secondaryText: `${c.total_votes.toLocaleString()} votes`,
          splitA: { label: c.option_a, pct: c.pct_a },
          splitB: { label: c.option_b, pct: c.pct_b },
          votePollId: c.poll_id,
          shareable: true,
        });
      }
      if (pulse.cards.closest_battle) {
        const c = pulse.cards.closest_battle;
        recapCards.push({
          backgroundImage: c.winning_image,
          label: 'Too close to call',
          categoryEmoji: '⚖️',
          headline: c.question,
          primaryText: `${c.pct_a}% vs ${c.pct_b}%`,
          secondaryText: `${c.total_votes.toLocaleString()} votes`,
          splitA: { label: c.option_a, pct: c.pct_a },
          splitB: { label: c.option_b, pct: c.pct_b },
          votePollId: c.poll_id,
          shareable: true,
        });
      }
      if (pulse.cards.surprise) {
        const c: any = pulse.cards.surprise;
        recapCards.push({
          backgroundImage: c.winning_image,
          label: 'Nobody saw this coming',
          categoryEmoji: '😮',
          headline: c.question,
          primaryText: `Predicted ${c.predicted_a}% — got ${c.pct_a}%`,
          secondaryText: `${c.gap}% perception gap • ${c.total_votes.toLocaleString()} votes`,
          splitA: { label: c.option_a, pct: c.pct_a },
          splitB: { label: c.option_b, pct: c.pct_b },
          votePollId: c.poll_id,
          shareable: true,
        });
      }
      if (recapCards.length > 0) {
        list.push({
          topic: 'morning_recap',
          label: 'Recap',
          cards: recapCards,
          dot: hasSeenLocally('morning_recap') ? null : 'blue',
          priority: 4,
        });
      }
    }

    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulse, settings, battleData, updatesData, friendsData, categoryStories, hiddenCats, predictData, closingData, weeklyData, newPollsData, breakdownData, user, bump]);

  // Sort: fixedPosition first (egypt=0, battle=1, updates=2), then by dot priority then by priority field
  const sorted = useMemo(() => {
    const fixed = circles.filter((c) => c.fixedPosition !== undefined).sort((a, b) => a.fixedPosition! - b.fixedPosition!);
    const rest = circles.filter((c) => c.fixedPosition === undefined);
    const dotRank: Record<string, number> = { red: 0, blue: 1, gold: 2 };
    rest.sort((a, b) => {
      const aHas = a.dot ? 0 : 1;
      const bHas = b.dot ? 0 : 1;
      if (aHas !== bHas) return aHas - bHas;
      if (a.dot && b.dot && a.dot !== b.dot) return dotRank[a.dot] - dotRank[b.dot];
      return a.priority - b.priority;
    });
    return [...fixed, ...rest];
  }, [circles]);

  if (settings?.stories_row_enabled === false) return null;
  const hasEditorial = (editorialStories?.length || 0) > 0;
  if (!hasEditorial && (!pulse || sorted.length === 0)) return null;

  const activeCircle = sorted.find((c) => c.topic === openTopic);

  return (
    <>
      <div className="w-full overflow-x-auto no-scrollbar -mx-4 px-4 py-3 border-b border-border/40 bg-background">
        <div className="flex gap-3 min-w-max">
          {/* ── NEW: Editorial 5-card stories first ── */}
          {(editorialStories || []).map((story) => {
            const meta = EDITORIAL_STORY_META[story.story_type];
            if (!meta) return null;
            const seen = hasSeenLocallyKey(`editorial:${story.story_type}`);
            return (
              <button
                key={story.id}
                type="button"
                onClick={() => setOpenEditorial(story)}
                className="flex flex-col items-center gap-1.5 w-16 active:scale-95 transition-transform"
              >
                <div
                  className="w-16 h-16 rounded-full p-[2.5px] shadow-lg"
                  style={{
                    background: seen
                      ? 'hsl(var(--muted))'
                      : `linear-gradient(135deg, ${meta.color}, ${meta.color}aa, ${meta.color})`,
                  }}
                >
                  <div className="w-full h-full rounded-full bg-background flex items-center justify-center p-[3px]">
                    <div
                      className="w-full h-full rounded-full flex items-center justify-center text-2xl shadow-inner"
                      style={{ backgroundColor: meta.bgTint, color: meta.color }}
                    >
                      {meta.emoji}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-medium text-foreground/80 truncate w-full text-center">
                  {meta.label}
                </span>
              </button>
            );
          })}

          {/* ── Existing pulse circles + category circles ── */}
          {sorted.map((circle) => {
            const isCatCircle = circle.topic.startsWith('cat:');
            const catName = isCatCircle ? circle.topic.slice(4) : '';
            const catGrad = isCatCircle ? CATEGORY_GRADIENTS[catName.toLowerCase()] : null;
            const visual = isCatCircle ? null : (TOPIC_VISUALS[circle.topic] || FALLBACK_VISUAL);
            const CatIcon = isCatCircle ? getCategoryIcon(catName) : (visual?.Icon || Sparkles);
            const tileGrad = isCatCircle ? (catGrad?.tile || 'bg-gradient-to-br from-slate-500 to-slate-700') : visual!.tileGradient;
            const ringGrad = isCatCircle ? (catGrad?.ring || 'bg-gradient-to-tr from-primary via-fuchsia-500 to-amber-400') : visual!.ringGradient;
            const iconClr = 'text-white';
            const showRing = !!circle.dot;
            const dotClass =
              circle.dot === 'red' ? 'bg-red-500'
              : circle.dot === 'gold' ? 'bg-amber-400'
              : circle.dot === 'blue' ? 'bg-blue-500'
              : '';
            return (
              <button
                key={circle.topic}
                type="button"
                onClick={() => {
                  setOpenTopic(circle.topic);
                  trackStoryEvent(circle.topic);
                }}
                className="flex flex-col items-center gap-1.5 w-16 active:scale-95 transition-transform"
              >
                <div
                  className={`w-16 h-16 rounded-full p-[2px] ${
                    circle.goldBorder
                      ? 'bg-gradient-to-tr from-amber-300 via-yellow-400 to-amber-500 shadow-lg shadow-amber-500/30'
                      : showRing
                        ? `${ringGrad} shadow-lg shadow-primary/10`
                        : 'bg-muted'
                  }`}
                >
                  <div className="w-full h-full rounded-full bg-background flex items-center justify-center p-[3px]">
                    <div className={`w-full h-full rounded-full ${tileGrad} flex items-center justify-center shadow-inner relative ${!showRing ? 'opacity-70' : ''}`}>
                      {circle.topic === 'egypt_today' && pulse?.pinned_poll_id && (
                        <Pin className="absolute top-0.5 right-0.5 w-3 h-3 text-white fill-white" />
                      )}
                      <CatIcon className={`w-6 h-6 ${iconClr} drop-shadow`} strokeWidth={2.25} />
                      {circle.dot && (
                        <span className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full ${dotClass} border-2 border-background`} />
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-medium text-foreground/80 truncate w-full text-center">
                  {circle.label}
                </span>
              </button>
            );
          })}

          {/* ── Filter button at end ── */}
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            className="flex flex-col items-center gap-1.5 w-16 active:scale-95 transition-transform"
          >
            <div className="w-16 h-16 rounded-full bg-muted/60 flex items-center justify-center border border-border/50">
              <SlidersHorizontal className="w-5 h-5 text-muted-foreground" />
            </div>
            <span className="text-[10px] font-medium text-muted-foreground truncate w-full text-center">
              Filter
            </span>
          </button>
        </div>
      </div>

      <CategoryStoriesFilter
        open={filterOpen}
        onOpenChange={setFilterOpen}
        onUpdate={onFilterUpdate}
      />

      <EditorialStoryViewer
        open={!!openEditorial}
        story={openEditorial}
        onClose={() => { setOpenEditorial(null); setBump((b) => b + 1); }}
        onComplete={() => {
          const list = editorialStories || [];
          const idx = list.findIndex((s) => s.id === openEditorial?.id);
          const nextEditorial = idx >= 0 ? list[idx + 1] : undefined;
          if (nextEditorial) {
            setOpenEditorial(nextEditorial);
            return true;
          }
          // Hand off to first topic circle
          const firstTopic = sorted[0];
          if (firstTopic) {
            setOpenEditorial(null);
            setOpenTopic(firstTopic.topic);
            trackStoryEvent(firstTopic.topic);
            return true;
          }
          return false;
        }}
        onPrevious={() => {
          const list = editorialStories || [];
          const idx = list.findIndex((s) => s.id === openEditorial?.id);
          const prevEditorial = idx > 0 ? list[idx - 1] : undefined;
          if (prevEditorial) {
            setOpenEditorial(prevEditorial);
            return true;
          }
          return false;
        }}
      />

      <StoryViewer
        open={!!openTopic && !!activeCircle}
        onClose={() => { setOpenTopic(null); setBump((b) => b + 1); }}
        topic={openTopic || ''}
        cards={activeCircle?.cards || []}
        onComplete={() => {
          const idx = sorted.findIndex((c) => c.topic === openTopic);
          const nextCircle = idx >= 0 ? sorted[idx + 1] : undefined;
          if (nextCircle) {
            setOpenTopic(nextCircle.topic);
            trackStoryEvent(nextCircle.topic);
            return true;
          }
          return false;
        }}
        onPrevious={() => {
          const idx = sorted.findIndex((c) => c.topic === openTopic);
          const prevCircle = idx > 0 ? sorted[idx - 1] : undefined;
          if (prevCircle) {
            setOpenTopic(prevCircle.topic);
            trackStoryEvent(prevCircle.topic);
            return true;
          }
          // Hand off to last editorial story
          const list = editorialStories || [];
          const lastEditorial = list[list.length - 1];
          if (lastEditorial) {
            setOpenTopic(null);
            setOpenEditorial(lastEditorial);
            return true;
          }
          return false;
        }}
        onShareOverride={
          openTopic === 'breakdown' && breakdownData
            ? (cardIndex) => {
                const finding = breakdownData[cardIndex];
                if (!finding) return false;
                setShareFinding(finding);
                return true;
              }
            : undefined
        }
      />
      {shareFinding && (
        <Suspense fallback={null}>
          <BreakdownShareCard
            open={!!shareFinding}
            finding={shareFinding}
            onClose={() => setShareFinding(null)}
          />
        </Suspense>
      )}
    </>
  );
}
