import { useEffect, useState, useCallback } from 'react';
import { Bell, BellOff, Loader2, CheckCircle2 } from 'lucide-react';
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
  const [isEnabled, setIsEnabled] = useState(false);
  const [didCheck, setDidCheck] = useState(false);

  const refreshState = useCallback(async () => {
    try {
      const mod = await import('@onesignal/capacitor-plugin');
      const OneSignal = mod.default;
      const has = await OneSignal.Notifications.hasPermission();
      setIsEnabled(!!has);
    } catch {
      // plugin missing — leave disabled
    } finally {
      setDidCheck(true);
    }
  }, []);

  useEffect(() => {
    void refreshState();
  }, [refreshState]);

  const enableNotifications = async () => {
    if (isEnabled) return; // already on
    toast.loading('Checking notifications…', { id: 'native-notifications' });

    if (!user?.id) {
      toast.dismiss('native-notifications');
      toast.error('Please sign in to enable notifications');
      return;
    }

    setIsLoading(true);
    try {
      const result = await requestOneSignalPermission(user.id);
      await refreshState();
      if (result.ok === true) {
        toast.success('Notifications enabled', { id: 'native-notifications' });
        setIsEnabled(true);
        return;
      }
      const reason = result.reason;
      const label =
        reason === 'not-native'
          ? 'Notifications only work in the iOS app'
          : reason === 'missing-plugin'
            ? 'Update the iOS app first'
            : reason === 'error'
              ? 'Notifications need a new app build'
              : 'Turn on notifications in iOS Settings';
      const description =
        reason === 'not-native'
          ? undefined
          : reason === 'missing-plugin'
            ? 'This cannot be fixed by OTA. Install a new TestFlight/App Store build that includes the native notification plugin.'
            : reason === 'error'
              ? result.message ?? 'Install a fresh TestFlight/App Store build, then try Enable again.'
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
      subtitle={isEnabled ? "You're getting alerts for new polls and updates" : 'Enable alerts for new polls and updates'}
      onClick={isEnabled ? undefined : enableNotifications}
      action={
        isEnabled ? (
          <div className="flex items-center gap-1.5 text-primary text-sm font-medium px-3 py-1.5">
            <CheckCircle2 className="h-4 w-4" />
            <span>Enabled</span>
          </div>
        ) : (
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              void enableNotifications();
            }}
            disabled={isLoading || !didCheck}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enable'}
          </Button>
        )
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
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  action: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 p-4 glass rounded-xl ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      } : undefined}
    >
      {icon}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-card-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
