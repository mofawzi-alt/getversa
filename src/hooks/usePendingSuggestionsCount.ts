import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function usePendingSuggestionsCount() {
  const { isAdmin } = useAuth();
  const query = useQuery({
    queryKey: ['admin-pending-suggestions-count'],
    enabled: isAdmin,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('poll_suggestions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!isAdmin) return;
    const ch = supabase
      .channel('admin-poll-suggestions-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_suggestions' }, () => {
        query.refetch();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin]);

  return query;
}
