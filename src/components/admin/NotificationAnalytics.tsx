import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Bell, BellOff, TrendingUp } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  streak_reminder: "Streak reminder",
  challenge_waiting: "Duel challenge",
  last_chance_poll: "Last chance",
  friend_activity: "Friend activity",
  controversial_poll: "50/50 split",
  weekly_taste_report: "Weekly recap",
  new_category: "New category",
  compatibility_change: "Compatibility",
  missed_poll: "Missed poll",
  predict_reveal: "Predict reveal",
};

export function NotificationAnalytics() {
  const { data, isLoading } = useQuery({
    queryKey: ["notification-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_notification_analytics", { p_days: 30 });
      if (error) throw error;
      return Array.isArray(data) ? data[0] : data;
    },
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data) return null;

  const byType = (data.by_type ?? {}) as Record<string, { sent: number; opened: number; open_rate: number }>;
  const dailyVolume = (data.daily_volume ?? []) as { date: string; count: number }[];
  const sortedTypes = Object.entries(byType).sort((a, b) => b[1].sent - a[1].sent);
  const topDriver = sortedTypes.find(([_, s]) => s.open_rate > 0)
    ?? sortedTypes[0];
  const maxDaily = Math.max(1, ...dailyVolume.map((d) => d.count));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" /> Sent today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.total_today ?? 0}</p>
            <p className="text-xs text-muted-foreground">Cap: 3 per user / day</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Top driver (30d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{topDriver ? TYPE_LABELS[topDriver[0]] ?? topDriver[0] : "—"}</p>
            <p className="text-xs text-muted-foreground">
              {topDriver ? `${topDriver[1].open_rate}% open rate` : "No opens yet"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BellOff className="h-4 w-4 text-muted-foreground" /> Disabled all
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.users_disabled_all ?? 0}</p>
            <p className="text-xs text-muted-foreground">Users with every type off</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-type performance (30 days)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sortedTypes.length === 0 && (
            <p className="text-sm text-muted-foreground">No notifications sent yet.</p>
          )}
          {sortedTypes.map(([type, stats]) => (
            <div key={type} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{TYPE_LABELS[type] ?? type}</span>
                <span className="text-muted-foreground tabular-nums">
                  {stats.opened}/{stats.sent} • {stats.open_rate}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, stats.open_rate)}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily volume (last 30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyVolume.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <div className="flex items-end gap-1 h-32">
              {dailyVolume.map((d) => (
                <div
                  key={d.date}
                  className="flex-1 bg-primary/70 hover:bg-primary rounded-t transition-colors min-w-[4px]"
                  style={{ height: `${(d.count / maxDaily) * 100}%` }}
                  title={`${d.date}: ${d.count}`}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
