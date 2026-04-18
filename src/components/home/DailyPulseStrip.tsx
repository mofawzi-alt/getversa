import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const SESSION_KEY = 'versa_pulse_dismissed';
const FIRST_SESSION_KEY = 'versa_has_session';

type PulseItem = {
  text: string;
  onClick?: () => void;
};

export default function DailyPulseStrip() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  const isFirstSession = useMemo(() => {
    const has = localStorage.getItem(FIRST_SESSION_KEY);
    if (!has) {
      localStorage.setItem(FIRST_SESSION_KEY, 'true');
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) setDismissed(true);
  }, []);

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
            closest = { text: `${poll.option_a} vs ${poll.option_b} · ${pctA}% vs ${pctB}%`, margin };
          }
        }
      }
      return closest?.text || null;
    },
    staleTime: 1000 * 60 * 5,
  });

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

  if (isFirstSession || dismissed || items.length === 0) return null;

  return (
    <div className="px-3 mb-1">
      <div className="flex items-center gap-2 bg-card rounded-full px-3 py-2 h-10 border border-border/40 overflow-hidden">
        <span className="relative flex-shrink-0 h-2 w-2">
          <span className="absolute inset-0 rounded-full bg-[#E8392A] animate-[pulse-dot_2s_ease-in-out_infinite]" />
          <span className="absolute inset-0 rounded-full bg-[#E8392A]" />
        </span>
        <div className="flex-1 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-0 whitespace-nowrap">
            {items.map((item, i) => (
              <span key={i} className="text-xs text-muted-foreground">
                {i > 0 && <span className="mx-1.5 text-muted-foreground/50">·</span>}
                {item.onClick ? (
                  <button onClick={item.onClick} className="text-foreground font-semibold hover:text-[#E8392A] transition-colors">
                    {item.text}
                  </button>
                ) : (
                  item.text
                )}
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={() => navigate('/explore')}
          className="flex-shrink-0 text-[11px] font-semibold text-[#E8392A] hover:text-[#E8392A]/80 transition-colors"
        >
          see all
        </button>
      </div>
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
