import { useEffect, useMemo, useState } from 'react';
import { useDailyPulse, usePulseSettings } from '@/hooks/useDailyPulse';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import StoryViewer, { type StoryCardData } from './StoryViewer';
import { isInMorningWindow, hasSeenLocally, markSeenLocally } from '@/lib/pulseTime';
import { useNavigate } from 'react-router-dom';

const TOPIC = 'morning_pulse';

export default function MorningPulseTrigger() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: pulse } = useDailyPulse();
  const { data: settings } = usePulseSettings();
  const [open, setOpen] = useState(false);
  const [yourStanding, setYourStanding] = useState<{ votedYesterday: number; streak: number; percentile: number } | null>(null);

  // Decide whether to auto-open
  useEffect(() => {
    if (!pulse) return;
    if (settings?.morning_pulse_enabled === false) return;
    if (!isInMorningWindow()) return;
    if (hasSeenLocally(TOPIC)) return;
    // Slight delay so app finishes initial render
    const t = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(t);
  }, [pulse, settings]);

  // Compute "Your Standing" card stats when authenticated
  useEffect(() => {
    if (!user || !open) return;
    (async () => {
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const endYesterday = new Date(yesterday); endYesterday.setHours(23, 59, 59, 999);
      const [{ count: votedYesterday }, { data: profile }] = await Promise.all([
        supabase.from('votes').select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', yesterday.toISOString())
          .lte('created_at', endYesterday.toISOString()),
        supabase.from('users').select('current_streak, points').eq('id', user.id).maybeSingle(),
      ]);
      // Rough percentile: % of users with fewer points
      const myPoints = (profile as any)?.points || 0;
      const { count: lessThan } = await supabase.from('users')
        .select('*', { count: 'exact', head: true })
        .lt('points', myPoints);
      const { count: total } = await supabase.from('users').select('*', { count: 'exact', head: true });
      const percentile = total && total > 0 ? Math.max(1, Math.round(100 - ((lessThan || 0) / total) * 100)) : 50;
      setYourStanding({
        votedYesterday: votedYesterday || 0,
        streak: (profile as any)?.current_streak || 0,
        percentile,
      });
    })();
  }, [user, open]);

  const cards: StoryCardData[] = useMemo(() => {
    if (!pulse) return [];
    const list: StoryCardData[] = [];

    // Card 1 — The Big Result
    if (pulse.cards.big_result) {
      const c = pulse.cards.big_result;
      list.push({
        backgroundImage: c.winning_image,
        label: 'While you were sleeping…',
        headline: c.question,
        primaryText: `${c.winning_option} wins ${c.winning_pct}%`,
        secondaryText: `${c.total_votes.toLocaleString()} votes`,
        splitA: { label: c.option_a, pct: c.pct_a },
        splitB: { label: c.option_b, pct: c.pct_b },
        votePollId: c.poll_id,
      });
    }

    // Card 2 — The Closest Battle
    if (pulse.cards.closest_battle) {
      const c = pulse.cards.closest_battle;
      list.push({
        backgroundImage: c.winning_image,
        label: 'Too close to call',
        headline: c.question,
        primaryText: `${c.pct_a}% vs ${c.pct_b}%`,
        secondaryText: `${c.total_votes.toLocaleString()} votes`,
        splitA: { label: c.option_a, pct: c.pct_a },
        splitB: { label: c.option_b, pct: c.pct_b },
        votePollId: c.poll_id,
      });
    }

    // Card 3 — The Surprise (skip if missing)
    if (pulse.cards.surprise) {
      const c = pulse.cards.surprise;
      list.push({
        backgroundImage: c.winning_image,
        label: 'Nobody saw this coming',
        headline: c.question,
        primaryText: `Predicted ${c.predicted_a}% — got ${c.pct_a}%`,
        secondaryText: `${c.gap}% perception gap • ${c.total_votes.toLocaleString()} votes`,
        splitA: { label: c.option_a, pct: c.pct_a },
        splitB: { label: c.option_b, pct: c.pct_b },
        votePollId: c.poll_id,
      });
    }

    // Card 4 — Your Standing (signed-in only)
    if (user && yourStanding) {
      list.push({
        label: 'Your standing',
        headline: `You voted on ${yourStanding.votedYesterday} polls yesterday`,
        primaryText: `Top ${yourStanding.percentile}% of Versa users`,
        secondaryText: yourStanding.streak > 0 ? `🔥 ${yourStanding.streak}-day streak` : undefined,
        shareable: true,
      });
    }

    // Card 5 — Today's First Battle
    if (pulse.cards.today_first) {
      const tf = pulse.cards.today_first;
      list.push({
        backgroundImage: tf.image_a_url || tf.image_b_url,
        label: "Today's first battle",
        headline: tf.question,
        primaryText: `${tf.option_a}  vs  ${tf.option_b}`,
        secondaryText: 'Be the first to vote',
        cta: {
          label: 'Vote Now →',
          onClick: () => {
            markSeenLocally(TOPIC);
            setOpen(false);
            navigate('/home');
          },
        },
      });
    }

    return list;
  }, [pulse, user, yourStanding, navigate]);

  if (!open || cards.length === 0) return null;

  return (
    <StoryViewer
      open={open}
      onClose={() => { markSeenLocally(TOPIC); setOpen(false); }}
      topic={TOPIC}
      cards={cards}
      autoAdvanceMs={6000}
    />
  );
}
