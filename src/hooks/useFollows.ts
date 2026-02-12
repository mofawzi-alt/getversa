import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface FollowedCreator {
  id: string;
  username: string | null;
  created_at: string;
}

export function useFollows() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get users this user is following
  const { data: following = [], isLoading: loadingFollowing } = useQuery({
    queryKey: ['following', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('follows')
        .select('following_id, created_at')
        .eq('follower_id', user.id);
      
      if (error) throw error;
      return data.map(f => f.following_id);
    },
    enabled: !!user,
  });

  // Get follower count for a specific user
  const useFollowerCount = (userId: string | undefined) => {
    return useQuery({
      queryKey: ['follower-count', userId],
      queryFn: async () => {
        if (!userId) return 0;
        
        const { count, error } = await supabase
          .from('follows')
          .select('id', { count: 'exact' })
          .eq('following_id', userId);
        
        if (error) throw error;
        return count || 0;
      },
      enabled: !!userId,
    });
  };

  // Get following count for a specific user
  const useFollowingCount = (userId: string | undefined) => {
    return useQuery({
      queryKey: ['following-count', userId],
      queryFn: async () => {
        if (!userId) return 0;
        
        const { count, error } = await supabase
          .from('follows')
          .select('id', { count: 'exact' })
          .eq('follower_id', userId);
        
        if (error) throw error;
        return count || 0;
      },
      enabled: !!userId,
    });
  };

  // Check if following a specific user
  const isFollowing = (creatorId: string) => {
    return following.includes(creatorId);
  };

  // Follow mutation
  const followMutation = useMutation({
    mutationFn: async (creatorId: string) => {
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('follows')
        .insert({
          follower_id: user.id,
          following_id: creatorId,
        });
      
      if (error) throw error;
      
      // Create notification for the creator
      await supabase
        .from('notifications')
        .insert({
          user_id: creatorId,
          title: 'New Follower!',
          body: 'Someone started following your polls',
          type: 'new_follower',
          data: { follower_id: user.id },
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['following'] });
      queryClient.invalidateQueries({ queryKey: ['follower-count'] });
      toast.success('Following creator!');
    },
    onError: (error: any) => {
      if (error.message?.includes('duplicate')) {
        toast.info('Already following this creator');
      } else {
        toast.error('Failed to follow');
      }
    },
  });

  // Unfollow mutation
  const unfollowMutation = useMutation({
    mutationFn: async (creatorId: string) => {
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', creatorId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['following'] });
      queryClient.invalidateQueries({ queryKey: ['follower-count'] });
      toast.success('Unfollowed creator');
    },
    onError: () => {
      toast.error('Failed to unfollow');
    },
  });

  const toggleFollow = (creatorId: string) => {
    if (isFollowing(creatorId)) {
      unfollowMutation.mutate(creatorId);
    } else {
      followMutation.mutate(creatorId);
    }
  };

  return {
    following,
    loadingFollowing,
    isFollowing,
    toggleFollow,
    followMutation,
    unfollowMutation,
    useFollowerCount,
    useFollowingCount,
  };
}
