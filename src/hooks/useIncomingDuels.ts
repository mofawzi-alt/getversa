import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Returns a Map<challenger_user_id, duel_id> of all PENDING duels
 * where the current user is the one being challenged. Used to show
 * "Challenged you" badges on the friend's row in the Friends list.
 */
export function useIncomingDuels() {
  const { user } = useAuth();
  const [byChallengerId, setByChallengerId] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!user) {
      setByChallengerId(new Map());
      return;
    }

    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from('poll_challenges')
        .select('id, challenger_id')
        .eq('challenged_id', user.id)
        .eq('status', 'pending');

      if (cancelled) return;
      const map = new Map<string, string>();
      (data || []).forEach((d: any) => {
        // Latest pending duel per challenger wins (only keep one)
        if (!map.has(d.challenger_id)) map.set(d.challenger_id, d.id);
      });
      setByChallengerId(map);
    };

    load();

    const channel = supabase
      .channel(`incoming-duels-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'poll_challenges' },
        (payload) => {
          const row: any = (payload.new as any) || (payload.old as any);
          if (!row) return;
          if (row.challenged_id === user.id) load();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);

  return byChallengerId;
}
