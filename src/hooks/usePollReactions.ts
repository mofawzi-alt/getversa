import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function usePollReactions(pollId?: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = ['poll-reactions', pollId];

  const { data } = useQuery({
    queryKey: key,
    enabled: !!pollId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!pollId) return { count: 0, reacted: false };
      const [{ count }, mine] = await Promise.all([
        supabase
          .from('poll_reactions')
          .select('id', { count: 'exact', head: true })
          .eq('poll_id', pollId)
          .eq('reaction', 'fire'),
        user
          ? supabase
              .from('poll_reactions')
              .select('id')
              .eq('poll_id', pollId)
              .eq('user_id', user.id)
              .eq('reaction', 'fire')
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      return { count: count || 0, reacted: !!(mine as any)?.data };
    },
  });

  // Realtime
  useEffect(() => {
    if (!pollId) return;
    const channel = supabase
      .channel(`poll-reactions-${pollId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'poll_reactions', filter: `poll_id=eq.${pollId}` },
        () => queryClient.invalidateQueries({ queryKey: key })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [pollId, queryClient]);

  const toggle = useMutation({
    mutationFn: async () => {
      if (!user || !pollId) throw new Error('Sign in to react');
      if (data?.reacted) {
        await supabase
          .from('poll_reactions')
          .delete()
          .eq('poll_id', pollId)
          .eq('user_id', user.id)
          .eq('reaction', 'fire');
      } else {
        await supabase
          .from('poll_reactions')
          .insert({ poll_id: pollId, user_id: user.id, reaction: 'fire' });
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<{ count: number; reacted: boolean }>(key);
      if (prev) {
        queryClient.setQueryData(key, {
          reacted: !prev.reacted,
          count: prev.count + (prev.reacted ? -1 : 1),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(key, ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return {
    count: data?.count || 0,
    reacted: !!data?.reacted,
    toggle: () => toggle.mutate(),
    canReact: !!user,
  };
}
