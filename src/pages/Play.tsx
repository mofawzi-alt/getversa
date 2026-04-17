import { useNavigate } from 'react-router-dom';
import { Swords, Sparkles, Trophy, Users } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface GameCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge?: string;
  available: boolean;
  onClick?: () => void;
}

function GameCard({ icon, title, subtitle, badge, available, onClick }: GameCardProps) {
  return (
    <button
      onClick={available ? onClick : undefined}
      disabled={!available}
      className={`relative w-full text-left rounded-2xl border border-border/40 bg-card p-5 transition-all ${
        available ? 'hover:border-primary/40 hover:shadow-md active:scale-[0.99]' : 'opacity-60'
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-bold text-foreground">{title}</h3>
            {badge && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-snug">{subtitle}</p>
        </div>
      </div>
    </button>
  );
}

export default function Play() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState({ duels: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { count: duelCount } = await supabase
        .from('poll_challenges')
        .select('id', { count: 'exact', head: true })
        .or(`challenger_id.eq.${user.id},challenged_id.eq.${user.id}`);

      setStats({ duels: duelCount || 0 });
    })();
  }, [user]);

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Hero */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Challenge Mode</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Versa Arena</h1>
          <p className="text-sm text-muted-foreground">
            Turn voting into a game. Every choice still shapes the data.
          </p>
        </div>

        {/* Stats */}
        {user && (
          <div className="mb-6">
            <div className="rounded-xl bg-card border border-border/40 p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{stats.duels}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Total Battles</p>
            </div>
          </div>
        )}

        {/* Games */}
        <div className="space-y-3">
          <GameCard
            icon={<Swords className="h-6 w-6" />}
            title="Duels"
            subtitle="Challenge a friend to 5 polls. Highest match-rate or fastest score wins."
            badge="Live"
            available
            onClick={() => navigate('/play/duels')}
          />
        </div>

        {/* Why play blurb */}
        <div className="mt-6 rounded-xl bg-muted/40 p-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Every game vote counts.</span> Your picks
            still flow into Versa's pulse — they just come with a scoreboard.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
