import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { LogOut, ChevronRight, User, Bell, Shield, Flame, History, Eye } from 'lucide-react';
import { toast } from 'sonner';
import ProfileCompletionCard from '@/components/profile/ProfileCompletionCard';

export default function Profile() {
  const { profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['user-stats', profile?.id],
    queryFn: async () => {
      if (!profile) return null;
      
      const [votesResult, streakResult] = await Promise.all([
        supabase.from('votes').select('id', { count: 'exact' }).eq('user_id', profile.id),
        supabase.from('users').select('current_streak, longest_streak').eq('id', profile.id).single(),
      ]);
      
      return {
        votes: votesResult.count || 0,
        currentStreak: streakResult.data?.current_streak || 0,
        longestStreak: streakResult.data?.longest_streak || 0,
      };
    },
    enabled: !!profile,
  });

  const handleLogout = async () => {
    await signOut();
    toast.success('Logged out successfully');
    navigate('/auth');
  };

  const menuItems = [
    { icon: History, label: 'My Votes', path: '/history', color: 'text-primary' },
    { icon: Eye, label: 'Your Dimensions', path: '/insights', color: 'text-primary' },
    { icon: User, label: 'Edit Profile', path: '/profile/edit', color: 'text-muted-foreground' },
    { icon: Bell, label: 'Notification Settings', path: '/profile/notifications', color: 'text-muted-foreground' },
    ...(isAdmin ? [{ icon: Shield, label: 'Admin Dashboard', path: '/admin', color: 'text-destructive' }] : []),
  ];

  return (
    <AppLayout>
      <div className="p-4 space-y-6 animate-slide-up">
        {/* Profile Header */}
        <div className="glass rounded-3xl p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-primary mx-auto mb-4 flex items-center justify-center">
            <span className="text-3xl font-display font-bold text-primary-foreground">
              {profile?.username?.[0]?.toUpperCase() || '?'}
            </span>
          </div>
          
          <h1 className="text-2xl font-display font-bold">
            @{profile?.username || 'user'}
          </h1>
          
          <p className="text-card-foreground/70 text-sm mt-1">
            {profile?.country || 'Unknown location'}
          </p>

          {/* Streak */}
          {stats?.currentStreak !== undefined && stats.currentStreak > 0 && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-warning/20 mt-4">
              <Flame className="h-4 w-4 text-warning" />
              <span className="font-bold text-warning">{stats.currentStreak} day streak</span>
            </div>
          )}
        </div>

        {/* Profile Completion Card */}
        <ProfileCompletionCard />

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass rounded-xl p-4 text-center">
            <div className="text-2xl font-bold">{stats?.votes || 0}</div>
            <div className="text-xs text-card-foreground/70">Total Votes</div>
          </div>
          <div className="glass rounded-xl p-4 text-center">
            <div className="text-2xl font-bold">{profile?.points || 0}</div>
            <div className="text-xs text-card-foreground/70">Insight Points</div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="glass rounded-2xl divide-y divide-border">
          {menuItems.map(({ icon: Icon, label, path, color }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="w-full flex items-center gap-4 p-4 hover:bg-secondary/50 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
            >
              <Icon className={`h-5 w-5 ${color || 'text-card-foreground/70'}`} />
              <span className="flex-1 text-left font-medium">{label}</span>
              <ChevronRight className="h-5 w-5 text-card-foreground/70" />
            </button>
          ))}
        </div>

        {/* Logout */}
        <Button
          variant="outline"
          className="w-full h-14 border-destructive text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-5 w-5" />
          Log Out
        </Button>
      </div>
    </AppLayout>
  );
}
