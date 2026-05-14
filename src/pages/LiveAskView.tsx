import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Flag } from "lucide-react";

interface LiveAsk {
  id: string;
  asker_id: string;
  photo_url: string;
  question: string;
  option_a: string;
  option_b: string;
  target_gender: string | null;
  status: string;
  vote_count: number;
  votes_a: number;
  votes_b: number;
  reveal_at: string;
  created_at: string;
}

export default function LiveAskView() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [ask, setAsk] = useState<LiveAsk | null>(null);
  const [loading, setLoading] = useState(true);
  const [voted, setVoted] = useState<"A" | "B" | null>(null);
  const [voting, setVoting] = useState(false);
  const [startMs] = useState(() => Date.now());

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    (async () => {
      const { data, error } = await supabase.from("live_asks").select("*").eq("id", id).maybeSingle();
      if (!mounted) return;
      if (error) {
        console.error("Failed to load Live Ask", error);
        toast({ title: "Couldn't open this Live Ask", variant: "destructive" });
        setLoading(false);
        return;
      }
      setAsk(data as any);
      if (user && data) {
        const { data: v } = await supabase
          .from("live_ask_votes")
          .select("choice")
          .eq("live_ask_id", id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (v) setVoted((v as any).choice);
      }
      setLoading(false);
    })();

    const ch = supabase
      .channel(`live-ask-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_asks", filter: `id=eq.${id}` }, (payload) => {
        setAsk((prev) => ({ ...(prev as any), ...(payload.new as any) }));
      })
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [id, user]);

  const isAsker = ask && user && ask.asker_id === user.id;
  const windowClosed = useMemo(() => {
    if (!ask) return false;
    return new Date(ask.reveal_at).getTime() <= Date.now();
  }, [ask]);
  const isClosed = !!ask && (ask.status === "finalized" || windowClosed);
  const revealed = useMemo(() => {
    if (!ask) return false;
    if (voted) return true;
    if (isAsker) return true;
    return windowClosed;
  }, [ask, voted, isAsker, windowClosed]);

  const pctA = ask && ask.vote_count > 0 ? Math.round((ask.votes_a / ask.vote_count) * 100) : 0;
  const pctB = ask && ask.vote_count > 0 ? 100 - pctA : 0;

  const vote = async (choice: "A" | "B") => {
    if (!user) return nav("/auth");
    if (voting || voted) return;
    setVoting(true);
    // Optimistic UI: bump local counts immediately
    setAsk((prev) => prev ? {
      ...prev,
      vote_count: prev.vote_count + 1,
      votes_a: prev.votes_a + (choice === "A" ? 1 : 0),
      votes_b: prev.votes_b + (choice === "B" ? 1 : 0),
    } : prev);
    setVoted(choice);
    try {
      const { data, error } = await supabase.functions.invoke("vote-live-ask", {
        body: { live_ask_id: id, choice, session_duration_ms: Date.now() - startMs },
      });
      if (error) throw error;
      if ((data as any)?.is_targeted_match) toast({ title: "You matched the asker's audience" });
    } catch (e: any) {
      // Roll back optimistic update
      setVoted(null);
      setAsk((prev) => prev ? {
        ...prev,
        vote_count: Math.max(0, prev.vote_count - 1),
        votes_a: Math.max(0, prev.votes_a - (choice === "A" ? 1 : 0)),
        votes_b: Math.max(0, prev.votes_b - (choice === "B" ? 1 : 0)),
      } : prev);
      toast({ title: e?.message || "Failed to vote", variant: "destructive" });
    } finally {
      setVoting(false);
    }
  };

  const report = async () => {
    if (!user) return;
    const reason = prompt("Why are you reporting this? (e.g. unsafe, offensive, spam)");
    if (!reason) return;
    const { error } = await supabase.functions.invoke("report-live-ask", { body: { live_ask_id: id, reason } });
    if (error) toast({ title: error.message, variant: "destructive" });
    else toast({ title: "Report submitted" });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!ask) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Live Ask not found</div>;
  }
  if (ask.status === "collapsed" || ask.status === "rejected") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center gap-3">
        <p className="font-semibold">This Live Ask was removed</p>
        <p className="text-sm text-muted-foreground">It was flagged by the community.</p>
        <Button variant="outline" onClick={() => nav("/home")}>Back home</Button>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-background overflow-hidden">
      <header className="flex items-center justify-between px-4 py-2 flex-shrink-0">
        <button onClick={() => nav(-1)} className="p-2"><ArrowLeft className="h-5 w-5" /></button>
        <span className="text-xs uppercase tracking-wide text-primary font-semibold">
          {isClosed ? "Live Ask · Closed" : "Live Ask"}
        </span>
        <button onClick={report} className="p-2"><Flag className="h-5 w-5 text-muted-foreground" /></button>
      </header>

      <div className="flex-1 flex flex-col px-4 pb-3 max-w-md w-full mx-auto min-h-0">
        <div className="flex-1 min-h-0 rounded-2xl overflow-hidden bg-muted">
          <img src={ask.photo_url} alt="" className="w-full h-full object-cover" />
        </div>

        <h2 className="text-base font-semibold text-center mt-3 line-clamp-2">{ask.question}</h2>
        {ask.target_gender && (
          <p className="text-[11px] text-center text-muted-foreground mt-0.5">
            Asking {ask.target_gender === "female" ? "women" : "men"} only
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 mt-3">
          <VoteButton
            label={ask.option_a}
            pct={revealed ? pctA : null}
            selected={voted === "A"}
            disabled={voting || !!voted || !!isAsker || isClosed}
            onClick={() => vote("A")}
          />
          <VoteButton
            label={ask.option_b}
            pct={revealed ? pctB : null}
            selected={voted === "B"}
            disabled={voting || !!voted || !!isAsker || isClosed}
            onClick={() => vote("B")}
          />
        </div>

        <p className="text-[11px] text-center text-muted-foreground mt-2">
          {ask.vote_count} {ask.vote_count === 1 ? "vote" : "votes"}
          {!revealed && !isClosed && " — vote to reveal"}
          {isClosed && " — voting closed"}
        </p>
      </div>
    </div>
  );
}

function VoteButton({ label, pct, selected, disabled, onClick }: {
  label: string; pct: number | null; selected: boolean; disabled: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative h-16 rounded-2xl border-2 px-3 text-left overflow-hidden transition ${
        selected ? "border-primary bg-primary/5" : "border-border bg-background"
      } ${disabled ? "opacity-90" : "active:scale-[0.98]"}`}
    >
      {pct !== null && (
        <div
          className={`absolute inset-y-0 left-0 ${selected ? "bg-primary/15" : "bg-muted"}`}
          style={{ width: `${pct}%` }}
        />
      )}
      <div className="relative flex items-center justify-between h-full">
        <span className="font-medium text-sm">{label}</span>
        {pct !== null && <span className="text-lg font-bold">{pct}%</span>}
      </div>
    </button>
  );
}
