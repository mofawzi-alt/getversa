import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, Trophy, Swords, Sparkles, CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDailyPulse, usePulseSettings } from '@/hooks/useDailyPulse';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { isInEveningWindow, hasSeenLocally, markSeenLocally } from '@/lib/pulseTime';
import { trackStoryEvent } from '@/lib/storyAnalytics';

const TOPIC = 'evening_verdict';

type CardKey = 'winner' | 'battle' | 'surprise' | 'day';

export default function EveningVerdictTrigger() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: pulse } = useDailyPulse();
  const { data: settings } = usePulseSettings();
  const [activeCard, setActiveCard] = useState<CardKey | null>(null);
  const [stats, setStats] = useState<{ voted: number; streak: number; percentile: number } | null>(null);

  // Mark as seen the first time the strip is shown in the evening window
  useEffect(() => {
    if (!pulse) return;
    if (settings?.evening_verdict_enabled === false) return;
    if (!isInEveningWindow()) return;
    if (hasSeenLocally(TOPIC)) return;
    markSeenLocally(TOPIC);
    trackStoryEvent(TOPIC, 'cards_viewed');
  }, [pulse, settings]);

  useEffect(() => {
    if (!user || !activeCard) return;
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

  const date = useMemo(() => new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }), []);

  if (!pulse) return null;
  if (settings?.evening_verdict_enabled === false) return null;

  const winner = pulse.cards.big_result;
  const battle = pulse.cards.closest_battle;
  const surprise = pulse.cards.surprise;

  const items: Array<{ key: CardKey; label: string; icon: React.ReactNode; bg?: string | null; tone: string }> = [];
  if (winner) items.push({ key: 'winner', label: 'Winner', icon: <Trophy className="w-4 h-4" />, bg: winner.winning_image, tone: 'from-amber-400 to-orange-500' });
  if (battle) items.push({ key: 'battle', label: 'Battle', icon: <Swords className="w-4 h-4" />, bg: battle.winning_image, tone: 'from-red-400 to-pink-500' });
  if (surprise) items.push({ key: 'surprise', label: 'Surprise', icon: <Sparkles className="w-4 h-4" />, bg: surprise.winning_image, tone: 'from-purple-400 to-fuchsia-500' });
  if (user) items.push({ key: 'day', label: 'Your Day', icon: <CalendarDays className="w-4 h-4" />, tone: 'from-emerald-400 to-teal-500' });

  if (items.length === 0) return null;

  function handleOpen(key: CardKey) {
    setActiveCard(key);
    trackStoryEvent(TOPIC, 'vote_taps');
  }

  function handleCta() {
    setActiveCard(null);
    navigate('/home');
  }

  return (
    <>
      {/* Compact strip — sits inline on Home */}
      <div className="px-1 mb-3">
        <div className="flex items-center gap-1.5 mb-2 px-1">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Today's Verdict</span>
          <span className="text-[10px] text-muted-foreground/70">· {date}</span>
        </div>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 px-1">
          {items.map((item) => (
            <button
              key={item.key}
              onClick={() => handleOpen(item.key)}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 active:scale-95 transition-transform"
            >
              <div className={`relative w-16 h-16 rounded-full p-[2px] bg-gradient-to-br ${item.tone}`}>
                <div className="w-full h-full rounded-full overflow-hidden bg-background flex items-center justify-center border-2 border-background">
                  {item.bg ? (
                    <img src={item.bg} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-foreground/70">
                      {item.icon}
                    </div>
                  )}
                </div>
              </div>
              <span className="text-[10px] font-medium text-foreground/80 max-w-[72px] truncate">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom-sheet card opened on tap */}
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
                onClick={handleCta}
                className="mt-5 w-full h-11 rounded-full bg-foreground text-background font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                Vote on what you missed
                <ChevronRight className="w-4 h-4" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
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
