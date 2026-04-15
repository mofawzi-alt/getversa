import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Users } from 'lucide-react';
import { motion } from 'framer-motion';

export default function FriendsJoinedToday() {
  const { user } = useAuth();

  const { data: count = 0 } = useQuery({
    queryKey: ['friends-joined-today'],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { count, error } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayStart.toISOString());

      if (error) return 0;
      return count || 0;
    },
    staleTime: 1000 * 60 * 5,
  });

  if (count < 2) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-3 mb-1"
    >
      <div className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-full bg-primary/8 border border-primary/15">
        <Users className="h-3 w-3 text-primary" />
        <span className="text-[11px] font-semibold text-primary">
          {count} {user ? 'people' : 'friends'} joined today
        </span>
      </div>
    </motion.div>
  );
}
