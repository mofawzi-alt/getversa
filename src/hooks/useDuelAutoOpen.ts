import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/**
 * Global listener: when a duel I sent transitions from `pending` → `accepted`,
 * automatically navigate me into the duel screen so both players land on it
 * at the same moment.
 *
 * Safe-guards:
 * - Only triggers for the challenger (so the challenged user isn't yanked out
 *   of an Accept screen they're already on).
 * - Does nothing if the user is already on /play/duels/:id for that duel.
 */
export function useDuelAutoOpen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locRef = useRef(location.pathname);
  locRef.current = location.pathname;

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`duel-auto-open-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'poll_challenges' },
        (payload) => {
          const next: any = payload.new;
          const prev: any = payload.old;
          if (!next || !prev) return;
          if (next.challenger_id !== user.id) return;
          if (prev.status === 'accepted' || next.status !== 'accepted') return;

          const target = `/play/duels/${next.id}`;
          if (locRef.current === target) return;

          toast.success('Challenge accepted! Opening duel…');
          navigate(target);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, navigate]);
}
