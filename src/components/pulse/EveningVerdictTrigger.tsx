import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, Trophy, Swords, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDailyPulse, usePulseSettings } from '@/hooks/useDailyPulse';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { isInEveningWindow, hasSeenLocally, markSeenLocally } from '@/lib/pulseTime';
import { trackStoryEvent } from '@/lib/storyAnalytics';

const TOPIC = 'evening_verdict';

export default function EveningVerdictTrigger() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: pulse } = useDailyPulse();
  const { data: settings } = usePulseSettings();
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<{ voted: number; streak: number; percentile: number } | null>(null);

  useEffect(() => {
    if (!pulse) return;
    if (settings?.evening_verdict_enabled === false) return;
    if (!isInEveningWindow()) return;
    if (hasSeenLocally(TOPIC)) return;
    const t = setTimeout(() => { setOpen(true); trackStoryEvent(TOPIC, 'cards_viewed'); }, 900);
    return () => clearTimeout(t);
  }, [pulse, settings]);

  useEffect(() => {
    if (!user || !open) return;
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
  }, [user, open]);

  const date = useMemo(() => new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }), []);

  function handleClose() {
    markSeenLocally(TOPIC);
    trackStoryEvent(TOPIC, null, { completed: true });
    setOpen(false);
  }

  function handleCta() {
    trackStoryEvent(TOPIC, 'vote_taps');
    handleClose();
    navigate('/home');
  }

  if (!open || !pulse) return null;

  const winner = pulse.cards.big_result;
  const battle = pulse.cards.closest_battle;
  const surprise = pulse.cards.surprise;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] bg-black/95 overflow-y-auto"
      >
        <div className="min-h-full px-5 py-6 max-w-md mx-auto text-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-white/60">Today's Verdict</p>
              <h1 className="text-2xl font-extrabold">{date}</h1>
            </div>
            <button
              onClick={handleClose}
              className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {winner && (
            <Section icon={<Trophy className="w-4 h-4" />} title="The Winner" subtitle="Most lopsided result today">
              <ResultCard
                bg={winner.winning_image}
                question={winner.question}
                primary={`${winner.winning_option} — ${winner.winning_pct}%`}
                meta={`${winner.total_votes.toLocaleString()} votes`}
              />
            </Section>
          )}

          {battle && (
            <Section icon={<Swords className="w-4 h-4" />} title="The Battle" subtitle="Most controversial poll">
              <ResultCard
                bg={battle.winning_image}
                question={battle.question}
                primary={`${battle.pct_a}% vs ${battle.pct_b}%`}
                meta={`${battle.option_a} vs ${battle.option_b} • ${battle.total_votes.toLocaleString()} votes`}
              />
            </Section>
          )}

          {surprise && (
            <Section icon={<Sparkles className="w-4 h-4" />} title="The Surprise" subtitle="Biggest perception gap">
              <ResultCard
                bg={surprise.winning_image}
                question={surprise.question}
                primary={`Predicted ${surprise.predicted_a}% — got ${surprise.pct_a}%`}
                meta={`${surprise.gap}% gap`}
              />
            </Section>
          )}

          {user && stats && (
            <Section title="Your Day">
              <div className="rounded-2xl bg-white/10 p-4">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-3xl font-extrabold">{stats.voted}</span>
                  <span className="text-xs text-white/70">polls voted today</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>{stats.streak > 0 ? `🔥 ${stats.streak}-day streak` : 'Start a streak'}</span>
                  <span>Top {stats.percentile}%</span>
                </div>
              </div>
            </Section>
          )}

          <button
            type="button"
            onClick={handleCta}
            className="mt-6 w-full h-12 rounded-full bg-white text-black font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            Vote on what you missed
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="h-10" />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function Section({ icon, title, subtitle, children }: { icon?: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2">
        {icon && <span className="text-white/80">{icon}</span>}
        <h3 className="text-sm font-semibold uppercase tracking-wider text-white/80">{title}</h3>
      </div>
      {subtitle && <p className="text-xs text-white/60 mb-2">{subtitle}</p>}
      {children}
    </div>
  );
}

function ResultCard({ bg, question, primary, meta }: { bg?: string | null; question: string; primary: string; meta: string }) {
  return (
    <div className="relative rounded-2xl overflow-hidden h-40">
      {bg ? <img src={bg} alt="" className="absolute inset-0 w-full h-full object-cover" /> : <div className="absolute inset-0 bg-gradient-to-br from-primary/40 to-black" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-3">
        <p className="text-xs text-white/70 line-clamp-1">{question}</p>
        <p className="text-lg font-bold leading-tight mt-0.5">{primary}</p>
        <p className="text-xs text-white/70 mt-0.5">{meta}</p>
      </div>
    </div>
  );
}
