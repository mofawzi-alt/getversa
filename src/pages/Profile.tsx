import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { LogOut, ChevronRight, User, Bell, Shield, Flame, History, Sparkles, Target, Swords, BarChart3, Coins } from 'lucide-react';
import { useAskCredits } from '@/hooks/useAskCredits';
import VerifiedBadge from '@/components/VerifiedBadge';
import { useVerifiedUser } from '@/hooks/useVerifiedUsers';
import { toast } from 'sonner';
import ProfileDimensionsSection from '@/components/profile/ProfileDimensionsSection';
import VotingInsights from '@/components/profile/VotingInsights';
import PersonalityTypeCard from '@/components/profile/PersonalityTypeCard';
import ShareCompatibilityCard from '@/components/compare/ShareCompatibilityCard';
import VoteHistoryGrid from '@/components/profile/VoteHistoryGrid';
import PersonalWeeklySummary from '@/components/home/PersonalWeeklySummary';
import SuggestPollDialog from '@/components/profile/SuggestPollDialog';
import BiometricToggle from '@/components/profile/BiometricToggle';
import DeleteAccountButton from '@/components/profile/DeleteAccountButton';

export default function Profile() {
  const { profile, isAdmin, signOut, user } = useAuth();
  const navigate = useNavigate();
  const { isVerified: selfVerified, category: selfCategory } = useVerifiedUser(user?.id);
  const { data: credits = 0 } = useAskCredits();
  const [loggingOut, setLoggingOut] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ['user-stats-v2', profile?.id],
    queryFn: async () => {
      if (!profile) return null;

      const [votesResult, streakResult, comparisonsResult, battlesResult] = await Promise.all([
        supabase.from('votes').select('id', { count: 'exact', head: true }).eq('user_id', profile.id),
        supabase.from('users').select('current_streak, longest_streak, prediction_accuracy, prediction_total').eq('id', profile.id).single(),
        // Comparisons = friendships (each accepted friend = a possible compatibility comparison)
        supabase.from('friendships').select('id', { count: 'exact', head: true })
          .eq('status', 'accepted')
          .or(`requester_id.eq.${profile.id},recipient_id.eq.${profile.id}`),
        // Battles = poll_challenges the user is part of
        supabase.from('poll_challenges').select('id', { count: 'exact', head: true })
          .or(`challenger_id.eq.${profile.id},challenged_id.eq.${profile.id}`),
      ]);

      return {
        votes: votesResult.count || 0,
        currentStreak: streakResult.data?.current_streak || 0,
        longestStreak: streakResult.data?.longest_streak || 0,
        predictionAccuracy: (streakResult.data as any)?.prediction_accuracy || 0,
        predictionTotal: (streakResult.data as any)?.prediction_total || 0,
        comparisons: comparisonsResult.count || 0,
        battles: battlesResult.count || 0,
      };
    },
    enabled: !!profile,
  });

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      toast.loading('Logging out...', { id: 'logout' });
      await signOut();
      toast.success('Logged out successfully', { id: 'logout' });
      navigate('/auth', { replace: true });
    } catch (e) {
      console.error('Logout error', e);
      toast.error('Logout failed', { id: 'logout' });
      setLoggingOut(false);
    }
  };

  const menuItems = [
    { icon: Sparkles, label: 'Taste Profile', path: '/taste-profile', color: 'text-primary', highlight: true },
    { icon: History, label: 'My Votes', path: '/history', color: 'text-primary' },
    { icon: User, label: 'Edit Profile', path: '/profile/edit', color: 'text-muted-foreground' },
    { icon: Bell, label: 'Notification Settings', path: '/profile/notifications', color: 'text-muted-foreground' },

    ...(isAdmin ? [{ icon: Shield, label: 'Admin Dashboard', path: '/admin', color: 'text-destructive' }] : []),
  ];

  return (
    <AppLayout>
      <div className="p-4 space-y-6 animate-slide-up">
        {/* Profile Header */}
        <div className="glass rounded-2xl p-4 text-center">
          {(profile as any)?.avatar_url ? (
            <img
              src={(profile as any).avatar_url}
              alt="Profile"
              className="w-14 h-14 rounded-full mx-auto mb-2 object-cover ring-2 ring-border"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-gradient-primary mx-auto mb-2 flex items-center justify-center">
              <span className="text-xl font-display font-bold text-primary-foreground">
                {profile?.username?.[0]?.toUpperCase() || '?'}
              </span>
            </div>
          )}

          <div className="flex items-center justify-center gap-1.5">
            <h1 className="text-lg font-display font-bold">
              @{profile?.username || 'user'}
            </h1>
            {selfVerified && <VerifiedBadge size="sm" />}
          </div>
          {selfVerified && selfCategory && (
            <p className="text-[11px] text-blue-500 font-medium mt-0.5">{selfCategory}</p>
          )}

          <p className="text-card-foreground/70 text-xs mt-0.5">
            {profile?.country || 'Unknown location'}
          </p>

          {/* Votes / Comparisons / Battles / Points / Majority */}
          <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
            <button onClick={() => navigate('/history')} className="flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1">
                <BarChart3 className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm font-bold text-foreground">{stats?.votes || 0}</span>
              </div>
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Votes</span>
            </button>
            <div className="w-px h-7 bg-border" />
            <button onClick={() => navigate('/compare')} className="flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1">
                <Target className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm font-bold text-foreground">{stats?.comparisons || 0}</span>
              </div>
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Comparisons</span>
            </button>
            <div className="w-px h-7 bg-border" />
            <button onClick={() => navigate('/play/duels')} className="flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1">
                <Swords className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm font-bold text-foreground">{stats?.battles || 0}</span>
              </div>
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Battles</span>
            </button>
            <div className="w-px h-7 bg-border" />
            <button onClick={() => navigate('/rewards')} className="flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm font-bold text-foreground">{profile?.points || 0}</span>
              </div>
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Points</span>
            </button>
            <div className="w-px h-7 bg-border" />
            <button onClick={() => navigate('/ask')} className="flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1">
                <Coins className="h-3 w-3 text-primary" />
                <span className="text-sm font-bold text-foreground">{credits}</span>
              </div>
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Credits</span>
            </button>
            <div className="w-px h-7 bg-border" />
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1">
                <Target className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm font-bold text-foreground">{stats?.predictionAccuracy || 0}%</span>
              </div>
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Majority</span>
            </div>
          </div>

          {stats?.currentStreak !== undefined && stats.currentStreak > 0 && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warning/20 mt-3">
              <Flame className="h-3 w-3 text-warning" />
              <span className="text-xs font-bold text-warning">{stats.currentStreak} day streak</span>
            </div>
          )}
        </div>

        {/* Compatibility Link */}
        <ShareCompatibilityCard />

        {/* Your Week — moved from Home */}
        <PersonalWeeklySummary />

        {/* Personality Type — primary placement */}
        {user && <PersonalityTypeCard userId={user.id} isOwnProfile />}

        {/* Recent vote history grid */}
        {user && <VoteHistoryGrid userId={user.id} />}

        {/* Your Dimensions (with quiz inside) */}
        <ProfileDimensionsSection />

        {/* Voting Insights */}
        <VotingInsights />

        {/* Menu Items */}
        <div className="glass rounded-2xl divide-y divide-border overflow-hidden">
          <SuggestPollDialog />
          {menuItems.map(({ icon: Icon, label, path, color, highlight }: any) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`w-full flex items-center gap-4 p-4 hover:bg-secondary/50 transition-colors last:rounded-b-2xl ${
                highlight ? 'bg-primary/5' : ''
              }`}
            >
              <Icon className={`h-5 w-5 ${color || 'text-card-foreground/70'}`} />
              <span className="flex-1 text-left font-medium">{label}</span>
              {highlight && (
                <span className="text-[9px] font-bold text-primary-foreground bg-primary px-2 py-0.5 rounded-full uppercase">New</span>
              )}
              <ChevronRight className="h-5 w-5 text-card-foreground/70" />
            </button>
          ))}
          {user?.email && <BiometricToggle email={user.email} />}
        </div>

        {/* Logout */}
        <Button
          variant="outline"
          className="w-full h-14 border-destructive text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          <LogOut className="mr-2 h-5 w-5" />
          {loggingOut ? 'Logging out…' : 'Log Out'}
        </Button>

        {/* Account deletion — required by Apple App Store Guideline 5.1.1(v) */}
        <div className="glass rounded-2xl overflow-hidden">
          <DeleteAccountButton />
        </div>
      </div>
    </AppLayout>
  );
}
