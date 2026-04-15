import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Loader2, Trophy, Flame, Medal, Crown, Calendar, Target } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useVerifiedUsers } from '@/hooks/useVerifiedUsers';
import VerifiedBadge from '@/components/VerifiedBadge';

interface LeaderboardUser {
  id: string;
  username: string | null;
  points: number;
  current_streak: number;
  longest_streak: number;
  vote_count?: number;
  weekly_points?: number;
}

export default function Leaderboard() {
  const { profile } = useAuth();

  const { data: pointsLeaderboard, isLoading: loadingPoints } = useQuery({
    queryKey: ['leaderboard-points'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_leaderboard', {
        order_by: 'points',
        limit_count: 50
      });
      if (error) throw error;
      return data as LeaderboardUser[];
    },
  });

  const { data: streakLeaderboard, isLoading: loadingStreak } = useQuery({
    queryKey: ['leaderboard-streak'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_leaderboard', {
        order_by: 'current_streak',
        limit_count: 50
      });
      if (error) throw error;
      return data as LeaderboardUser[];
    },
  });

  // Weekly leaderboard — current week's votes
  const { data: weeklyLeaderboard, isLoading: loadingWeekly } = useQuery({
    queryKey: ['leaderboard-weekly'],
    queryFn: async () => {
      // Get current week start (Sunday)
      const now = new Date();
      const dayOfWeek = now.getUTCDay(); // 0=Sun
      const sunday = new Date(now);
      sunday.setUTCDate(now.getUTCDate() - dayOfWeek);
      sunday.setUTCHours(0, 0, 0, 0);

      const { data: votes } = await supabase
        .from('votes')
        .select('user_id')
        .gte('created_at', sunday.toISOString());

      if (!votes || votes.length === 0) return [];

      const pointsMap: Record<string, number> = {};
      votes.forEach(v => {
        pointsMap[v.user_id] = (pointsMap[v.user_id] || 0) + 5;
      });

      const topIds = Object.entries(pointsMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 50)
        .map(([id]) => id);

      if (topIds.length === 0) return [];

      const { data: users } = await supabase.rpc('get_public_profiles', { user_ids: topIds });

      return (users || [])
        .map((u: any) => ({ ...u, weekly_points: pointsMap[u.id] || 0 }))
        .sort((a: LeaderboardUser, b: LeaderboardUser) => (b.weekly_points || 0) - (a.weekly_points || 0)) as LeaderboardUser[];
    },
  });

  const { data: votesLeaderboard, isLoading: loadingVotes } = useQuery({
    queryKey: ['leaderboard-votes'],
    queryFn: async () => {
      const { data: votes, error: votesError } = await supabase
        .from('votes')
        .select('user_id');
      if (votesError) throw votesError;
      
      const voteCounts: Record<string, number> = {};
      votes?.forEach(v => {
        voteCounts[v.user_id] = (voteCounts[v.user_id] || 0) + 1;
      });
      
      const topUserIds = Object.entries(voteCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 50)
        .map(([id]) => id);
      
      if (topUserIds.length === 0) return [];
      
      const { data: users, error: usersError } = await supabase.rpc('get_public_profiles', {
        user_ids: topUserIds
      });
      if (usersError) throw usersError;
      
      return (users || [])
        .map((u: any) => ({ ...u, vote_count: voteCounts[u.id] || 0 }))
        .sort((a: LeaderboardUser, b: LeaderboardUser) => (b.vote_count || 0) - (a.vote_count || 0)) as LeaderboardUser[];
    },
  });

  const allUserIds = [
    ...(pointsLeaderboard || []),
    ...(streakLeaderboard || []),
    ...(votesLeaderboard || []),
    ...(weeklyLeaderboard || []),
  ].map(u => u.id);
  const { isVerified } = useVerifiedUsers([...new Set(allUserIds)]);

  const getRankIcon = (rank: number) => {
    if (rank === 0) return <Crown className="h-5 w-5 text-yellow-400" />;
    if (rank === 1) return <Medal className="h-5 w-5 text-gray-300" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-amber-600" />;
    return <span className="w-5 text-center text-sm font-bold text-muted-foreground">{rank + 1}</span>;
  };

  const renderLeaderboard = (users: LeaderboardUser[] | undefined, loading: boolean, valueKey: 'points' | 'current_streak' | 'vote_count' | 'weekly_points') => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    if (!users || users.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          No data yet. Be the first!
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {users.map((user, index) => {
          const isCurrentUser = user.id === profile?.id;
          const value = user[valueKey as keyof LeaderboardUser];
          
          return (
            <div
              key={user.id}
              className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                isCurrentUser 
                  ? 'bg-primary/20 ring-2 ring-primary' 
                  : index < 3 
                    ? 'bg-gradient-to-r from-secondary/50 to-secondary/20' 
                    : 'bg-card/50'
              }`}
            >
              <div className="w-8 flex justify-center">
                {getRankIcon(index)}
              </div>
              
              <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-primary-foreground">
                  {user.username?.[0]?.toUpperCase() || '?'}
                </span>
              </div>
              
              <div className="flex-1 min-w-0">
                <p className={`font-semibold truncate flex items-center gap-1 ${isCurrentUser ? 'text-primary' : ''}`}>
                  @{user.username || 'anonymous'}
                  {isVerified(user.id) && <VerifiedBadge size="sm" />}
                  {isCurrentUser && <span className="text-xs ml-1 text-primary">(You)</span>}
                </p>
              </div>
              
              <div className="text-right">
                <p className="font-bold text-lg">
                  {valueKey === 'current_streak' ? (
                    <span className="flex items-center gap-1">
                      <Flame className="h-4 w-4 text-orange-500" />
                      {value as number}
                    </span>
                  ) : valueKey === 'vote_count' ? (
                    `${value} votes`
                  ) : valueKey === 'weekly_points' ? (
                    `${value} pts`
                  ) : (
                    `${value} pts`
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Get days remaining until next Sunday reset
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun
  const daysLeft = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;

  return (
    <AppLayout>
      <div className="p-4 space-y-6 animate-slide-up">
        <header className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 mb-4">
            <Trophy className="h-5 w-5 text-primary" />
            <span className="font-bold text-primary">Leaderboard</span>
          </div>
          <h1 className="text-2xl font-display font-bold">Top Voters</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Compete with other voters and climb the ranks!
          </p>
        </header>

        <Tabs defaultValue="weekly" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="weekly" className="flex items-center gap-1 text-xs">
              <Calendar className="h-3.5 w-3.5" />
              Weekly
            </TabsTrigger>
            <TabsTrigger value="points" className="flex items-center gap-1 text-xs">
              <Trophy className="h-3.5 w-3.5" />
              All-Time
            </TabsTrigger>
            <TabsTrigger value="streak" className="flex items-center gap-1 text-xs">
              <Flame className="h-3.5 w-3.5" />
              Streak
            </TabsTrigger>
            <TabsTrigger value="votes" className="flex items-center gap-1 text-xs">
              <Medal className="h-3.5 w-3.5" />
              Votes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="weekly">
            {daysLeft > 0 && (
              <div className="text-center mb-4 px-4 py-2 rounded-full bg-primary/10 text-sm text-primary font-medium">
                ⏳ {daysLeft} day{daysLeft > 1 ? 's' : ''} left this week — keep voting!
              </div>
            )}
            {renderLeaderboard(weeklyLeaderboard, loadingWeekly, 'weekly_points')}
          </TabsContent>

          <TabsContent value="points">
            {renderLeaderboard(pointsLeaderboard, loadingPoints, 'points')}
          </TabsContent>

          <TabsContent value="streak">
            {renderLeaderboard(streakLeaderboard, loadingStreak, 'current_streak')}
          </TabsContent>

          <TabsContent value="votes">
            {renderLeaderboard(votesLeaderboard, loadingVotes, 'vote_count')}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
