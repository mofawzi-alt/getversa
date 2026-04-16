import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Returns total count of unread messages + pending incoming friend requests.
 * Used to show a red badge on the Friends nav button.
 */
export function useFriendsBadge() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }

    let cancelled = false;

    const fetchCount = async () => {
      try {
        // Pending incoming friend requests
        const { count: requestsCount } = await supabase
          .from('friendships')
          .select('id', { count: 'exact', head: true })
          .eq('recipient_id', user.id)
          .eq('status', 'pending');

        // Unread messages via conversations RPC
        const { data: convos } = await supabase.rpc('get_user_conversations', {
          p_user_id: user.id,
        });

        const unreadMessages = (convos || []).reduce(
          (sum: number, c: any) => sum + Number(c.unread_count || 0),
          0
        );

        if (!cancelled) {
          setCount((requestsCount || 0) + unreadMessages);
        }
      } catch (e) {
        if (!cancelled) setCount(0);
      }
    };

    fetchCount();

    // Realtime: refresh on new message or friendship change
    const channel = supabase
      .channel('friends-badge-' + user.id)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => fetchCount()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friendships' },
        () => fetchCount()
      )
      .subscribe();

    // Refresh when tab regains focus
    const onFocus = () => fetchCount();
    window.addEventListener('focus', onFocus);

    // Periodic refresh as safety net
    const interval = setInterval(fetchCount, 30000);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      window.removeEventListener('focus', onFocus);
      clearInterval(interval);
    };
  }, [user]);

  return count;
}
