import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface DailyQueueItem {
  poll_id: string;
  queue_order: number;
}

export function useDailyQueue() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Generate/fetch today's daily queue
  const { data: dailyQueue, isLoading: isQueueLoading } = useQuery({
    queryKey: ['daily-queue', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.rpc('generate_daily_queue', { p_user_id: user.id });
      if (error) {
        console.error('Daily queue error:', error);
        return null;
      }
      return (data as DailyQueueItem[]) || [];
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!user,
  });

  // Get IDs of voted polls from today's queue
  const { data: votedQueueIds } = useQuery({
    queryKey: ['daily-queue-voted', user?.id],
    queryFn: async () => {
      if (!user || !dailyQueue || dailyQueue.length === 0) return new Set<string>();
      const queuePollIds = dailyQueue.map(q => q.poll_id);
      const { data: votes } = await supabase
        .from('votes')
        .select('poll_id')
        .eq('user_id', user.id)
        .in('poll_id', queuePollIds);
      return new Set(votes?.map(v => v.poll_id) || []);
    },
    staleTime: 1000 * 30,
    enabled: !!user && !!dailyQueue && dailyQueue.length > 0,
  });

  // Fetch daily limit settings
  const { data: settings } = useQuery({
    queryKey: ['daily-poll-settings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('daily_poll_settings')
        .select('daily_limit, first_day_limit')
        .limit(1)
        .single();
      return data || { daily_limit: 15, first_day_limit: 20 };
    },
    staleTime: 1000 * 60 * 30,
  });

  const queuePollIds = dailyQueue?.map(q => q.poll_id) || [];
  const totalToday = queuePollIds.length;
  const votedToday = votedQueueIds?.size || 0;
  const remainingToday = totalToday - votedToday;
  const allDone = totalToday > 0 && remainingToday <= 0;

  const invalidateQueue = () => {
    queryClient.invalidateQueries({ queryKey: ['daily-queue'] });
    queryClient.invalidateQueries({ queryKey: ['daily-queue-voted'] });
  };

  return {
    dailyQueue,
    queuePollIds,
    votedQueueIds,
    isQueueLoading,
    totalToday,
    votedToday,
    remainingToday,
    allDone,
    settings,
    invalidateQueue,
  };
}
