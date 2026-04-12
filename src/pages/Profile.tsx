import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { LogOut, ChevronRight, User, Bell, Shield, Flame, History, Sparkles, Users, UserPlus, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import ProfileDimensionsSection from '@/components/profile/ProfileDimensionsSection';
import VotingInsights from '@/components/profile/VotingInsights';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useFollows } from '@/hooks/useFollows';

export default function Profile() {
  const { profile, isAdmin, signOut, user } = useAuth();
  const navigate = useNavigate();
  const { following, isFollowing, toggleFollow } = useFollows();
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);

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

  // Follower count
  const { data: followerCount = 0 } = useQuery({
    queryKey: ['follower-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase.from('follows').select('id', { count: 'exact' }).eq('following_id', user.id);
      return count || 0;
    },
    enabled: !!user,
  });

  // Following count
  const followingCount = following.length;

  // Followers list
  const { data: followersList = [] } = useQuery({
    queryKey: ['followers-list', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from('follows').select('follower_id').eq('following_id', user.id);
      if (!data || data.length === 0) return [];
      const ids = data.map(f => f.follower_id);
      const { data: profiles } = await supabase.rpc('get_public_profiles', { user_ids: ids });
      return profiles || [];
    },
    enabled: !!user && showFollowers,
  });

  // Following list
  const { data: followingList = [] } = useQuery({
    queryKey: ['following-list', user?.id],
    queryFn: async () => {
      if (!user || following.length === 0) return [];
      const { data: profiles } = await supabase.rpc('get_public_profiles', { user_ids: following });
      return profiles || [];
    },
    enabled: !!user && showFollowing && following.length > 0,
  });

  const handleLogout = async () => {
    await signOut();
    toast.success('Logged out successfully');
    navigate('/auth');
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

          {/* Followers / Following counts */}
          <div className="flex items-center justify-center gap-6 mt-4">
            <button onClick={() => setShowFollowers(true)} className="flex flex-col items-center">
              <span className="text-lg font-bold text-foreground">{followerCount}</span>
              <span className="text-[10px] text-muted-foreground">Followers</span>
            </button>
            <div className="w-px h-8 bg-border" />
            <button onClick={() => setShowFollowing(true)} className="flex flex-col items-center">
              <span className="text-lg font-bold text-foreground">{followingCount}</span>
              <span className="text-[10px] text-muted-foreground">Following</span>
            </button>
          </div>

          {stats?.currentStreak !== undefined && stats.currentStreak > 0 && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-warning/20 mt-4">
              <Flame className="h-4 w-4 text-warning" />
              <span className="font-bold text-warning">{stats.currentStreak} day streak</span>
            </div>
          )}
        </div>

        {/* Your Dimensions (with quiz inside) */}
        <ProfileDimensionsSection />

        {/* Voting Insights */}
        <VotingInsights />

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
          {menuItems.map(({ icon: Icon, label, path, color, highlight }: any) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`w-full flex items-center gap-4 p-4 hover:bg-secondary/50 transition-colors first:rounded-t-2xl last:rounded-b-2xl ${
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

      {/* Followers Dialog */}
      <Dialog open={showFollowers} onOpenChange={setShowFollowers}>
        <DialogContent className="max-w-sm rounded-2xl">
          <h2 className="text-lg font-bold text-foreground mb-3">Followers</h2>
          {followersList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No followers yet</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {followersList.map((u: any) => (
                <div key={u.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-secondary/50">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 cursor-pointer" onClick={() => { setShowFollowers(false); navigate(`/user/${u.id}`); }}>
                    <span className="text-sm font-bold text-primary">{u.username?.[0]?.toUpperCase() || '?'}</span>
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setShowFollowers(false); navigate(`/user/${u.id}`); }}>
                    <p className="text-sm font-semibold text-foreground truncate">@{u.username || 'user'}</p>
                    <p className="text-[10px] text-muted-foreground">{u.points || 0} points</p>
                  </div>
                  {!isFollowing(u.id) ? (
                    <button onClick={() => toggleFollow(u.id)} className="text-[10px] font-bold text-primary-foreground bg-primary px-3 py-1.5 rounded-full flex items-center gap-1">
                      <UserPlus className="h-3 w-3" /> Follow
                    </button>
                  ) : (
                    <button onClick={() => toggleFollow(u.id)} className="text-[10px] font-medium text-muted-foreground bg-muted px-3 py-1.5 rounded-full flex items-center gap-1">
                      <UserCheck className="h-3 w-3" /> Following
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Following Dialog */}
      <Dialog open={showFollowing} onOpenChange={setShowFollowing}>
        <DialogContent className="max-w-sm rounded-2xl">
          <h2 className="text-lg font-bold text-foreground mb-3">Following</h2>
          {followingList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Not following anyone yet</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {followingList.map((u: any) => (
                <div key={u.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-secondary/50">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 cursor-pointer" onClick={() => { setShowFollowing(false); navigate(`/user/${u.id}`); }}>
                    <span className="text-sm font-bold text-primary">{u.username?.[0]?.toUpperCase() || '?'}</span>
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setShowFollowing(false); navigate(`/user/${u.id}`); }}>
                    <p className="text-sm font-semibold text-foreground truncate">@{u.username || 'user'}</p>
                    <p className="text-[10px] text-muted-foreground">{u.points || 0} points</p>
                  </div>
                  <button onClick={() => toggleFollow(u.id)} className="text-[10px] font-medium text-muted-foreground bg-muted px-3 py-1.5 rounded-full flex items-center gap-1">
                    <UserCheck className="h-3 w-3" /> Following
                  </button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
