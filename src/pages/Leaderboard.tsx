import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Loader2, Trophy, Flame, Medal, Crown } from 'lucide-react';
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
}

export default function Leaderboard() {
  const { profile } = useAuth();

  const { data: pointsLeaderboard, isLoading: loadingPoints } = useQuery({
    queryKey: ['leaderboard-points'],
    queryFn: async () => {
      // Use secure RPC function to get leaderboard data (no PII exposed)
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
      // Use secure RPC function to get leaderboard data (no PII exposed)
      const { data, error } = await supabase.rpc('get_leaderboard', {
        order_by: 'current_streak',
        limit_count: 50
      });
      
      if (error) throw error;
      return data as LeaderboardUser[];
    },
  });

  const { data: votesLeaderboard, isLoading: loadingVotes } = useQuery({
    queryKey: ['leaderboard-votes'],
    queryFn: async () => {
      // Get vote counts per user
      const { data: votes, error: votesError } = await supabase
        .from('votes')
        .select('user_id');
      
      if (votesError) throw votesError;
      
      // Count votes per user
      const voteCounts: Record<string, number> = {};
      votes?.forEach(v => {
        voteCounts[v.user_id] = (voteCounts[v.user_id] || 0) + 1;
      });
      
      // Get user details for top voters using secure function
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

  // Collect all user IDs for verified check
  const allUserIds = [
    ...(pointsLeaderboard || []),
    ...(streakLeaderboard || []),
    ...(votesLeaderboard || []),
  ].map(u => u.id);
  const { isVerified } = useVerifiedUsers([...new Set(allUserIds)]);

  const getRankIcon = (rank: number) => {
    if (rank === 0) return <Crown className="h-5 w-5 text-yellow-400" />;
    if (rank === 1) return <Medal className="h-5 w-5 text-gray-300" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-amber-600" />;
    return <span className="w-5 text-center text-sm font-bold text-muted-foreground">{rank + 1}</span>;
  };

  const renderLeaderboard = (users: LeaderboardUser[] | undefined, loading: boolean, valueKey: 'points' | 'current_streak' | 'vote_count') => {
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
          const value = valueKey === 'vote_count' ? user.vote_count : user[valueKey];
          
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
                <p className={`font-semibold truncate ${isCurrentUser ? 'text-primary' : ''}`}>
                  @{user.username || 'anonymous'}
                  {isCurrentUser && <span className="text-xs ml-2 text-primary">(You)</span>}
                </p>
              </div>
              
              <div className="text-right">
                <p className="font-bold text-lg">
                  {valueKey === 'current_streak' ? (
                    <span className="flex items-center gap-1">
                      <Flame className="h-4 w-4 text-orange-500" />
                      {value}
                    </span>
                  ) : valueKey === 'vote_count' ? (
                    `${value} votes`
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

        <Tabs defaultValue="points" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="points" className="flex items-center gap-1.5">
              <Trophy className="h-4 w-4" />
              Insight
            </TabsTrigger>
            <TabsTrigger value="streak" className="flex items-center gap-1.5">
              <Flame className="h-4 w-4" />
              Streak
            </TabsTrigger>
            <TabsTrigger value="votes" className="flex items-center gap-1.5">
              <Medal className="h-4 w-4" />
              Votes
            </TabsTrigger>
          </TabsList>

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
