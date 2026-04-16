import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Conversation {
  conversation_id: string;
  other_user_id: string;
  other_username: string | null;
  other_avatar_url?: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  last_message_type: string | null;
  last_sender_id: string | null;
  unread_count: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: 'text' | 'poll_share';
  shared_poll_id: string | null;
  read_at: string | null;
  created_at: string;
}

/** List all conversations for the current user. */
export function useConversations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.rpc('get_user_conversations', { p_user_id: user.id });
      if (error) throw error;
      return (data || []) as Conversation[];
    },
    enabled: !!user,
  });

  // Realtime: refresh list whenever any new message arrives in the user's conversations
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('conversations-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const totalUnread = (query.data || []).reduce((sum, c) => sum + Number(c.unread_count || 0), 0);
  return { ...query, totalUnread };
}

/** Open or create a 1-on-1 conversation with a friend, returns conversation_id. */
export function useOpenConversation() {
  return useMutation({
    mutationFn: async (otherUserId: string) => {
      const { data, error } = await supabase.rpc('get_or_create_conversation', { _other_user_id: otherUserId });
      if (error) throw error;
      return data as string;
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Could not open chat');
    },
  });
}

/** Live messages for one conversation, ordered ascending. */
export function useConversationMessages(conversationId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as Message[];
    },
    enabled: !!conversationId && !!user,
  });

  // Realtime new messages
  useEffect(() => {
    if (!conversationId || !user) return;
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
          queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user, queryClient]);

  return query;
}

/** Send a text or poll-share message. */
export function useSendMessage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      conversationId: string;
      content?: string;
      sharedPollId?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const messageType = params.sharedPollId ? 'poll_share' : 'text';
      const { error } = await supabase.from('messages').insert({
        conversation_id: params.conversationId,
        sender_id: user.id,
        content: params.content || null,
        shared_poll_id: params.sharedPollId || null,
        message_type: messageType,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['messages', vars.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations', user?.id] });
    },
    onError: () => toast.error('Could not send message'),
  });
}

/** Mark all unread messages from the other party in a conversation as read. */
export function useMarkConversationRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      if (!user) return;
      const { error } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .is('read_at', null);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', user?.id] });
    },
  });
}
