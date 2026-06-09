import { useState } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { requestOneSignalPermission } from '@/lib/onesignal';
import { toast } from 'sonner';

/**
 * Smart notification toggle:
 *  • Web: uses Web Push (existing usePushNotifications hook)
 *  • Native iOS/Android: uses the OneSignal Capacitor plugin.
 */
export function NotificationToggle() {
  const isNative = Capacitor?.isNativePlatform?.() === true;
  if (isNative) return <NativeNotificationToggle />;
  return <WebNotificationToggle />;
}

// ─────────────────────────────────────────────────────────────────
// WEB
// ─────────────────────────────────────────────────────────────────
function WebNotificationToggle() {
  const { isSupported, isSubscribed, isLoading, supportMessage, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) {
    return (
      <Row
        icon={<BellOff className="h-5 w-5 text-muted-foreground" />}
        title="Push Notifications"
        subtitle={supportMessage}
        action={<Button variant="outline" size="sm" disabled>Unavailable</Button>}
      />
    );
  }

  return (
    <Row
      icon={<Bell className={`h-5 w-5 ${isSubscribed ? 'text-primary' : 'text-muted-foreground'}`} />}
      title="Push Notifications"
      subtitle={isSubscribed ? 'Get notified for new polls' : 'Enable to stay updated'}
      action={
        <Button
          variant={isSubscribed ? 'outline' : 'default'}
          size="sm"
          onClick={isSubscribed ? unsubscribe : subscribe}
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : isSubscribed ? 'Disable' : 'Enable'}
        </Button>
      }
    />
  );
}

// ─────────────────────────────────────────────────────────────────
// NATIVE (OneSignal)
// ─────────────────────────────────────────────────────────────────
function NativeNotificationToggle() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const enableNotifications = async () => {
    toast.loading('Checking notifications…', { id: 'native-notifications' });

    if (!user?.id) {
      toast.dismiss('native-notifications');
      toast.error('Please sign in to enable notifications');
      return;
    }

    setIsLoading(true);
    try {
      const result = await requestOneSignalPermission(user.id);
      if (result.ok === true) {
        toast.success('Notifications enabled', { id: 'native-notifications' });
        return;
      }
      const reason = result.reason;
      const label =
        reason === 'not-native'
          ? 'Notifications only work in the iOS app'
          : reason === 'missing-plugin'
            ? 'Update the iOS app first'
          : 'Turn on notifications in iOS Settings';
      const description =
        reason === 'not-native'
          ? undefined
          : reason === 'missing-plugin'
            ? 'This cannot be fixed by OTA. Install a new TestFlight/App Store build that includes the native notification plugin.'
          : 'Open Settings → Versa → Notifications and enable Allow Notifications.';
      toast(label, { id: 'native-notifications', description, duration: 8000 });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Row
      icon={<Bell className="h-5 w-5 text-primary" />}
      title="Push Notifications"
      subtitle="Enable alerts for new polls and updates"
      action={
        <Button
          variant="default"
          size="sm"
          onClick={enableNotifications}
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enable'}
        </Button>
      }
    />
  );
}


// ─────────────────────────────────────────────────────────────────
function Row({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 p-4 glass rounded-xl">
      {icon}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-card-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
