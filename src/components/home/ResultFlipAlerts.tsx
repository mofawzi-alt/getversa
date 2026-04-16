import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, ArrowRight } from 'lucide-react';

/**
 * Shows a banner on Home when polls the user voted on have flipped results.
 * Reads from notifications table where type = 'result_flip' and is_read = false.
 */
export default function ResultFlipAlerts() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: flipAlerts = [] } = useQuery({
    queryKey: ['result-flip-alerts', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'result_flip')
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(3);
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 60000, // Check every minute
  });

  const handleTap = async (notification: any) => {
    // Mark as read
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notification.id);

    // Navigate to the poll
    const pollId = notification.data?.poll_id;
    if (pollId) {
      navigate(`/poll/${pollId}`);
    }
  };

  if (flipAlerts.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="space-y-2"
      >
        {flipAlerts.map((alert: any) => (
          <motion.button
            key={alert.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            onClick={() => handleTap(alert)}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-foreground line-clamp-1">{alert.title}</p>
              <p className="text-[10px] text-muted-foreground line-clamp-1">{alert.body}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-primary shrink-0" />
          </motion.button>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}
