import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import BlendedCompatibility from '@/components/compare/BlendedCompatibility';
import { Button } from '@/components/ui/button';
import { ArrowLeft, LogIn, UserPlus, UserCheck, Loader2 } from 'lucide-react';
import { useFriends } from '@/hooks/useFriends';
import { useFollows } from '@/hooks/useFollows';

export default function CompareUser() {
  const { userId } = useParams<{ userId: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { friends, sendRequest } = useFriends();
  const { isFollowing, toggleFollow } = useFollows();

  const isSelf = user?.id === userId;

  // Fetch target user's public profile
  const { data: targetUser, isLoading } = useQuery({
    queryKey: ['public-profile', userId],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_public_profiles', { user_ids: [userId!] });
      return data?.[0] || null;
    },
    enabled: !!userId,
  });

  const isFriend = friends.some(f => f.friend_id === userId);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!targetUser) {
    return (
      <AppLayout>
        <div className="p-4 text-center pt-20">
          <p className="text-lg font-semibold mb-2">User not found</p>
          <Button variant="outline" onClick={() => navigate('/home')}>Go Home</Button>
        </div>
      </AppLayout>
    );
  }

  // Not logged in — prompt to sign up
  if (!user) {
    return (
      <AppLayout>
        <div className="p-4 space-y-6 animate-slide-up">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-display font-bold">Compatibility</h1>
          </div>

          <div className="glass rounded-3xl p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <span className="text-2xl font-bold text-primary">
                {targetUser.username?.[0]?.toUpperCase() || '?'}
              </span>
            </div>
            <h2 className="text-lg font-bold">@{targetUser.username}</h2>
            <p className="text-sm text-muted-foreground">
              Join Versa to see how compatible you are with @{targetUser.username}!
            </p>
            <Button onClick={() => navigate('/auth')} className="w-full h-12">
              <LogIn className="h-4 w-4 mr-2" />
              Join to Compare
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Self link
  if (isSelf) {
    return (
      <AppLayout>
        <div className="p-4 space-y-6 animate-slide-up">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-display font-bold">Your Link</h1>
          </div>
          <div className="glass rounded-3xl p-8 text-center space-y-3">
            <p className="text-lg">🔗</p>
            <p className="text-sm text-muted-foreground">
              This is your comparison link! Share it with friends to see your compatibility.
            </p>
            <Button variant="outline" onClick={() => navigate('/profile')}>
              Go to Profile
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 space-y-4 animate-slide-up">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-display font-bold">Compatibility</h1>
            <p className="text-xs text-muted-foreground">You & @{targetUser.username}</p>
          </div>
          {/* Social actions */}
          <div className="flex gap-2">
            {!isFriend && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => userId && sendRequest(userId)}
                className="text-xs"
              >
                <UserPlus className="h-3.5 w-3.5 mr-1" />
                Add
              </Button>
            )}
            <Button
              variant={isFollowing(userId!) ? 'ghost' : 'outline'}
              size="sm"
              onClick={() => userId && toggleFollow(userId)}
              className="text-xs"
            >
              {isFollowing(userId!) ? (
                <><UserCheck className="h-3.5 w-3.5 mr-1" /> Following</>
              ) : (
                <><UserPlus className="h-3.5 w-3.5 mr-1" /> Follow</>
              )}
            </Button>
          </div>
        </div>

        {/* Blended Compatibility */}
        <BlendedCompatibility
          userAId={user.id}
          userBId={userId!}
          userBUsername={targetUser.username}
        />

        {/* Navigate to full profile */}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => navigate(`/user/${userId}`)}
        >
          View @{targetUser.username}'s Profile
        </Button>
      </div>
    </AppLayout>
  );
}
