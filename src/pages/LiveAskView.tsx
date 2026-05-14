import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Loader2, Home, Flag } from "lucide-react";

interface LiveAsk {
  id: string;
  asker_id: string;
  photo_url: string;
  question: string;
  option_a: string;
  option_b: string;
  target_gender: string | null;
  target_age_ranges: string[] | null;
  target_cities: string[] | null;
  target_countries: string[] | null;
  status: string;
  vote_count: number;
  votes_a: number;
  votes_b: number;
  reveal_at: string;
  created_at: string;
}

interface ViewerProfile {
  gender: string | null;
  age_range: string | null;
  city: string | null;
  city_of_residence: string | null;
  country: string | null;
  nationality: string | null;
}

const norm = (v: string | null | undefined) => v?.trim().toLowerCase() ?? "";
function matches(ask: LiveAsk, viewer: ViewerProfile | null): boolean {
  if (ask.target_gender && norm(viewer?.gender) !== norm(ask.target_gender)) return false;
  if (ask.target_age_ranges?.length && (!viewer?.age_range || !ask.target_age_ranges.map(norm).includes(norm(viewer.age_range)))) return false;
  if (ask.target_cities?.length) {
    const cities = [viewer?.city, viewer?.city_of_residence].map(norm).filter(Boolean);
    if (!cities.some((c) => ask.target_cities!.map(norm).includes(c))) return false;
  }
  if (ask.target_countries?.length) {
    const countries = [viewer?.country, viewer?.nationality].map(norm).filter(Boolean);
    if (!countries.some((c) => ask.target_countries!.map(norm).includes(c))) return false;
  }
  return true;
}

