import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ActiveAsk {
  id: string;
  photo_url: string;
  question: string;
  option_a: string;
  option_b: string;
  vote_count: number;
  votes_a: number;
  votes_b: number;
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

function matches(ask: ActiveAsk, viewer: ViewerProfile | null): boolean {
  if (ask.target_gender && viewer?.gender !== ask.target_gender) return false;
  if (ask.target_age_ranges?.length && (!viewer?.age_range || !ask.target_age_ranges.includes(viewer.age_range))) return false;
  if (ask.target_cities?.length) {
    const cities = [viewer?.city, viewer?.city_of_residence].filter(Boolean) as string[];
    if (!cities.some((c) => ask.target_cities!.includes(c))) return false;
  }
  if (ask.target_countries?.length) {
    const countries = [viewer?.country, viewer?.nationality].filter(Boolean) as string[];
    if (!countries.some((c) => ask.target_countries!.includes(c))) return false;
  }
  return true;
}

export default function LiveAskCards() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [asks, setAsks] = useState<ActiveAsk[]>([]);
  const [viewer, setViewer] = useState<ViewerProfile | null>(null);
  const [votedMap, setVotedMap] = useState<Record<string, 'A' | 'B'>>({});

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
        .select('id,photo_url,question,option_a,option_b,vote_count,votes_a,votes_b,asker_id,reveal_at,target_gender,target_age_ranges,target_cities,target_countries')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(30);
      if (!mounted) return;
      const filtered = (data ?? [])
        .filter((a: any) => !user || a.asker_id !== user.id)
        .filter((a: any) => matches(a as ActiveAsk, viewer));
      setAsks(filtered as ActiveAsk[]);

      if (user && filtered.length) {
        const { data: votes } = await supabase
          .from('live_ask_votes')
          .select('live_ask_id,choice')
          .eq('user_id', user.id)
          .in('live_ask_id', filtered.map((a: any) => a.id));
        const map: Record<string, 'A' | 'B'> = {};
        (votes ?? []).forEach((v: any) => { map[v.live_ask_id] = v.choice; });
        if (mounted) setVotedMap(map);
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

  return (
    <div className="px-4 mt-3 space-y-3">
      {asks.map((a) => {
        const myChoice = votedMap[a.id];
        const voted = !!myChoice;
        const pctA = a.vote_count > 0 ? Math.round((a.votes_a / a.vote_count) * 100) : 0;
        const pctB = a.vote_count > 0 ? 100 - pctA : 0;

        return (
          <button
            key={a.id}
            onClick={() => nav(`/live-ask/${a.id}`)}
            className="w-full block text-left rounded-2xl overflow-hidden border border-border/50 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)] active:scale-[0.99] transition-transform"
          >
            <div className="relative">
              <img
                src={a.photo_url}
                alt=""
                className="w-full aspect-[4/3] object-cover bg-muted"
                loading="lazy"
              />
              <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/95 backdrop-blur-sm">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E8392A] opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#E8392A]" />
                </span>
                <span className="text-[10px] font-bold text-[#E8392A] tracking-wide">LIVE ASK</span>
              </div>
              {voted && (
                <div className="absolute top-2 right-2 px-2 py-1 rounded-full bg-black/70 backdrop-blur-sm">
                  <span className="text-[10px] font-bold text-white tracking-wide">YOU VOTED</span>
                </div>
              )}
            </div>

            <div className="p-3">
              <h3 className="text-[15px] font-semibold leading-tight line-clamp-2">{a.question}</h3>

              {voted ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <ResultPill label={a.option_a} pct={pctA} mine={myChoice === 'A'} />
                  <ResultPill label={a.option_b} pct={pctB} mine={myChoice === 'B'} />
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="h-9 rounded-xl border border-border/60 flex items-center justify-center text-[13px] font-semibold text-foreground/80">
                    {a.option_a}
                  </div>
                  <div className="h-9 rounded-xl border border-border/60 flex items-center justify-center text-[13px] font-semibold text-foreground/80">
                    {a.option_b}
                  </div>
                </div>
              )}

              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px] text-foreground/60">
                  {a.vote_count} {a.vote_count === 1 ? 'vote' : 'votes'}
                </span>
                <span className="text-[11px] font-bold text-[#E8392A]">
                  {voted ? 'View →' : 'Tap to vote →'}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ResultPill({ label, pct, mine }: { label: string; pct: number; mine: boolean }) {
  return (
    <div className={`relative h-9 rounded-xl overflow-hidden border ${mine ? 'border-[#E8392A]' : 'border-border/60'}`}>
      <div
        className={`absolute inset-y-0 left-0 ${mine ? 'bg-[#E8392A]/15' : 'bg-neutral-100'}`}
        style={{ width: `${pct}%` }}
      />
      <div className="relative flex items-center justify-between h-full px-3">
        <span className={`text-[12px] font-semibold truncate ${mine ? 'text-[#E8392A]' : 'text-foreground/80'}`}>
          {label}
        </span>
        <span className={`text-[13px] font-bold tabular-nums ${mine ? 'text-[#E8392A]' : 'text-foreground/80'}`}>
          {pct}%
        </span>
      </div>
    </div>
  );
}
