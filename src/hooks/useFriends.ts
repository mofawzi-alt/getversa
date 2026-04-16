import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Friend {
  friend_id: string;
  friend_username: string | null;
  friend_points: number | null;
  compatibility_score: number | null;
  recent_score: number | null;
  trend: string | null;
  trend_change: number | null;
  friendship_created_at: string;
}

export interface FriendVote {
  friend_id: string;
  friend_username: string | null;
  choice: string | null;
  compatibility_score: number | null;
}

export interface SearchResult {
  id: string;
  username: string | null;
  points: number | null;
  friendship_status: string;
}

export interface SimilarVoter {
  user_id: string;
  username: string | null;
  points: number | null;
  shared_polls: number;
  matching_votes: number;
  similarity_score: number;
}

export interface FriendRequest {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: string;
  created_at: string;
  requester_username?: string;
}

export function useFriends() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get all friends with compatibility scores and trends
  const { data: friends = [], isLoading: loadingFriends, refetch: refetchFriends } = useQuery({
    queryKey: ['friends', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .rpc('get_friends_with_trends', { p_user_id: user.id });
      
      if (error) throw error;
      return (data || []) as Friend[];
    },
    enabled: !!user,
  });

  // Get similar voters (suggested friends)
  const { data: suggestedFriends = [], isLoading: loadingSuggested } = useQuery({
    queryKey: ['suggested-friends', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .rpc('get_similar_voters', { p_user_id: user.id, p_limit: 10 });
      
      if (error) throw error;
      return (data || []) as SimilarVoter[];
    },
    enabled: !!user,
  });

  // Get pending friend requests received
  const { data: pendingRequests = [], isLoading: loadingRequests } = useQuery({
    queryKey: ['friend-requests', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('friendships')
        .select('*')
        .eq('recipient_id', user.id)
        .eq('status', 'pending');
      
      if (error) throw error;

      // Get usernames for requesters
      const requestsWithUsernames = await Promise.all(
        data.map(async (request) => {
          const { data: userData } = await supabase
            .rpc('get_public_profiles', { user_ids: [request.requester_id] });
          return {
            ...request,
            requester_username: userData?.[0]?.username || 'Unknown'
          };
        })
      );
      
      return requestsWithUsernames as FriendRequest[];
    },
    enabled: !!user,
  });

  // Get sent pending requests (with recipient usernames)
  const { data: sentRequests = [], isLoading: loadingSentRequests } = useQuery({
    queryKey: ['sent-friend-requests', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('friendships')
        .select('*')
        .eq('requester_id', user.id)
        .eq('status', 'pending');
      
      if (error) throw error;

      const withUsernames = await Promise.all(
        (data || []).map(async (request) => {
          const { data: userData } = await supabase
            .rpc('get_public_profiles', { user_ids: [request.recipient_id] });
          return {
            ...request,
            recipient_username: userData?.[0]?.username || 'Unknown',
            recipient_points: userData?.[0]?.points || 0,
          };
        })
      );

      return withUsernames as (FriendRequest & { recipient_username: string; recipient_points: number })[];
    },
    enabled: !!user,
  });

  // Search users by username
  const searchUsers = async (searchTerm: string): Promise<SearchResult[]> => {
    if (!user || !searchTerm.trim()) return [];
    
    const { data, error } = await supabase
      .rpc('search_users_by_username', { 
        search_term: searchTerm.trim(),
        current_user_id: user.id 
      });
    
    if (error) throw error;
    return (data || []) as SearchResult[];
  };

  // Get friend votes on a specific poll
  const useFriendVotes = (pollId: string | undefined) => {
    return useQuery({
      queryKey: ['friend-votes', user?.id, pollId],
      queryFn: async () => {
        if (!user || !pollId) return [];
        
        const { data, error } = await supabase
          .rpc('get_friend_votes', { 
            p_user_id: user.id,
            p_poll_id: pollId 
          });
        
        if (error) throw error;
        return (data || []) as FriendVote[];
      },
      enabled: !!user && !!pollId,
    });
  };

  // Send friend request
  const sendRequestMutation = useMutation({
    mutationFn: async (recipientId: string) => {
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('friendships')
        .insert({
          requester_id: user.id,
          recipient_id: recipientId,
        });
      
      if (error) throw error;

      // Create notification for recipient
      await supabase
        .from('notifications')
        .insert({
          user_id: recipientId,
          title: 'New Friend Request!',
          body: 'Someone wants to be your friend',
          type: 'friend_request',
          data: { requester_id: user.id },
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sent-friend-requests'] });
      toast.success('Friend request sent!');
    },
    onError: (error: any) => {
      if (error.message?.includes('duplicate')) {
        toast.info('Friend request already sent');
      } else {
        toast.error('Failed to send request');
      }
    },
  });

  // Accept friend request
  const acceptRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      if (!user) throw new Error('Not authenticated');
      
      const { data: request, error: fetchError } = await supabase
        .from('friendships')
        .select('*')
        .eq('id', requestId)
        .single();
      
      if (fetchError) throw fetchError;

      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', requestId);
      
      if (error) throw error;

      // Create notification for requester
      await supabase
        .from('notifications')
        .insert({
          user_id: request.requester_id,
          title: 'Friend Request Accepted!',
          body: 'Your friend request was accepted',
          type: 'friend_accepted',
          data: { friend_id: user.id },
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
      toast.success('Friend request accepted!');
    },
    onError: () => {
      toast.error('Failed to accept request');
    },
  });

  // Reject friend request
  const rejectRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'rejected' })
        .eq('id', requestId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
      toast.success('Friend request declined');
    },
    onError: () => {
      toast.error('Failed to decline request');
    },
  });

  // Cancel sent friend request
  const cancelRequestMutation = useMutation({
    mutationFn: async (recipientId: string) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('requester_id', user.id)
        .eq('recipient_id', recipientId)
        .eq('status', 'pending');

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sent-friend-requests'] });
      toast.success('Friend request cancelled');
    },
    onError: () => {
      toast.error('Failed to cancel request');
    },
  });

  // Remove friend
  const removeFriendMutation = useMutation({
    mutationFn: async (friendId: string) => {
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('friendships')
        .delete()
        .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .or(`requester_id.eq.${friendId},recipient_id.eq.${friendId}`);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      toast.success('Friend removed');
    },
    onError: () => {
      toast.error('Failed to remove friend');
    },
  });

  // Get friend count
  const friendCount = friends.length;

  // Check if user is a friend
  const isFriend = (userId: string) => {
    return friends.some(f => f.friend_id === userId);
  };

  // Check if request is pending
  const hasPendingRequest = (userId: string) => {
    return sentRequests.some(r => r.recipient_id === userId);
  };

  return {
    friends,
    loadingFriends,
    friendCount,
    pendingRequests,
    loadingRequests,
    sentRequests,
    loadingSentRequests,
    suggestedFriends,
    loadingSuggested,
    searchUsers,
    useFriendVotes,
    sendRequest: sendRequestMutation.mutate,
    sendingRequest: sendRequestMutation.isPending,
    acceptRequest: acceptRequestMutation.mutate,
    acceptingRequest: acceptRequestMutation.isPending,
    rejectRequest: rejectRequestMutation.mutate,
    rejectingRequest: rejectRequestMutation.isPending,
    cancelRequest: cancelRequestMutation.mutate,
    cancellingRequest: cancelRequestMutation.isPending,
    removeFriend: removeFriendMutation.mutate,
    removingFriend: removeFriendMutation.isPending,
    isFriend,
    hasPendingRequest,
    refetchFriends,
  };
}
