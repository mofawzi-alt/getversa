import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { 
  LogOut, ChevronRight, User, Trophy, 
  Palette, Bell, Shield, Award, Flame, Crown, Users 
} from 'lucide-react';
import { toast } from 'sonner';
import ProfileCompletionCard from '@/components/profile/ProfileCompletionCard';
import { useFriends } from '@/hooks/useFriends';

export default function Profile() {
  const { profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const { friendCount, pendingRequests } = useFriends();

  // Fetch user stats
  const { data: stats } = useQuery({
    queryKey: ['user-stats', profile?.id],
    queryFn: async () => {
      if (!profile) return null;
      
        const [votesResult, followersResult, followingResult, streakResult] = await Promise.all([
        supabase.from('votes').select('id', { count: 'exact' }).eq('user_id', profile.id),
        supabase.from('follows').select('id', { count: 'exact' }).eq('following_id', profile.id),
        supabase.from('follows').select('id', { count: 'exact' }).eq('follower_id', profile.id),
        supabase.from('users').select('current_streak, longest_streak').eq('id', profile.id).single(),
      ]);
      
      return {
        votes: votesResult.count || 0,
        followers: followersResult.count || 0,
        following: followingResult.count || 0,
        currentStreak: streakResult.data?.current_streak || 0,
        longestStreak: streakResult.data?.longest_streak || 0,
      };
    },
    enabled: !!profile,
  });

  // Fetch user badges count
  const { data: badgeCount } = useQuery({
    queryKey: ['user-badge-count', profile?.id],
    queryFn: async () => {
      if (!profile) return 0;
      
      const { count } = await supabase
        .from('user_badges')
        .select('id', { count: 'exact' })
        .eq('user_id', profile.id);
      
      return count || 0;
    },
    enabled: !!profile,
  });

  const handleLogout = async () => {
    await signOut();
    toast.success('Logged out successfully');
    navigate('/auth');
  };

  const menuItems = [
    { icon: Users, label: 'Friends', path: '/friends', color: 'text-primary', badge: pendingRequests.length > 0 ? pendingRequests.length : undefined },
    { icon: Trophy, label: 'Leaderboard', path: '/leaderboard', color: 'text-yellow-500' },
    { icon: Award, label: 'Badges & Achievements', path: '/badges', color: 'text-purple-500', badge: badgeCount },
    { icon: Crown, label: 'Creator Dashboard', path: '/creator', color: 'text-primary' },
    { icon: User, label: 'Edit Profile', path: '/profile/edit', color: 'text-muted-foreground' },
    { icon: Palette, label: 'Customize Theme', path: '/profile/customize', color: 'text-muted-foreground' },
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

          {/* Insight Score & Streak Badges */}
          <div className="flex items-center justify-center gap-3 mt-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20">
              <Trophy className="h-4 w-4 text-primary" />
              <span className="font-bold text-primary">{profile?.points || 0} insight</span>
            </div>
            {stats?.currentStreak !== undefined && stats.currentStreak > 0 && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/20">
                <Flame className="h-4 w-4 text-orange-500" />
                <span className="font-bold text-orange-500">{stats.currentStreak} day streak</span>
              </div>
            )}
          </div>
        </div>

        {/* Profile Completion Card */}
        <ProfileCompletionCard />

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Votes', value: stats?.votes || 0 },
            { label: 'Friends', value: friendCount, onClick: () => navigate('/friends') },
            { label: 'Followers', value: stats?.followers || 0 },
            { label: 'Following', value: stats?.following || 0 },
          ].map(({ label, value, onClick }) => (
            <div 
              key={label} 
              className={`glass rounded-xl p-3 text-center ${onClick ? 'cursor-pointer hover:bg-secondary/50 transition-colors' : ''}`}
              onClick={onClick}
            >
              <div className="text-xl font-bold">{value}</div>
              <div className="text-xs text-card-foreground/70">{label}</div>
            </div>
          ))}
        </div>

        {/* Menu Items */}
        <div className="glass rounded-2xl divide-y divide-border">
          {menuItems.map(({ icon: Icon, label, path, color, badge }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="w-full flex items-center gap-4 p-4 hover:bg-secondary/50 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
            >
              <Icon className={`h-5 w-5 ${color || 'text-card-foreground/70'}`} />
              <span className="flex-1 text-left font-medium">{label}</span>
              {badge !== undefined && badge > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-bold">
                  {badge}
                </span>
              )}
              <ChevronRight className="h-5 w-5 text-card-foreground/70" />
            </button>
          ))}
        </div>

        {/* Logout Button */}
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