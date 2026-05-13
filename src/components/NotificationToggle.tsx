import { useEffect, useState, useCallback } from 'react';
import { Bell, BellOff, Loader2, Settings } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

type NativeState = 'loading' | 'unsupported' | 'granted-on' | 'granted-off' | 'denied' | 'default';

const isNative = Capacitor?.isNativePlatform?.() === true;

/**
 * Smart notification toggle:
 *  • Web: uses Web Push (existing usePushNotifications hook)
 *  • Native iOS/Android: uses OneSignal, with deep-link to iOS Settings
 *    if the user previously denied permission (Apple blocks re-prompting).
 */
export function NotificationToggle() {
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
  const [state, setState] = useState<NativeState>('loading');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const mod = await import('onesignal-cordova-plugin');
      const OneSignal = (mod as any).default ?? mod;

      // Permission: 'granted' | 'denied' | 'default' (not yet asked)
      const permission: NotificationPermission =
        (await OneSignal.Notifications?.getPermissionAsync?.()) ??
        (OneSignal.Notifications?.permission as NotificationPermission) ??
        'default';

      if (permission === 'denied') {
        setState('denied');
        return;
      }
      if (permission === 'default') {
        setState('default');
        return;
      }
      // granted — check whether they're opted in to push
      const optedIn: boolean =
        (await OneSignal.User?.pushSubscription?.getOptedInAsync?.()) ??
        OneSignal.User?.pushSubscription?.optedIn ??
        true;
      setState(optedIn ? 'granted-on' : 'granted-off');
    } catch (err) {
      console.error('[NotificationToggle] refresh failed:', err);
      setState('unsupported');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const requestPermission = async () => {
    setBusy(true);
    try {
      const mod = await import('onesignal-cordova-plugin');
      const OneSignal = (mod as any).default ?? mod;
      const granted: boolean = await OneSignal.Notifications.requestPermission(true);
      if (granted) {
        try { OneSignal.User.pushSubscription.optIn(); } catch {}
        if (user?.id) try { OneSignal.login(user.id); } catch {}
        toast.success('Notifications enabled!');
      } else {
        toast.error('Permission denied — enable from iPhone Settings');
      }
      await refresh();
    } catch (err) {
      console.error(err);
      toast.error('Failed to enable notifications');
    } finally {
      setBusy(false);
    }
  };

  const optOut = async () => {
    setBusy(true);
    try {
      const mod = await import('onesignal-cordova-plugin');
      const OneSignal = (mod as any).default ?? mod;
      OneSignal.User.pushSubscription.optOut();
      toast.success('Notifications disabled');
      await refresh();
    } catch (err) {
      console.error(err);
      toast.error('Failed to disable notifications');
    } finally {
      setBusy(false);
    }
  };

  const optIn = async () => {
    setBusy(true);
    try {
      const mod = await import('onesignal-cordova-plugin');
      const OneSignal = (mod as any).default ?? mod;
      OneSignal.User.pushSubscription.optIn();
      toast.success('Notifications enabled');
      await refresh();
    } catch (err) {
      console.error(err);
      toast.error('Failed to enable notifications');
    } finally {
      setBusy(false);
    }
  };

  const openIOSSettings = async () => {
    try {
      // iOS deep-link to the app's Settings page
      const { App } = await import('@capacitor/app');
      // @ts-ignore — openUrl exists on the iOS implementation
      if (App?.openUrl) {
        await (App as any).openUrl({ url: 'app-settings:' });
        return;
      }
    } catch {}
    try {
      window.location.href = 'app-settings:';
    } catch {
      toast.error('Open iPhone Settings → Notifications → Versa');
    }
  };

  if (state === 'loading') {
    return (
      <Row
        icon={<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        title="Push Notifications"
        subtitle="Checking status…"
        action={null}
      />
    );
  }

  if (state === 'unsupported') {
    return (
      <Row
        icon={<BellOff className="h-5 w-5 text-muted-foreground" />}
        title="Push Notifications"
        subtitle="Not available on this device"
        action={<Button variant="outline" size="sm" disabled>Unavailable</Button>}
      />
    );
  }

  if (state === 'denied') {
    return (
      <Row
        icon={<BellOff className="h-5 w-5 text-muted-foreground" />}
        title="Push Notifications"
        subtitle="Blocked. Open Settings to allow notifications for Versa."
        action={
          <Button variant="default" size="sm" onClick={openIOSSettings} className="gap-1.5">
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        }
      />
    );
  }

  if (state === 'default') {
    return (
      <Row
        icon={<Bell className="h-5 w-5 text-muted-foreground" />}
        title="Push Notifications"
        subtitle="Enable to get daily polls and reminders"
        action={
          <Button size="sm" onClick={requestPermission} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enable'}
          </Button>
        }
      />
    );
  }

  // granted-on / granted-off
  const on = state === 'granted-on';
  return (
    <Row
      icon={<Bell className={`h-5 w-5 ${on ? 'text-primary' : 'text-muted-foreground'}`} />}
      title="Push Notifications"
      subtitle={on ? 'Get notified for new polls' : 'Notifications are paused'}
      action={
        <Button
          variant={on ? 'outline' : 'default'}
          size="sm"
          onClick={on ? optOut : optIn}
          disabled={busy}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : on ? 'Disable' : 'Enable'}
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
