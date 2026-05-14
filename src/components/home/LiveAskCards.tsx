import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ActiveAsk {
  id: string;
  photo_url: string;
  question: string;
  vote_count: number;
  asker_id: string;
  reveal_at: string;
  target_gender: string | null;
  target_age_ranges: string[] | null;
  target_cities: string[] | null;
  target_countries: string[] | null;
}

interface ViewerProfile {
  gender: string | null;
  age_range: string | null;
  city: string | null;
  city_of_residence: string | null;
  country: string | null;
  nationality: string | null;
}

const norm = (value: string | null | undefined) => value?.trim().toLowerCase() ?? '';

function matches(ask: ActiveAsk, viewer: ViewerProfile | null): boolean {
  if (ask.target_gender && norm(viewer?.gender) !== norm(ask.target_gender)) return false;
  if (ask.target_age_ranges?.length && (!viewer?.age_range || !ask.target_age_ranges.map(norm).includes(norm(viewer.age_range)))) return false;
  if (ask.target_cities?.length) {
    const cities = [viewer?.city, viewer?.city_of_residence].map(norm).filter(Boolean);
    const targets = ask.target_cities.map(norm);
    if (!cities.some((c) => targets.includes(c))) return false;
  }
  if (ask.target_countries?.length) {
    const countries = [viewer?.country, viewer?.nationality].map(norm).filter(Boolean);
    const targets = ask.target_countries.map(norm);
    if (!countries.some((c) => targets.includes(c))) return false;
  }
  return true;
}

export default function LiveAskCards() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [asks, setAsks] = useState<ActiveAsk[]>([]);
  const [viewer, setViewer] = useState<ViewerProfile | null>(null);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('live_asks')
      .select('id,photo_url,question,vote_count,asker_id,reveal_at,target_gender,target_age_ranges,target_cities,target_countries')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(30);

    const filtered = (data ?? [])
      .filter((a: any) => !user || a.asker_id !== user.id)
      .filter((a: any) => new Date(a.reveal_at).getTime() > Date.now())
      .filter((a: any) => matches(a as ActiveAsk, viewer));
    setAsks(filtered as ActiveAsk[]);

    if (user && filtered.length) {
      const { data: votes } = await supabase
        .from('live_ask_votes')
        .select('live_ask_id')
        .eq('user_id', user.id)
        .in('live_ask_id', filtered.map((a: any) => a.id));
      setVotedIds(new Set((votes ?? []).map((v: any) => v.live_ask_id)));
    } else {
      setVotedIds(new Set());
    }
  }, [user?.id, viewer]);

  useEffect(() => {
    if (!user) { setViewer(null); return; }
    supabase
      .from('users')
      .select('gender,age_range,city,city_of_residence,country,nationality')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => setViewer((data as any) ?? null));
  }, [user?.id]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from('live_asks')
        .select('id,photo_url,question,vote_count,asker_id,reveal_at,target_gender,target_age_ranges,target_cities,target_countries')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(30);
      if (!mounted) return;
      const filtered = (data ?? [])
        .filter((a: any) => !user || a.asker_id !== user.id)
        .filter((a: any) => new Date(a.reveal_at).getTime() > Date.now())
        .filter((a: any) => matches(a as ActiveAsk, viewer));
      setAsks(filtered as ActiveAsk[]);

      if (user && filtered.length) {
        const { data: votes } = await supabase
          .from('live_ask_votes')
          .select('live_ask_id')
          .eq('user_id', user.id)
          .in('live_ask_id', filtered.map((a: any) => a.id));
        if (mounted) setVotedIds(new Set((votes ?? []).map((v: any) => v.live_ask_id)));
      }
    };
    load();
    const ch = supabase
      .channel('live-asks-cards')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_asks' }, load)
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [user?.id, viewer]);

  if (asks.length === 0) return null;

  // Queue: unvoted first (freshest first), then voted ones
  const unvoted = asks.filter((a) => !votedIds.has(a.id));
  const voted = asks.filter((a) => votedIds.has(a.id));
  const queue = [...unvoted, ...voted];
  const next = queue[0];
  const isVoted = votedIds.has(next.id);
  const totalNew = unvoted.length;
  const showCounter = asks.length > 1;

  return (
    <button
      onClick={() => nav(`/live-ask/${next.id}`)}
      className="mx-4 mt-3 mb-1 w-[calc(100%-2rem)] flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#E8392A]/10 border border-[#E8392A]/30 active:scale-[0.98] transition-transform"
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E8392A] opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E8392A]" />
      </span>
      <span className="text-[13px] font-bold text-[#E8392A] shrink-0">
        {isVoted
          ? `${asks.length} Live Ask${asks.length === 1 ? '' : 's'}`
          : `${totalNew} new Live Ask${totalNew === 1 ? '' : 's'}`}
      </span>
      {showCounter && (
        <span className="text-[10px] font-semibold text-[#E8392A]/80 bg-[#E8392A]/15 px-1.5 py-0.5 rounded-full shrink-0">
          1/{asks.length}
        </span>
      )}
      <span className="text-[12px] text-foreground/70 truncate flex-1 text-left">
        · {next.question}
      </span>
      <span className="text-[11px] font-semibold text-[#E8392A] shrink-0">
        {isVoted ? 'View →' : 'Vote →'}
      </span>
    </button>
  );
}
