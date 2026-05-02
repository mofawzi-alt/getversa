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

  return (
    <div className="w-full px-4 py-6">
      <div className="grid grid-cols-2 gap-2.5">
        {/* 1. Countdown */}
        <div className="flex flex-col gap-1.5 px-3 py-3 rounded-2xl bg-[hsl(210_100%_96%)] border border-[hsl(210_100%_90%)]">
          <div className="flex items-center justify-between">
            <Clock className="h-5 w-5 text-primary flex-shrink-0" />
            <ChevronRight className="h-4 w-4 text-primary/60" />
          </div>
          <p className="text-[13px] font-bold text-foreground leading-tight">Next drop in {countdown}</p>
          <p className="text-[10px] text-muted-foreground leading-tight">New polls at 9 AM</p>
        </div>

        {/* 2. Personality progress */}
        {dimensionInfo ? (
          <button
            onClick={() => navigate('/taste-profile')}
            className="flex flex-col gap-1.5 px-3 py-3 rounded-2xl bg-[hsl(270_60%_96%)] border border-[hsl(270_60%_90%)] text-left group"
          >
            <div className="flex items-center justify-between">
              <Lock className="h-5 w-5 text-[hsl(270_60%_50%)] flex-shrink-0" />
              <ChevronRight className="h-4 w-4 text-[hsl(270_60%_50%)]/60 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-[13px] font-bold text-foreground leading-tight">
              {dimensionInfo.remaining} poll{dimensionInfo.remaining !== 1 ? 's' : ''} to next dimension
            </p>
            <p className="text-[10px] text-muted-foreground leading-tight">Unlock insights</p>
          </button>
        ) : (
          <button
            onClick={() => navigate('/taste-profile')}
            className="flex flex-col gap-1.5 px-3 py-3 rounded-2xl bg-[hsl(270_60%_96%)] border border-[hsl(270_60%_90%)] text-left group"
          >
            <div className="flex items-center justify-between">
              <Eye className="h-5 w-5 text-[hsl(270_60%_50%)] flex-shrink-0" />
              <ChevronRight className="h-4 w-4 text-[hsl(270_60%_50%)]/60 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-[13px] font-bold text-foreground leading-tight">All dimensions unlocked</p>
            <p className="text-[10px] text-muted-foreground leading-tight">View full profile</p>
          </button>
        )}

        {/* 3. Duel CTA */}
        <button
          onClick={() => navigate('/play')}
          className="flex flex-col gap-1.5 px-3 py-3 rounded-2xl bg-[hsl(10_80%_96%)] border border-[hsl(10_80%_90%)] text-left group"
        >
          <div className="flex items-center justify-between">
            <Swords className="h-5 w-5 text-[hsl(10_80%_50%)] flex-shrink-0" />
            <ChevronRight className="h-4 w-4 text-[hsl(10_80%_50%)]/60 group-hover:translate-x-0.5 transition-transform" />
          </div>
          <p className="text-[13px] font-bold text-foreground leading-tight">Challenge a friend</p>
          <p className="text-[10px] text-muted-foreground leading-tight">10-poll duel</p>
        </button>

        {/* 4. Ask Versa CTA */}
        <button
          onClick={() => navigate('/ask')}
          className="flex flex-col gap-1.5 px-3 py-3 rounded-2xl bg-[hsl(145_50%_95%)] border border-[hsl(145_50%_88%)] text-left group"
        >
          <div className="flex items-center justify-between">
            <MessageCircleQuestion className="h-5 w-5 text-[hsl(145_63%_38%)] flex-shrink-0" />
            <ChevronRight className="h-4 w-4 text-[hsl(145_63%_38%)]/60 group-hover:translate-x-0.5 transition-transform" />
          </div>
          <p className="text-[13px] font-bold text-foreground leading-tight">{getAskCtaLabel((profile?.country || profile?.nationality) as string | undefined).replace(' →', '')}</p>
          <p className="text-[10px] text-muted-foreground leading-tight">AI-powered insights</p>
        </button>
      </div>
    </div>
  );
}
