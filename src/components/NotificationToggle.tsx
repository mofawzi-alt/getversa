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
 *  • Native iOS/Android: disabled until the app uses an SPM-ready push plugin.
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

  const enableNotifications = async () => {
    const result = await requestOneSignalPermission(user?.id ?? null);
    if (result.ok) {
      toast.success('Notifications enabled');
      return;
    }
      const label =
        result.reason === 'plugin-missing'
          ? 'OneSignal plugin not installed in iOS build'
          : result.reason === 'denied'
            ? 'Permission denied — enable in iOS Settings → Versa → Notifications'
            : result.reason === 'not-native'
              ? 'Notifications only work in the iOS app'
              : 'Notifications were not enabled';
      toast.error(label, { description: result.message, duration: 8000 });
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
        >
          Enable
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