export default function LiveAskView() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [asks, setAsks] = useState<LiveAsk[]>([]);
  const [loading, setLoading] = useState(true);
  const [votes, setVotes] = useState<Record<string, "A" | "B">>({});
  const [viewer, setViewer] = useState<ViewerProfile | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const initialScrolledRef = useRef(false);

  // Load viewer profile
  useEffect(() => {
    if (!user) { setViewer(null); return; }
    supabase
      .from("users")
      .select("gender,age_range,city,city_of_residence,country,nationality")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setViewer((data as any) ?? null));
  }, [user?.id]);

  const load = useCallback(async () => {
    if (!id) return;
    // Fetch the targeted ask + all active asks
    const [{ data: target }, { data: list }] = await Promise.all([
      supabase.from("live_asks").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("live_asks")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    const all: LiveAsk[] = [];
    const seen = new Set<string>();
    if (target) { all.push(target as any); seen.add((target as any).id); }
    for (const a of (list ?? []) as any[]) {
      if (seen.has(a.id)) continue;
      if (user && a.asker_id === user.id) continue;
      if (new Date(a.reveal_at).getTime() <= Date.now() && a.status === "active") continue;
      if (!matches(a, viewer)) continue;
      all.push(a);
      seen.add(a.id);
    }

    setAsks(all);

    if (user && all.length) {
      const { data: v } = await supabase
        .from("live_ask_votes")
        .select("live_ask_id,choice")
        .eq("user_id", user.id)
        .in("live_ask_id", all.map((a) => a.id));
      const map: Record<string, "A" | "B"> = {};
      for (const row of (v ?? []) as any[]) map[row.live_ask_id] = row.choice;
      setVotes(map);
    }
    setLoading(false);
  }, [id, user?.id, viewer]);

  useEffect(() => { load(); }, [load]);

  // Realtime updates
  useEffect(() => {
    const ch = supabase
      .channel(`live-ask-view-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_asks" }, (payload) => {
        const updated = payload.new as any;
        setAsks((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  // Scroll to the requested ask on first render
  useEffect(() => {
    if (initialScrolledRef.current || !asks.length || !scrollerRef.current) return;
    const idx = asks.findIndex((a) => a.id === id);
    if (idx >= 0) {
      const el = scrollerRef.current;
      el.scrollTo({ left: idx * el.clientWidth, behavior: "auto" });
      setActiveIdx(idx);
    }
    initialScrolledRef.current = true;
  }, [asks, id]);

  // Track active page on scroll
  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== activeIdx) setActiveIdx(idx);
  };

  const goto = (idx: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * el.clientWidth, behavior: "smooth" });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!asks.length) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center gap-3">
        <p className="font-semibold">No Live Asks available</p>
        <Button variant="outline" onClick={() => nav("/home")}>Back home</Button>
      </div>
    );
  }

  const current = asks[activeIdx] ?? asks[0];

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-4 pb-2 bg-background/95 backdrop-blur"
        style={{ paddingTop: "max(env(safe-area-inset-top), 0.5rem)" }}
      >
        <button onClick={() => nav("/home")} aria-label="Home" className="p-2">
          <Home className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-primary font-semibold">Live Ask</span>
          {asks.length > 1 && (
            <span className="text-[10px] font-semibold text-[#E8392A] bg-[#E8392A]/10 px-1.5 py-0.5 rounded-full">
              {activeIdx + 1}/{asks.length}
            </span>
          )}
        </div>
        <ReportButton liveAskId={current.id} />
      </header>

      {/* Horizontal swipeable carousel */}
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex-1 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth scrollbar-hide"
      >
        {asks.map((ask) => (
          <div key={ask.id} className="snap-center shrink-0 w-full overflow-y-auto">
            <AskPage
              ask={ask}
              voted={votes[ask.id] ?? null}
              onVoted={(choice) => setVotes((v) => ({ ...v, [ask.id]: choice }))}
              onAskUpdate={(patch) => setAsks((prev) => prev.map((a) => (a.id === ask.id ? { ...a, ...patch } : a)))}
              onNext={() => {
                const nextIdx = asks.findIndex((a, i) => i > activeIdx && !votes[a.id]);
                if (nextIdx >= 0) goto(nextIdx);
                else if (activeIdx < asks.length - 1) goto(activeIdx + 1);
              }}
            />
          </div>
        ))}
      </div>

      {asks.length > 1 && (
        <div className="flex justify-center gap-1.5 py-2" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}>
          {asks.map((_, i) => (
            <button
              key={i}
              aria-label={`Go to ${i + 1}`}
              onClick={() => goto(i)}
              className={`h-1.5 rounded-full transition-all ${i === activeIdx ? "w-6 bg-[#E8392A]" : "w-1.5 bg-foreground/20"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReportButton({ liveAskId }: { liveAskId: string }) {
  const report = async () => {
    const reason = prompt("Why are you reporting this? (e.g. unsafe, offensive, spam)");
    if (!reason) return;
    const { error } = await supabase.functions.invoke("report-live-ask", { body: { live_ask_id: liveAskId, reason } });
    if (error) toast({ title: error.message, variant: "destructive" });
    else toast({ title: "Report submitted" });
  };
  return (
    <button onClick={report} className="p-2" aria-label="Report">
      <Flag className="h-5 w-5 text-muted-foreground" />
    </button>
  );
}

function AskPage({
  ask, voted, onVoted, onAskUpdate, onNext,
}: {
  ask: LiveAsk;
  voted: "A" | "B" | null;
  onVoted: (c: "A" | "B") => void;
  onAskUpdate: (patch: Partial<LiveAsk>) => void;
  onNext: () => void;
}) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [voting, setVoting] = useState(false);
  const [startMs] = useState(() => Date.now());

  const isAsker = !!user && ask.asker_id === user.id;
  const windowClosed = useMemo(() => new Date(ask.reveal_at).getTime() <= Date.now(), [ask.reveal_at]);
  const isClosed = ask.status === "finalized" || windowClosed;
  const revealed = !!voted || isAsker || windowClosed;

  const pctA = ask.vote_count > 0 ? Math.round((ask.votes_a / ask.vote_count) * 100) : 0;
  const pctB = ask.vote_count > 0 ? 100 - pctA : 0;

  const vote = async (choice: "A" | "B") => {
    if (!user) return nav("/auth");
    if (voting || voted) return;
    if (isAsker) return toast({ title: "You can't vote on your own Live Ask" });
    if (isClosed) return toast({ title: "Voting closed" });
    setVoting(true);
    onAskUpdate({
      vote_count: ask.vote_count + 1,
      votes_a: ask.votes_a + (choice === "A" ? 1 : 0),
      votes_b: ask.votes_b + (choice === "B" ? 1 : 0),
    });
    onVoted(choice);
    try {
      const { data, error } = await supabase.functions.invoke("vote-live-ask", {
        body: { live_ask_id: ask.id, choice, session_duration_ms: Date.now() - startMs },
      });
      if (error) throw error;
      if ((data as any)?.is_targeted_match) toast({ title: "You matched the asker's audience" });
      // Auto-advance to the next unvoted ask after a brief reveal
      setTimeout(onNext, 900);
    } catch (e: any) {
      onAskUpdate({
        vote_count: Math.max(0, ask.vote_count),
        votes_a: Math.max(0, ask.votes_a),
        votes_b: Math.max(0, ask.votes_b),
      });
      toast({ title: e?.message || "Failed to vote", variant: "destructive" });
    } finally {
      setVoting(false);
    }
  };

  if (ask.status === "collapsed" || ask.status === "rejected") {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-6 text-center gap-3">
        <p className="font-semibold">This Live Ask was removed</p>
        <p className="text-sm text-muted-foreground">It was flagged by the community.</p>
      </div>
    );
  }

  return (
    <main className="px-4 pt-2 max-w-md w-full mx-auto" style={{ paddingBottom: "1rem" }}>
      <div className="aspect-[4/5] max-h-[54dvh] w-full rounded-2xl overflow-hidden bg-muted shadow-card">
        <img src={ask.photo_url} alt="" className="w-full h-full object-cover" />
      </div>

      <h2 className="text-base font-semibold text-center mt-3 line-clamp-2">{ask.question}</h2>
      {ask.target_gender && (
        <p className="text-[11px] text-center text-muted-foreground mt-0.5">
          Asking {ask.target_gender === "female" ? "women" : "men"} only
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 mt-3">
        <VoteButton label={ask.option_a} pct={revealed ? pctA : null} selected={voted === "A"} disabled={voting || !!voted || isAsker || isClosed} onClick={() => vote("A")} />
        <VoteButton label={ask.option_b} pct={revealed ? pctB : null} selected={voted === "B"} disabled={voting || !!voted || isAsker || isClosed} onClick={() => vote("B")} />
      </div>

      <p className="text-[11px] text-center text-muted-foreground mt-2">
        {isAsker
          ? `${ask.vote_count} ${ask.vote_count === 1 ? "vote" : "votes"} — others can vote on this`
          : `${ask.vote_count} ${ask.vote_count === 1 ? "vote" : "votes"}`}
        {!isAsker && !revealed && !isClosed && " — vote to reveal"}
        {isClosed && " — voting closed"}
      </p>
      <p className="text-[10px] text-center text-muted-foreground/70 mt-3">Swipe ← → for more Live Asks</p>
    </main>
  );
}

function VoteButton({ label, pct, selected, disabled, onClick }: {
  label: string; pct: number | null; selected: boolean; disabled: boolean; onClick: () => void;
}) {
  const isWinner = pct !== null && pct >= 50;
  return (
    <button
      onClick={onClick}
      aria-disabled={disabled}
      className={`group relative min-h-[72px] rounded-2xl px-4 py-3 text-left overflow-hidden transition-all duration-300 ${
        selected
          ? "shadow-[0_8px_24px_-8px_rgba(232,57,42,0.45)] ring-2 ring-[#E8392A]"
          : "shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-border/60 hover:ring-foreground/20"
      } ${disabled ? "" : "active:scale-[0.97]"} bg-gradient-to-br from-white to-neutral-50`}
    >
      {pct !== null && (
        <div
          className={`absolute inset-y-0 left-0 transition-all duration-700 ease-out ${
            selected
              ? "bg-gradient-to-r from-[#E8392A]/20 via-[#E8392A]/12 to-[#E8392A]/5"
              : isWinner
                ? "bg-gradient-to-r from-neutral-200/80 to-neutral-100/40"
                : "bg-gradient-to-r from-neutral-100 to-neutral-50/50"
          }`}
          style={{ width: `${pct}%` }}
        />
      )}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
      <div className="relative flex items-center justify-between gap-3 h-full min-w-0">
        <span className={`min-w-0 flex-1 break-words line-clamp-2 font-semibold text-[15px] tracking-tight ${selected ? "text-[#E8392A]" : "text-foreground"}`}>
          {label}
        </span>
        {pct !== null && (
          <span className={`flex-shrink-0 text-xl font-bold tabular-nums tracking-tight ${selected ? "text-[#E8392A]" : "text-foreground/80"}`}>
            {pct}<span className="text-xs font-semibold opacity-60">%</span>
          </span>
        )}
      </div>
    </button>
  );
}
