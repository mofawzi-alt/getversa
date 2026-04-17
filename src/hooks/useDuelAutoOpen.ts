import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/**
 * Global listener: when a duel I sent transitions from `pending` → `accepted`,
 * surface a toast nudge so the challenger can choose to enter the duel on their
 * own time. We deliberately DO NOT auto-navigate — the sender may be doing
 * something else on the app/phone. The push + in-app notification (created
 * server-side in acceptChallenge) plus this toast are enough to invite them in.
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
          // Already on the duel page — no nudge needed
          if (locRef.current === target) return;

          toast.success('Your challenge was accepted! Tap to play', {
            action: {
              label: 'Enter duel',
              onClick: () => navigate(target),
            },
            duration: 8000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, navigate]);
}
