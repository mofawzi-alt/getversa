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

const MENA_COUNTRIES = ['Egypt','UAE','Saudi Arabia','Jordan','Lebanon','Morocco','Tunisia','Algeria','Libya','Iraq','Kuwait','Bahrain','Qatar','Oman','Yemen','Syria','Palestine','Sudan'];

function getAskCtaLabel(country?: string | null): string {
  if (!country) return 'Ask Versa →';
  const short: Record<string, string> = { 'Saudi Arabia': 'Saudi', 'United Arab Emirates': 'UAE' };
  if (MENA_COUNTRIES.includes(country)) return `Ask ${short[country] || country} anything →`;
  return 'Ask Versa →';
}

export default function HeroCaughtUp({ onPollTap: _onPollTap }: { onPollTap?: (poll: any) => void }) {
  const { user, profile } = useAuth();
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

  const askLabel = getAskCtaLabel((profile?.country || profile?.nationality) as string | undefined).replace(' →', '');

  return (
    <div className="w-full px-4 py-6 space-y-4">
      {/* Countdown — plain text, no box */}
      <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        <p className="text-xs font-medium">Next drop in <span className="text-foreground font-bold">{countdown}</span> · New polls at 9 AM</p>
      </div>

    </div>
  );
}
