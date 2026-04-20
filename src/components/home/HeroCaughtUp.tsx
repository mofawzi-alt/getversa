import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Clock, BarChart3 } from 'lucide-react';

/**
 * Minimal "no polls left" placeholder.
 * Shows next drop time (9 AM Cairo) and the user's total vote count.
 */
export default function HeroCaughtUp({ onPollTap: _onPollTap }: { onPollTap?: (poll: any) => void }) {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ['caught-up-mini-stats', user?.id],
    queryFn: async () => {
      if (!user) return { totalVotes: 0 };
      const { count } = await supabase
        .from('votes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      return { totalVotes: count || 0 };
    },
    staleTime: 1000 * 60,
    enabled: !!user,
  });

  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    const update = () => {
      // Next drop at 7:00 AM Cairo time (UTC+2, no DST observed currently)
      const now = new Date();
      const cairoNow = new Date(now.getTime() + (now.getTimezoneOffset() + 120) * 60000);
      const next = new Date(cairoNow);
      next.setHours(7, 0, 0, 0);
      if (cairoNow.getHours() >= 7) next.setDate(next.getDate() + 1);
      const diff = next.getTime() - cairoNow.getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setCountdown(`${h}h ${m}m`);
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="w-full flex justify-center py-4">
      <div className="flex items-center gap-4 px-4 py-2.5 rounded-full bg-card border border-border/60">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Next drop in</span>
          <span className="text-xs font-bold text-foreground">{countdown}</span>
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-1.5">
          <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-bold text-foreground">{stats?.totalVotes || 0}</span>
          <span className="text-xs text-muted-foreground">votes</span>
        </div>
      </div>
    </div>
  );
}
