import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type UserStoryType = 'poll_result' | 'taste_profile' | 'achievement' | 'duel_result';

export interface UserStory {
  id: string;
  user_id: string;
  story_type: UserStoryType;
  content: Record<string, any>;
  image_url: string | null;
  views_count: number;
  created_at: string;
  expires_at: string;
}

export interface UserStoryWithAuthor extends UserStory {
  author_username: string | null;
  author_avatar_url: string | null;
}

export interface GroupedUserStories {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  stories: UserStory[];
  hasUnviewed: boolean;
}

export function useUserStories() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all visible stories grouped by user
  const { data: storyGroups = [], isLoading } = useQuery({
    queryKey: ['user-stories-feed', user?.id],
    queryFn: async () => {
      // Fetch non-expired stories
      const { data: stories, error } = await supabase
        .from('user_stories')
        .select('*')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      if (!stories || stories.length === 0) return [];

      // Get unique user IDs
      const userIds = [...new Set(stories.map((s: any) => s.user_id))];

      // Fetch author profiles
      const { data: profiles } = await supabase
        .rpc('get_public_profiles', { user_ids: userIds });

      const profileMap = new Map<string, any>();
      (profiles || []).forEach((p: any) => {
        profileMap.set(p.id, p);
      });

      // Fetch viewed story IDs for current user
      let viewedIds = new Set<string>();
      if (user) {
        const { data: views } = await supabase
          .from('user_story_views')
          .select('story_id')
          .eq('viewer_id', user.id);
        viewedIds = new Set((views || []).map((v: any) => v.story_id));
      }

      // Group by user
      const groupMap = new Map<string, GroupedUserStories>();
      for (const story of stories as UserStory[]) {
        if (!groupMap.has(story.user_id)) {
          const profile = profileMap.get(story.user_id);
          groupMap.set(story.user_id, {
            user_id: story.user_id,
            username: profile?.username || null,
            avatar_url: profile?.avatar_url || null,
            stories: [],
            hasUnviewed: false,
          });
        }
        const group = groupMap.get(story.user_id)!;
        group.stories.push(story);
        if (!viewedIds.has(story.id)) {
          group.hasUnviewed = true;
        }
      }

      // Sort: current user first, then unviewed, then by recency
      const groups = Array.from(groupMap.values());
      groups.sort((a, b) => {
        if (a.user_id === user?.id) return -1;
        if (b.user_id === user?.id) return 1;
        if (a.hasUnviewed !== b.hasUnviewed) return a.hasUnviewed ? -1 : 1;
        return new Date(b.stories[0].created_at).getTime() - new Date(a.stories[0].created_at).getTime();
      });

      return groups;
    },
    enabled: true,
    refetchInterval: 60000,
  });

  // Post a story
  const postStory = useMutation({
    mutationFn: async (params: {
      story_type: UserStoryType;
      content: Record<string, any>;
      image_url?: string | null;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('user_stories').insert({
        user_id: user.id,
        story_type: params.story_type,
        content: params.content,
        image_url: params.image_url || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-stories-feed'] });
      toast.success('Story shared! 🎉');
    },
    onError: () => {
      toast.error('Failed to share story');
    },
  });

  // Mark story as viewed
  const markViewed = useMutation({
    mutationFn: async (storyId: string) => {
      if (!user) return;
      await supabase.from('user_story_views').upsert(
        { story_id: storyId, viewer_id: user.id },
        { onConflict: 'story_id,viewer_id' }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-stories-feed'] });
    },
  });

  // Delete own story
  const deleteStory = useMutation({
    mutationFn: async (storyId: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('user_stories')
        .delete()
        .eq('id', storyId)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-stories-feed'] });
      toast.success('Story deleted');
    },
  });

  // Check if current user has active stories
  const myStories = storyGroups.find(g => g.user_id === user?.id);

  return {
    storyGroups,
    isLoading,
    myStories,
    postStory: postStory.mutate,
    postingStory: postStory.isPending,
    markViewed: markViewed.mutate,
    deleteStory: deleteStory.mutate,
  };
}
