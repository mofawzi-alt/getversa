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
      const { data } = await supabase.from("live_asks").select("*").eq("id", id).maybeSingle();
      if (!mounted) return;
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
        setAsk(payload.new as any);
      })
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [id, user]);

  const isAsker = ask && user && ask.asker_id === user.id;
  const revealed = useMemo(() => {
    if (!ask) return false;
    if (voted) return true;
    if (isAsker) return true;
    return new Date(ask.reveal_at).getTime() <= Date.now();
  }, [ask, voted, isAsker]);

  const pctA = ask && ask.vote_count > 0 ? Math.round((ask.votes_a / ask.vote_count) * 100) : 0;
  const pctB = ask && ask.vote_count > 0 ? 100 - pctA : 0;

  const vote = async (choice: "A" | "B") => {
    if (!user) return nav("/auth");
    if (voting || voted) return;
    setVoting(true);
    try {
      const { data, error } = await supabase.functions.invoke("vote-live-ask", {
        body: { live_ask_id: id, choice, session_duration_ms: Date.now() - startMs },
      });
      if (error) throw error;
      setVoted(choice);
      if ((data as any)?.is_targeted_match) toast({ title: "You matched the asker's audience" });
    } catch (e: any) {
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
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between p-4">
        <button onClick={() => nav(-1)} className="p-2"><ArrowLeft className="h-5 w-5" /></button>
        <span className="text-xs uppercase tracking-wide text-primary font-semibold">Live Ask</span>
        <button onClick={report} className="p-2"><Flag className="h-5 w-5 text-muted-foreground" /></button>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-5">
        <div className="aspect-[4/5] w-full rounded-2xl overflow-hidden bg-muted">
          <img src={ask.photo_url} alt="" className="w-full h-full object-cover" />
        </div>

        <h2 className="text-xl font-semibold text-center">{ask.question}</h2>
        {ask.target_gender && (
          <p className="text-xs text-center text-muted-foreground">
            Asking {ask.target_gender === "female" ? "women" : "men"} only
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <VoteButton
            label={ask.option_a}
            pct={revealed ? pctA : null}
            selected={voted === "A"}
            disabled={voting || !!voted || isAsker || ask.status !== "active"}
            onClick={() => vote("A")}
          />
          <VoteButton
            label={ask.option_b}
            pct={revealed ? pctB : null}
            selected={voted === "B"}
            disabled={voting || !!voted || isAsker || ask.status !== "active"}
            onClick={() => vote("B")}
          />
        </div>

        <p className="text-xs text-center text-muted-foreground">
          {ask.vote_count} {ask.vote_count === 1 ? "vote" : "votes"}
          {!revealed && " — vote to see results, or wait until the 15-min window closes"}
          {revealed && !voted && !isAsker && " — voting closed"}
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
      className={`relative h-28 rounded-2xl border-2 px-4 text-left overflow-hidden transition ${
        selected ? "border-primary bg-primary/5" : "border-border bg-background"
      } ${disabled ? "opacity-90" : "active:scale-[0.98]"}`}
    >
      {pct !== null && (
        <div
          className={`absolute inset-y-0 left-0 ${selected ? "bg-primary/15" : "bg-muted"}`}
          style={{ width: `${pct}%` }}
        />
      )}
      <div className="relative flex items-end justify-between h-full">
        <span className="font-medium">{label}</span>
        {pct !== null && <span className="text-2xl font-bold">{pct}%</span>}
      </div>
    </button>
  );
}
