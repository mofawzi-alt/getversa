import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import FollowButton from '@/components/poll/FollowButton';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ArrowLeft, Heart, Check, X, Users, 
  Trophy, TrendingUp, TrendingDown, Minus, Calendar, Loader2 
} from 'lucide-react';
import { format } from 'date-fns';
import UserAvatar from '@/components/UserAvatar';
import ShareToStoryButton from '@/components/stories/ShareToStoryButton';

interface CompatibilityTrend {
  overall_score: number | null;
  recent_score: number | null;
  older_score: number | null;
  trend: string;
  trend_change: number;
}

interface SharedVote {
  poll_id: string;
  question: string;
  option_a: string;
  option_b: string;
  user_a_choice: string;
  user_b_choice: string;
  is_match: boolean;
  voted_at: string;
}

export default function FriendComparison() {
  const { friendId } = useParams<{ friendId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const focusPollId = searchParams.get('focus');
  const focusedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (focusPollId && focusedRef.current) {
      focusedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusPollId]);

  // Get friend info
  const { data: friend, isLoading: loadingFriend } = useQuery({
    queryKey: ['friend-profile', friendId],
    queryFn: async () => {
      if (!friendId) return null;
      
      const { data, error } = await supabase
        .rpc('get_public_profiles', { user_ids: [friendId] });
      
      if (error) throw error;
      return data?.[0] || null;
    },
    enabled: !!friendId,
  });

  // Get current user's profile (for avatar)
  const { data: myProfile } = useQuery({
    queryKey: ['my-profile-avatar', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .rpc('get_public_profiles', { user_ids: [user.id] });
      if (error) throw error;
      return data?.[0] || null;
    },
    enabled: !!user,
  });

  // Get compatibility trend
  const { data: trendData } = useQuery({
    queryKey: ['compatibility-trend', user?.id, friendId],
    queryFn: async () => {
      if (!user || !friendId) return null;
      
      const { data, error } = await supabase
        .rpc('get_compatibility_trend', { 
          user_a: user.id, 
          user_b: friendId 
        });
      
      if (error) throw error;
      return (data?.[0] || null) as CompatibilityTrend | null;
    },
    enabled: !!user && !!friendId,
  });

  const compatibilityScore = trendData?.overall_score ?? null;

  // Get shared vote history
  const { data: sharedVotes = [], isLoading: loadingVotes } = useQuery({
    queryKey: ['shared-votes', user?.id, friendId],
    queryFn: async () => {
      if (!user || !friendId) return [];
      
      const { data, error } = await supabase
        .rpc('get_shared_vote_history', { 
          user_a: user.id, 
          user_b: friendId 
        });
      
      if (error) throw error;
      return (data || []) as SharedVote[];
    },
    enabled: !!user && !!friendId,
  });

  const matchingVotes = sharedVotes.filter(v => v.is_match).length;
  const totalVotes = sharedVotes.length;

  const getCompatibilityColor = (score: number | null) => {
    if (score === null) return 'text-muted-foreground';
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-primary';
    if (score >= 40) return 'text-yellow-500';
    return 'text-orange-500';
  };

  const getCompatibilityLabel = (score: number | null) => {
    if (score === null) return 'No shared votes yet';
    if (score >= 90) return 'Best Friends! 💕';
    if (score >= 75) return 'Great Match! 💫';
    if (score >= 50) return 'Vote Buddies 🤝';
    if (score >= 25) return 'Different Views';
    return 'Opposites';
  };

  const getCompatibilityGradient = (score: number | null) => {
    if (score === null) return 'from-muted to-muted';
    if (score >= 80) return 'from-green-500 to-emerald-400';
    if (score >= 60) return 'from-primary to-accent';
    if (score >= 40) return 'from-yellow-500 to-orange-400';
    return 'from-orange-500 to-red-400';
  };

  if (loadingFriend || loadingVotes) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!friend) {
    return (
      <AppLayout>
        <div className="p-4 text-center">
          <p className="text-muted-foreground">Friend not found</p>
          <Button onClick={() => navigate('/friends')} className="mt-4">
            Back to Friends
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 space-y-6 animate-slide-up">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/friends')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-display font-bold">Vote Comparison</h1>
        </div>

        {/* Friend Card with Compatibility */}
        <div className="glass rounded-3xl p-6 text-center">
          <div className="flex justify-center items-center gap-4 mb-4">
            {/* Your Avatar */}
            <UserAvatar
              url={(myProfile as any)?.avatar_url}
              username="you"
              className="w-16 h-16"
            />
            
            {/* Compatibility Heart */}
            <div className={`relative w-20 h-20 rounded-full bg-gradient-to-br ${getCompatibilityGradient(compatibilityScore)} flex items-center justify-center shadow-lg`}>
              <Heart className="h-8 w-8 text-white fill-current" />
              <div className="absolute -bottom-2 bg-background px-2 py-0.5 rounded-full border border-border">
                <span className="text-sm font-bold">
                  {compatibilityScore !== null ? `${compatibilityScore}%` : '—'}
                </span>
              </div>
            </div>
            
            {/* Friend Avatar */}
            <UserAvatar
              url={(friend as any)?.avatar_url}
              username={friend.username}
              className="w-16 h-16"
            />
          </div>
          
          <h2 className="text-lg font-semibold">@{friend.username}</h2>
          {friendId && (
            <div className="mt-2">
              <FollowButton creatorId={friendId} creatorName={friend.username} variant="compact" />
            </div>
          )}
          <p className={`text-sm ${getCompatibilityColor(compatibilityScore)} font-medium mt-1`}>
            {getCompatibilityLabel(compatibilityScore)}
          </p>
          
          {/* Trend Indicator */}
          {trendData && trendData.trend !== 'neutral' && (
            <div className="flex items-center justify-center gap-2 mt-2">
              {trendData.trend === 'up' ? (
                <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-green-500/20 text-green-500">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs font-medium">+{trendData.trend_change}% this month</span>
                </div>
              ) : trendData.trend === 'down' ? (
                <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-orange-500/20 text-orange-500">
                  <TrendingDown className="h-4 w-4" />
                  <span className="text-xs font-medium">{trendData.trend_change}% this month</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-muted text-muted-foreground">
                  <Minus className="h-4 w-4" />
                  <span className="text-xs font-medium">Stable</span>
                </div>
              )}
            </div>
          )}
          
          {/* Stats */}
          <div className="flex justify-center gap-6 mt-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-green-500">
                <Check className="h-4 w-4" />
                <span className="font-bold">{matchingVotes}</span>
              </div>
              <span className="text-xs text-muted-foreground">Matches</span>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-orange-500">
                <X className="h-4 w-4" />
                <span className="font-bold">{totalVotes - matchingVotes}</span>
              </div>
              <span className="text-xs text-muted-foreground">Different</span>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-primary">
                <TrendingUp className="h-4 w-4" />
                <span className="font-bold">{totalVotes}</span>
              </div>
              <span className="text-xs text-muted-foreground">Shared</span>
            </div>
          </div>
          
          {/* Recent vs Overall Comparison */}
          {trendData && trendData.recent_score !== null && trendData.older_score !== null && (
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">Last 30 days</div>
                <div className={`text-lg font-bold ${getCompatibilityColor(trendData.recent_score)}`}>
                  {trendData.recent_score}%
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">Before that</div>
                <div className={`text-lg font-bold ${getCompatibilityColor(trendData.older_score)}`}>
                  {trendData.older_score}%
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Vote History */}
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Shared Vote History
          </h3>
          
          {sharedVotes.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No shared polls yet</h3>
              <p className="text-sm text-muted-foreground">
                Vote on more polls to see how you compare!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sharedVotes.map((vote) => {
                const isFocused = focusPollId === vote.poll_id;
                return (
                <div
                  key={vote.poll_id}
                  ref={isFocused ? focusedRef : undefined}
                  className={`glass rounded-xl p-4 border-l-4 transition-all ${
                    vote.is_match
                      ? 'border-l-green-500 bg-green-500/5'
                      : 'border-l-orange-500 bg-orange-500/5'
                  } ${isFocused ? 'ring-2 ring-primary shadow-lg' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Match indicator */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      vote.is_match 
                        ? 'bg-green-500/20 text-green-500' 
                        : 'bg-orange-500/20 text-orange-500'
                    }`}>
                      {vote.is_match ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm mb-2 line-clamp-2">
                        {vote.question}
                      </p>
                      
                      <div className="flex items-center gap-4 text-xs">
                        {/* Your vote */}
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">You:</span>
                          <span className={`font-medium px-2 py-0.5 rounded ${
                            vote.user_a_choice === 'A' 
                              ? 'bg-option-a/20 text-option-a' 
                              : 'bg-option-b/20 text-option-b'
                          }`}>
                            {vote.user_a_choice === 'A' ? vote.option_a : vote.option_b}
                          </span>
                        </div>
                        
                        {/* Friend's vote */}
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">@{friend.username}:</span>
                          <span className={`font-medium px-2 py-0.5 rounded ${
                            vote.user_b_choice === 'A' 
                              ? 'bg-option-a/20 text-option-a' 
                              : 'bg-option-b/20 text-option-b'
                          }`}>
                            {vote.user_b_choice === 'A' ? vote.option_a : vote.option_b}
                          </span>
                        </div>
                      </div>
                      
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(new Date(vote.voted_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
