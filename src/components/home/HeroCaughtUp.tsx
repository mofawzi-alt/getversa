import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Clock, Lock, Eye, Swords, MessageCircleQuestion, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DIMENSION_THRESHOLDS = [20, 50, 100, 200, 500];

function getNextDimensionInfo(totalVotes: number) {
  const next = DIMENSION_THRESHOLDS.find(t => totalVotes < t);
  if (!next) return null;
  return { remaining: next - totalVotes, threshold: next };
}

export default function HeroCaughtUp({ onPollTap: _onPollTap }: { onPollTap?: (poll: any) => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: totalVotes } = useQuery({
    queryKey: ['caught-up-vote-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase
        .from('votes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      return count || 0;
    },
    staleTime: 1000 * 60,
    enabled: !!user,
  });

  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    const update = () => {
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

  const dimensionInfo = getNextDimensionInfo(totalVotes ?? 0);

  return (
    <div className="w-full px-4 py-6 space-y-3">
      {/* 1. Countdown */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card border border-border/60">
        <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Next drop in {countdown}</p>
          <p className="text-xs text-muted-foreground">New polls drop daily at 9 AM</p>
        </div>
      </div>

      {/* 2. Personality progress */}
      {dimensionInfo ? (
        <button
          onClick={() => navigate('/insights')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-card border border-border/60 text-left group"
        >
          <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Vote on {dimensionInfo.remaining} more poll{dimensionInfo.remaining !== 1 ? 's' : ''} to unlock your next dimension
            </p>
            <p className="text-xs text-muted-foreground">Discover what your choices reveal</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
        </button>
      ) : (
        <button
          onClick={() => navigate('/insights')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-card border border-border/60 text-left group"
        >
          <Eye className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">All dimensions unlocked</p>
            <p className="text-xs text-muted-foreground">View your full insight profile</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
        </button>
      )}

      {/* 3. Duel CTA */}
      <button
        onClick={() => navigate('/play')}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-card border border-border/60 text-left group"
      >
        <Swords className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <p className="text-sm font-semibold text-foreground flex-1">Challenge a friend to a 10-poll duel</p>
        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
      </button>

      {/* 4. Ask Versa CTA */}
      <button
        onClick={() => navigate('/ask')}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-card border border-border/60 text-left group"
      >
        <MessageCircleQuestion className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <p className="text-sm font-semibold text-foreground flex-1">Ask Egypt anything</p>
        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
      </button>
    </div>
  );
}
