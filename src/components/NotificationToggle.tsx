import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export function NotificationToggle() {
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) {
    return (
      <div className="flex items-center gap-3 p-4 glass rounded-xl">
        <BellOff className="h-5 w-5 text-muted-foreground" />
        <div className="flex-1">
          <p className="font-medium text-card-foreground">Push Notifications</p>
          <p className="text-sm text-muted-foreground">Not supported in this browser</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-4 glass rounded-xl">
      <Bell className={`h-5 w-5 ${isSubscribed ? 'text-primary' : 'text-muted-foreground'}`} />
      <div className="flex-1">
        <p className="font-medium text-card-foreground">Push Notifications</p>
        <p className="text-sm text-muted-foreground">
          {isSubscribed ? 'Get notified for new polls' : 'Enable to stay updated'}
        </p>
      </div>
      <Button
        variant={isSubscribed ? 'outline' : 'default'}
        size="sm"
        onClick={isSubscribed ? unsubscribe : subscribe}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isSubscribed ? (
          'Disable'
        ) : (
          'Enable'
        )}
      </Button>
    </div>
  );
}
