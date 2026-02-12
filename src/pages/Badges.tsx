import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Loader2, Award, Lock, CheckCircle2, Star, Flame, Vote, Share2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface Badge {
  id: string;
  name: string;
  description: string;
  icon_url: string | null;
  badge_type: string;
  requirement_value: number;
  points_reward: number;
}

interface UserBadge {
  badge_id: string;
  earned_at: string;
}

export default function Badges() {
  const { profile } = useAuth();

  const { data: badges, isLoading: loadingBadges } = useQuery({
    queryKey: ['badges'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('badges')
        .select('*')
        .order('requirement_value', { ascending: true });
      
      if (error) throw error;
      return data as Badge[];
    },
  });

  const { data: userBadges, isLoading: loadingUserBadges } = useQuery({
    queryKey: ['user-badges', profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      
      const { data, error } = await supabase
        .from('user_badges')
        .select('badge_id, earned_at')
        .eq('user_id', profile.id);
      
      if (error) throw error;
      return data as UserBadge[];
    },
    enabled: !!profile,
  });

  const { data: userProgress } = useQuery({
    queryKey: ['badge-progress', profile?.id],
    queryFn: async () => {
      if (!profile) return null;
      
      // Get vote count
      const { count: voteCount } = await supabase
        .from('votes')
        .select('id', { count: 'exact' })
        .eq('user_id', profile.id);
      
      // Get current streak from profile
      const { data: userData } = await supabase
        .from('users')
        .select('current_streak, longest_streak')
        .eq('id', profile.id)
        .single();
      
      return {
        votes: voteCount || 0,
        streak: userData?.current_streak || 0,
        shares: 0, // TODO: Track shares
      };
    },
    enabled: !!profile,
  });

  const earnedBadgeIds = new Set(userBadges?.map(ub => ub.badge_id) || []);

  const getBadgeIcon = (type: string) => {
    switch (type) {
      case 'votes': return Vote;
      case 'streak': return Flame;
      case 'shares': return Share2;
      case 'special': return Star;
      default: return Award;
    }
  };

  const getProgress = (badge: Badge) => {
    if (!userProgress) return 0;
    
    let current = 0;
    switch (badge.badge_type) {
      case 'votes':
        current = userProgress.votes;
        break;
      case 'streak':
        current = userProgress.streak;
        break;
      case 'shares':
        current = userProgress.shares;
        break;
      default:
        current = 0;
    }
    
    return Math.min((current / badge.requirement_value) * 100, 100);
  };

  const getCurrentValue = (badge: Badge) => {
    if (!userProgress) return 0;
    
    switch (badge.badge_type) {
      case 'votes':
        return userProgress.votes;
      case 'streak':
        return userProgress.streak;
      case 'shares':
        return userProgress.shares;
      default:
        return 0;
    }
  };

  if (loadingBadges || loadingUserBadges) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const earnedCount = earnedBadgeIds.size;
  const totalCount = badges?.length || 0;

  return (
    <AppLayout>
      <div className="p-4 space-y-6 animate-slide-up">
        <header className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 mb-4">
            <Award className="h-5 w-5 text-primary" />
            <span className="font-bold text-primary">Achievements</span>
          </div>
          <h1 className="text-2xl font-display font-bold">Your Badges</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {earnedCount} of {totalCount} badges earned
          </p>
          
          <div className="mt-4 max-w-xs mx-auto">
            <Progress value={(earnedCount / totalCount) * 100} className="h-2" />
          </div>
        </header>

        <div className="grid grid-cols-2 gap-4">
          {badges?.map(badge => {
            const isEarned = earnedBadgeIds.has(badge.id);
            const IconComponent = getBadgeIcon(badge.badge_type);
            const progress = getProgress(badge);
            const currentValue = getCurrentValue(badge);
            
            return (
              <div
                key={badge.id}
                className={`relative p-4 rounded-2xl border-2 transition-all ${
                  isEarned 
                    ? 'bg-gradient-to-br from-primary/20 to-primary/5 border-primary shadow-lg' 
                    : 'bg-card/50 border-border/50 opacity-75'
                }`}
              >
                {isEarned && (
                  <div className="absolute -top-2 -right-2">
                    <CheckCircle2 className="h-6 w-6 text-primary fill-background" />
                  </div>
                )}
                
                <div className={`w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center ${
                  isEarned 
                    ? 'bg-gradient-primary' 
                    : 'bg-muted'
                }`}>
                  {isEarned ? (
                    <IconComponent className="h-7 w-7 text-primary-foreground" />
                  ) : (
                    <Lock className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                
                <h3 className="font-bold text-center text-sm mb-1">{badge.name}</h3>
                <p className="text-xs text-center text-muted-foreground mb-2">
                  {badge.description}
                </p>
                
                {!isEarned && badge.badge_type !== 'special' && (
                  <div className="space-y-1">
                    <Progress value={progress} className="h-1.5" />
                    <p className="text-xs text-center text-muted-foreground">
                      {currentValue} / {badge.requirement_value}
                    </p>
                  </div>
                )}
                
                {isEarned && badge.points_reward > 0 && (
                  <div className="text-xs text-center text-primary font-medium mt-2">
                    +{badge.points_reward} insight earned
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
