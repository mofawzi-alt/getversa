import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MessageCircleQuestion, Plus, Users, Clock, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface MyAsk {
  id: string;
  photo_url: string;
  question: string;
  option_a: string;
  option_b: string;
  vote_count: number;
  votes_a: number;
  votes_b: number;
  status: string;
  reveal_at: string;
  created_at: string;
}

function timeLeft(reveal_at: string): string {
  const ms = new Date(reveal_at).getTime() - Date.now();
  if (ms <= 0) return "Ended";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 1) return `${h}h ${m}m left`;
  return `${m}m left`;
}

export default function MyLiveAsks() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [asks, setAsks] = useState<MyAsk[] | null>(null);
  const [seenCounts, setSeenCounts] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("live_asks")
      .select("id,photo_url,question,option_a,option_b,vote_count,votes_a,votes_b,status,reveal_at,created_at")
      .eq("asker_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setAsks((data ?? []) as MyAsk[]);
  }, [user?.id]);

  useEffect(() => {
    // Load locally-tracked "last seen vote count" to highlight new votes
    try {
      const raw = localStorage.getItem("myLiveAsks:seen");
      if (raw) setSeenCounts(JSON.parse(raw));
    } catch (_) { /* noop */ }
  }, []);

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    if (!user) return;
    const ch = supabase
      .channel(`my-live-asks-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_asks", filter: `asker_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      supabase.removeChannel(ch);
    };
  }, [load, user?.id]);

  // When the user opens this page, mark all current vote_counts as "seen"
  // after a small delay so the badges remain visible briefly.
  useEffect(() => {
    if (!asks) return;
    const t = setTimeout(() => {
      const next: Record<string, number> = {};
      asks.forEach((a) => { next[a.id] = a.vote_count; });
      setSeenCounts(next);
      try { localStorage.setItem("myLiveAsks:seen", JSON.stringify(next)); } catch (_) { /* noop */ }
    }, 4000);
    return () => clearTimeout(t);
  }, [asks]);

  if (!user) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-6 text-center bg-background">
        <p className="text-sm text-muted-foreground">Please sign in to see your Live Asks.</p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Header */}
      <div
        className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center gap-2 px-3 py-3 max-w-md mx-auto">
          <button onClick={() => nav(-1)} className="p-1.5 -ml-1 rounded-full active:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-base font-bold flex-1">My Live Asks</h1>
          <button
            onClick={() => nav("/live-ask/new")}
            className="flex items-center gap-1 h-8 px-3 rounded-full bg-primary text-primary-foreground text-xs font-bold active:scale-95 transition"
          >
            <Plus className="h-3.5 w-3.5" /> New
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto px-3 py-4 space-y-3">
        {asks === null && (
          <div className="text-center py-12 text-sm text-muted-foreground">Loading…</div>
        )}

        {asks && asks.length === 0 && (
          <div className="text-center py-16 px-6">
            <div className="inline-flex h-14 w-14 rounded-full bg-primary/10 items-center justify-center mb-3">
              <MessageCircleQuestion className="h-6 w-6 text-primary" />
            </div>
            <p className="text-base font-bold mb-1">No Live Asks yet</p>
            <p className="text-xs text-muted-foreground mb-4">
              Post a photo and let Egypt help you decide.
            </p>
            <button
              onClick={() => nav("/live-ask/new")}
              className="h-10 px-5 rounded-full bg-primary text-primary-foreground text-sm font-bold active:scale-95 transition"
            >
              Create your first Live Ask
            </button>
          </div>
        )}

        {asks?.map((a) => {
          const total = a.vote_count;
          const pctA = total > 0 ? Math.round((a.votes_a / total) * 100) : 0;
          const pctB = total > 0 ? 100 - pctA : 0;
          const winner = total === 0 ? null : a.votes_a > a.votes_b ? "A" : a.votes_a < a.votes_b ? "B" : "tie";
          const closed = a.status === "finalized" || new Date(a.reveal_at).getTime() <= Date.now();
          const seen = seenCounts[a.id] ?? 0;
          const newVotes = Math.max(0, total - seen);

          return (
            <button
              key={a.id}
              onClick={() => nav(`/live-ask/${a.id}`)}
              className="w-full text-left bg-card border border-border rounded-2xl overflow-hidden active:scale-[0.99] transition shadow-sm"
            >
              <div className="flex gap-3 p-3">
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-muted shrink-0">
                  <img src={a.photo_url} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold leading-tight line-clamp-2">{a.question}</p>
                  <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {total} {total === 1 ? "vote" : "votes"}
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      {closed ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      {closed ? "Closed" : timeLeft(a.reveal_at)}
                    </span>
                  </div>
                  {newVotes > 0 && !closed && (
                    <span className="inline-block mt-1.5 text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      +{newVotes} new
                    </span>
                  )}
                </div>
              </div>

              {/* Live tally bar */}
              <div className="px-3 pb-3">
                <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
                  <span className={winner === "A" ? "text-primary" : "text-foreground"}>
                    {a.option_a} · {pctA}%
                  </span>
                  <span className={winner === "B" ? "text-primary" : "text-foreground"}>
                    {pctB}% · {a.option_b}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden flex">
                  <div className="h-full bg-primary transition-all" style={{ width: `${pctA}%` }} />
                  <div className="h-full bg-foreground/70 transition-all" style={{ width: `${pctB}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{closed ? "Final" : "Live"} · tap to view full results</span>
                  <span>→</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
