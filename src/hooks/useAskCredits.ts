import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

export function useAskCredits() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['ask-credits', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { data, error } = await supabase
        .from('users')
        .select('ask_credits')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.ask_credits as number | undefined) ?? 0;
    },
    enabled: !!user?.id,
    staleTime: 10_000,
  });

  // Realtime: refresh when ask_credits changes
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`ask-credits-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ['ask-credits', user.id] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, qc]);

  return query;
}
