import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, Trophy, Swords, Sparkles, CalendarDays } from 'lucide-react';
import { useDailyPulse, usePulseSettings } from '@/hooks/useDailyPulse';

const SESSION_KEY = 'versa_pulse_dismissed';
const FIRST_SESSION_KEY = 'versa_has_session';

type PulseItem = {
  text: string;
  onClick?: () => void;
};

type CardKey = 'winner' | 'battle' | 'surprise' | 'day';

export default function DailyPulseStrip() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [activeCard, setActiveCard] = useState<CardKey | null>(null);
  const [stats, setStats] = useState<{ voted: number; streak: number; percentile: number } | null>(null);

  const { data: pulse } = useDailyPulse();
  const { data: pulseSettings } = usePulseSettings();

  // Check if this is the user's very first session ever
  const isFirstSession = useMemo(() => {
    const has = localStorage.getItem(FIRST_SESSION_KEY);
    if (!has) {
      localStorage.setItem(FIRST_SESSION_KEY, 'true');
      return true;
    }
    return false;
  }, []);

  // Check session dismissal
  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) {
      setDismissed(true);
    }
  }, []);

  // Auto-dismiss on scroll past hero
  useEffect(() => {
    if (dismissed) return;
    const handler = () => {
      if (window.scrollY > 400) {
        setDismissed(true);
        sessionStorage.setItem(SESSION_KEY, 'true');
      }
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, [dismissed]);

  // Load "Your Day" stats when card opens
  useEffect(() => {
    if (!user || activeCard !== 'day') return;
    (async () => {
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const [{ count: voted }, { data: profile }] = await Promise.all([
        supabase.from('votes').select('*', { count: 'exact', head: true })
          .eq('user_id', user.id).gte('created_at', startOfDay.toISOString()),
        supabase.from('users').select('current_streak, points').eq('id', user.id).maybeSingle(),
      ]);
      const myPoints = (profile as any)?.points || 0;
      const { count: lessThan } = await supabase.from('users')
        .select('*', { count: 'exact', head: true }).lt('points', myPoints);
      const { count: total } = await supabase.from('users').select('*', { count: 'exact', head: true });
      const percentile = total && total > 0
        ? Math.max(1, Math.round(100 - ((lessThan || 0) / total) * 100))
        : 50;
      setStats({ voted: voted || 0, streak: (profile as any)?.current_streak || 0, percentile });
    })();
  }, [user, activeCard]);

  // New polls today
  const { data: newPollsCount } = useQuery({
    queryKey: ['pulse-new-polls-today'],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const nowIso = new Date().toISOString();
      const { count } = await supabase
        .from('polls')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .gte('created_at', since)
        .or(`expiry_type.eq.evergreen,ends_at.is.null,ends_at.gt.${nowIso}`);
      return count || 0;
    },
    staleTime: 1000 * 60 * 5,
  });

  // Most recent closed debate
  const { data: recentDebate } = useQuery({
    queryKey: ['pulse-recent-debate'],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data: closedPolls } = await supabase
        .from('polls')
        .select('id, option_a, option_b')
        .eq('is_active', true)
        .not('ends_at', 'is', null)
        .lt('ends_at', now)
        .order('ends_at', { ascending: false })
        .limit(5);

      if (!closedPolls?.length) return null;

      const ids = closedPolls.map(p => p.id);
      const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: ids });
      if (!results?.length) return null;

      for (const poll of closedPolls) {
        const r = results.find((res: any) => res.poll_id === poll.id);
        if (r && r.total_votes > 0) {
          const winnerIsA = r.votes_a >= r.votes_b;
          const winner = winnerIsA ? poll.option_a : poll.option_b;
          const loser = winnerIsA ? poll.option_b : poll.option_a;
          const pct = Math.round(((winnerIsA ? r.votes_a : r.votes_b) / r.total_votes) * 100);
          return `${winner} vs ${loser} · ${winner} won ${pct}%`;
        }
      }
      return null;
    },
    staleTime: 1000 * 60 * 5,
  });

  // Hottest poll
  const { data: hottestPoll } = useQuery({
    queryKey: ['pulse-hottest-poll'],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data: activePolls } = await supabase
        .from('polls')
        .select('id, option_a, option_b')
        .eq('is_active', true)
        .or(`ends_at.is.null,ends_at.gt.${now}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!activePolls?.length) return null;

      const ids = activePolls.map(p => p.id);
      const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: ids });
      if (!results?.length) return null;

      let closest: { text: string; margin: number } | null = null;

      for (const poll of activePolls) {
        const r = results.find((res: any) => res.poll_id === poll.id);
        if (r && r.total_votes >= 5) {
          const pctA = Math.round((r.votes_a / r.total_votes) * 100);
          const pctB = 100 - pctA;
          const margin = Math.abs(pctA - pctB);
          if (!closest || margin < closest.margin) {
            closest = {
              text: `${poll.option_a} vs ${poll.option_b} · ${pctA}% vs ${pctB}%`,
              margin,
            };
          }
        }
      }
      return closest?.text || null;
    },
    staleTime: 1000 * 60 * 5,
  });

  // Top 3 choices
  const { data: topChoices } = useQuery({
    queryKey: ['pulse-top-choices'],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data: activePolls } = await supabase
        .from('polls')
        .select('id, option_a, option_b')
        .eq('is_active', true)
        .or(`ends_at.is.null,ends_at.gt.${now}`)
        .order('created_at', { ascending: false })
        .limit(80);

      if (!activePolls?.length) return [] as string[];

      const ids = activePolls.map(p => p.id);
      const { data: results } = await supabase.rpc('get_poll_results', { poll_ids: ids });
      if (!results?.length) return [] as string[];

      const optionMap = new Map<string, number>();
      for (const poll of activePolls) {
        const r = results.find((res: any) => res.poll_id === poll.id);
        if (!r || r.total_votes === 0) continue;
        optionMap.set(poll.option_a, (optionMap.get(poll.option_a) || 0) + r.votes_a);
        optionMap.set(poll.option_b, (optionMap.get(poll.option_b) || 0) + r.votes_b);
      }

      return Array.from(optionMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name);
    },
    staleTime: 1000 * 60 * 5,
  });

  // Build text items
  const items = useMemo<PulseItem[]>(() => {
    const list: PulseItem[] = [];
    if (topChoices && topChoices.length > 0) {
      list.push({
        text: `🔥 Top now: ${topChoices.join(' · ')}`,
        onClick: () => navigate(`/explore?search=${encodeURIComponent(topChoices[0])}`),
      });
    }
    if (newPollsCount && newPollsCount > 0) {
      list.push({ text: `${newPollsCount} new poll${newPollsCount !== 1 ? 's' : ''} today` });
    }
    if (recentDebate) list.push({ text: recentDebate });
    if (hottestPoll) list.push({ text: hottestPoll });
    return list.slice(0, 4);
  }, [topChoices, newPollsCount, recentDebate, hottestPoll, navigate]);

  // Verdict story circle availability
  const verdictEnabled = pulseSettings?.evening_verdict_enabled !== false;
  const winner = pulse?.cards?.big_result;
  const battle = pulse?.cards?.closest_battle;
  const surprise = pulse?.cards?.surprise;
  const verdictItems = useMemo(() => {
    const arr: Array<{ key: CardKey; label: string; icon: React.ReactNode; bg?: string | null; tone: string }> = [];
    if (winner) arr.push({ key: 'winner', label: 'Winner', icon: <Trophy className="w-4 h-4" />, bg: winner.winning_image, tone: 'from-amber-400 to-orange-500' });
    if (battle) arr.push({ key: 'battle', label: 'Battle', icon: <Swords className="w-4 h-4" />, bg: battle.winning_image, tone: 'from-red-400 to-pink-500' });
    if (surprise) arr.push({ key: 'surprise', label: 'Surprise', icon: <Sparkles className="w-4 h-4" />, bg: surprise.winning_image, tone: 'from-purple-400 to-fuchsia-500' });
    if (user) arr.push({ key: 'day', label: 'Your Day', icon: <CalendarDays className="w-4 h-4" />, tone: 'from-emerald-400 to-teal-500' });
    return arr;
  }, [winner, battle, surprise, user]);
  const showVerdictCircle = verdictEnabled && verdictItems.length > 0;

  // Don't render if first session, dismissed, or no items at all
  if (isFirstSession || dismissed || (items.length === 0 && !showVerdictCircle)) return null;

  return (
    <div className="px-3 mb-1">
      <div className="flex items-center gap-2 bg-card rounded-full px-2 py-1.5 h-12 border border-border/40 overflow-hidden">
        {/* Verdict story circle (single, multi-tone ring) */}
        {showVerdictCircle && (
          <button
            onClick={() => setActiveCard(verdictItems[0].key)}
            className="flex-shrink-0 active:scale-95 transition-transform"
            aria-label="Today's Verdict"
          >
            <div className="relative w-9 h-9 rounded-full p-[2px] bg-gradient-to-tr from-amber-400 via-pink-500 to-fuchsia-500">
              <div className="w-full h-full rounded-full overflow-hidden bg-background flex items-center justify-center border-2 border-background">
                {verdictItems[0].bg ? (
                  <img src={verdictItems[0].bg} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Trophy className="w-4 h-4 text-foreground/70" />
                )}
              </div>
            </div>
          </button>
        )}

        {/* Pulsing red dot (only when no verdict circle takes the lead spot) */}
        {!showVerdictCircle && (
          <span className="relative flex-shrink-0 h-2 w-2 ml-1">
            <span className="absolute inset-0 rounded-full bg-[#E8392A] animate-[pulse-dot_2s_ease-in-out_infinite]" />
            <span className="absolute inset-0 rounded-full bg-[#E8392A]" />
          </span>
        )}

        {/* Scrollable items */}
        <div className="flex-1 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-0 whitespace-nowrap">
            {items.map((item, i) => (
              <span key={i} className="text-xs text-muted-foreground">
                {i > 0 && <span className="mx-1.5 text-muted-foreground/50">·</span>}
                {item.onClick ? (
                  <button
                    onClick={item.onClick}
                    className="text-foreground font-semibold hover:text-[#E8392A] transition-colors"
                  >
                    {item.text}
                  </button>
                ) : (
                  item.text
                )}
              </span>
            ))}
          </div>
        </div>

        {/* See all link */}
        <button
          onClick={() => navigate('/explore')}
          className="flex-shrink-0 text-[11px] font-semibold text-[#E8392A] hover:text-[#E8392A]/80 transition-colors pr-1"
        >
          see all
        </button>
      </div>

      {/* Verdict bottom sheet */}
      <AnimatePresence>
        {activeCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/80 flex items-end sm:items-center justify-center"
            onClick={() => setActiveCard(null)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-background text-foreground rounded-t-3xl sm:rounded-3xl p-5 pb-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Today's Verdict</p>
                <button
                  onClick={() => setActiveCard(null)}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tabs to switch cards */}
              <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
                {verdictItems.map((it) => (
                  <button
                    key={it.key}
                    onClick={() => setActiveCard(it.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                      activeCard === it.key ? 'bg-foreground text-background' : 'bg-muted text-foreground/70'
                    }`}
                  >
                    {it.icon}
                    {it.label}
                  </button>
                ))}
              </div>

              {activeCard === 'winner' && winner && (
                <CardBlock
                  icon={<Trophy className="w-4 h-4" />}
                  title="The Winner"
                  subtitle="Most lopsided result today"
                  bg={winner.winning_image}
                  question={winner.question}
                  primary={`${winner.winning_option} — ${winner.winning_pct}%`}
                  meta={`${winner.total_votes.toLocaleString()} votes`}
                />
              )}

              {activeCard === 'battle' && battle && (
                <CardBlock
                  icon={<Swords className="w-4 h-4" />}
                  title="The Battle"
                  subtitle="Most controversial poll"
                  bg={battle.winning_image}
                  question={battle.question}
                  primary={`${battle.pct_a}% vs ${battle.pct_b}%`}
                  meta={`${battle.option_a} vs ${battle.option_b} • ${battle.total_votes.toLocaleString()} votes`}
                />
              )}

              {activeCard === 'surprise' && surprise && (
                <CardBlock
                  icon={<Sparkles className="w-4 h-4" />}
                  title="The Surprise"
                  subtitle="Biggest perception gap"
                  bg={surprise.winning_image}
                  question={surprise.question}
                  primary={`Predicted ${surprise.predicted_a}% — got ${surprise.pct_a}%`}
                  meta={`${surprise.gap}% gap`}
                />
              )}

              {activeCard === 'day' && user && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <CalendarDays className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider">Your Day</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">How you voted today</p>
                  <div className="rounded-2xl bg-muted p-4">
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="text-3xl font-extrabold">{stats?.voted ?? '—'}</span>
                      <span className="text-xs text-muted-foreground">polls voted today</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>{(stats?.streak ?? 0) > 0 ? `🔥 ${stats?.streak}-day streak` : 'Start a streak'}</span>
                      <span className="text-muted-foreground">Top {stats?.percentile ?? '—'}%</span>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => { setActiveCard(null); navigate('/home'); }}
                className="mt-5 w-full h-11 rounded-full bg-foreground text-background font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                Vote on what you missed
                <ChevronRight className="w-4 h-4" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}

function CardBlock({ icon, title, subtitle, bg, question, primary, meta }: {
  icon: React.ReactNode; title: string; subtitle: string;
  bg?: string | null; question: string; primary: string; meta: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="text-sm font-semibold uppercase tracking-wider">{title}</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-3">{subtitle}</p>
      <div className="relative rounded-2xl overflow-hidden h-44">
        {bg ? <img src={bg} alt="" className="absolute inset-0 w-full h-full object-cover" /> : <div className="absolute inset-0 bg-gradient-to-br from-primary/40 to-black" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-3 text-white">
          <p className="text-xs text-white/70 line-clamp-1">{question}</p>
          <p className="text-lg font-bold leading-tight mt-0.5">{primary}</p>
          <p className="text-xs text-white/70 mt-0.5">{meta}</p>
        </div>
      </div>
    </div>
  );
}
