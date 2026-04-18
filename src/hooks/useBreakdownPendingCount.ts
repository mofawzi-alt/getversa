import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Returns the count of pending breakdown findings from the last 7 days.
 * Admin-only — returns 0 for non-admins.
 */
export function useBreakdownPendingCount() {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ['breakdown-pending-count'],
    enabled: !!isAdmin,
    refetchInterval: 60_000,
    queryFn: async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
      const { count, error } = await supabase
        .from('breakdown_findings' as any)
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .gte('scan_at', sevenDaysAgo);
      if (error) throw error;
      return count || 0;
    },
  });
}
