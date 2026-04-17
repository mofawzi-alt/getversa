import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type PrefKey =
  | "streak_reminder"
  | "friend_activity"
  | "challenge_waiting"
  | "controversial_poll"
  | "compatibility_change"
  | "weekly_taste_report"
  | "new_category"
  | "missed_poll"
  | "predict_reveal"
  | "last_chance_poll";

const ROWS: { key: PrefKey; label: string; desc: string }[] = [
  { key: "streak_reminder", label: "Streak reminders", desc: "When your streak is about to break" },
  { key: "challenge_waiting", label: "Duel challenges", desc: "When a friend challenges you" },
  { key: "last_chance_poll", label: "Last chance polls", desc: "Trending polls expiring in under 2 hours" },
  { key: "friend_activity", label: "Friend activity", desc: "When friends vote on polls" },
  { key: "controversial_poll", label: "50/50 polls", desc: "Perfectly split polls you can tip" },
  { key: "weekly_taste_report", label: "Weekly taste report", desc: "Your Sunday recap" },
  { key: "new_category", label: "New categories", desc: "When a new category drops" },
  { key: "compatibility_change", label: "Compatibility changes", desc: "When your match score with a friend shifts" },
  { key: "missed_poll", label: "Missed polls", desc: "Recap of trending polls you didn't vote on" },
  { key: "predict_reveal", label: "Predict reveals", desc: "When perception gap data is ready" },
];

const DEFAULTS: Record<PrefKey, boolean> = ROWS.reduce(
  (acc, r) => ({ ...acc, [r.key]: true }),
  {} as Record<PrefKey, boolean>
);

export function NotificationPreferences() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        const next = { ...DEFAULTS };
        ROWS.forEach((r) => {
          if (typeof (data as any)[r.key] === "boolean") next[r.key] = (data as any)[r.key];
        });
        setPrefs(next);
      }
      setLoading(false);
    })();
  }, [user]);

  const update = async (key: PrefKey, value: boolean) => {
    if (!user) return;
    const prev = prefs[key];
    setPrefs((p) => ({ ...p, [key]: value }));
    const { error } = await supabase
      .from("user_notification_preferences")
      .upsert({ user_id: user.id, [key]: value }, { onConflict: "user_id" });
    if (error) {
      setPrefs((p) => ({ ...p, [key]: prev }));
      toast.error("Failed to update");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="px-1 pb-2">
        <h2 className="text-sm font-semibold text-foreground">What you get notified about</h2>
        <p className="text-xs text-muted-foreground">Max 3 notifications per day. Quiet hours: 11pm–8am.</p>
      </div>
      <div className="glass rounded-2xl divide-y divide-border">
        {ROWS.map((row) => (
          <div key={row.key} className="p-4 flex items-center justify-between gap-4">
            <div className="space-y-0.5 min-w-0 flex-1">
              <Label className="text-sm font-medium">{row.label}</Label>
              <p className="text-xs text-muted-foreground line-clamp-2">{row.desc}</p>
            </div>
            <Switch
              checked={prefs[row.key]}
              onCheckedChange={(v) => update(row.key, v)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
