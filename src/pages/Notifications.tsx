import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Bell, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { NotificationToggle } from '@/components/NotificationToggle';

export default function Notifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'vote_result': return '🗳️';
      case 'friend_voted': return '👥';
      case 'challenge': return '🏆';
      default: return '🔔';
    }
  };

  return (
    <AppLayout>
      <div className="p-4 space-y-4 animate-slide-up">
        <header>
          <h1 className="text-2xl font-display font-bold">Alerts</h1>
          <p className="text-foreground/60 text-sm">Stay in the loop</p>
        </header>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : notifications && notifications.length > 0 ? (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                onClick={() => !notification.is_read && markReadMutation.mutate(notification.id)}
                className={`w-full text-left rounded-xl p-4 bg-card border border-border transition-all ${
                  notification.is_read ? 'opacity-60' : 'shadow-card'
                }`}
              >
                <div className="flex gap-3">
                  <div className="text-2xl">{getNotificationIcon(notification.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{notification.title}</h3>
                      {!notification.is_read && (
                        <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-card-foreground/70 line-clamp-2">
                      {notification.body}
                    </p>
                    <p className="text-xs text-card-foreground/50 mt-1">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 space-y-5">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Bell className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">New polls drop daily</h3>
              <p className="text-foreground/60 text-sm max-w-xs mx-auto">
                Enable notifications to know when fresh polls are live and see how your votes compare.
              </p>
            </div>
            <NotificationToggle />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
