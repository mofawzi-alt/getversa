import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BDYNC1YHcRfHX-4KpkSunIiQmXPLwjZkwH3KYjUrRD9aGo0DA9i1Rg9EdulqmMYlFEO-rVizI-HpC8EkVkKQlz8';

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length) as Uint8Array<ArrayBuffer>;

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

function hasMatchingApplicationServerKey(
  subscription: PushSubscription,
  expectedKey: Uint8Array<ArrayBuffer>,
): boolean {
  const existingKey = subscription.options?.applicationServerKey;

  if (!existingKey) {
    return false;
  }

  const normalizedExistingKey = new Uint8Array(existingKey);

  if (normalizedExistingKey.length !== expectedKey.length) {
    return false;
  }

  return normalizedExistingKey.every((value, index) => value === expectedKey[index]);
}

async function persistSubscription(subscription: PushSubscription) {
  const subscriptionJson = subscription.toJSON();
  const endpoint = subscriptionJson.endpoint;
  const p256dh = subscriptionJson.keys?.p256dh;
  const auth = subscriptionJson.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    throw new Error('Incomplete push subscription');
  }

  const { data, error } = await supabase.functions.invoke('save-push-subscription', {
    body: {
      endpoint,
      p256dh,
      auth,
    },
  });

  if (error) {
    throw error;
  }

  if (data?.error) {
    throw new Error(data.error);
  }
}

function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isLoading, setIsLoading] = useState(false);
  const [supportMessage, setSupportMessage] = useState('Not supported in this browser');
  const isNativeApp = Capacitor?.isNativePlatform?.() === true;

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setIsSubscribed(false);
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        setIsSubscribed(false);
        return;
      }

      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

      if (!hasMatchingApplicationServerKey(subscription, applicationServerKey)) {
        await subscription.unsubscribe();
        setIsSubscribed(false);
        return;
      }

      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('endpoint')
        .eq('user_id', user.id)
        .eq('endpoint', subscription.endpoint)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data) {
        setIsSubscribed(true);
        return;
      }

      await persistSubscription(subscription);
      setIsSubscribed(true);
    } catch (error) {
      console.error('Error checking subscription:', error);
      setIsSubscribed(false);
    }
  }, [user]);

  useEffect(() => {
    if (isNativeApp) {
      setIsSupported(false);
      setIsSubscribed(false);
      setSupportMessage('Notifications are not wired into the native phone app yet');
      return;
    }

    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);
    setSupportMessage(
      supported
        ? 'Enable notifications to stay updated'
        : isIosDevice()
          ? 'Open Versa from your Home Screen to enable notifications'
          : 'Push notifications are not supported on this device',
    );

    if (!supported) {
      setIsSubscribed(false);
      return;
    }

    setPermission(Notification.permission);
    void checkSubscription();
  }, [checkSubscription, user, isNativeApp]);

  const registerServiceWorker = async (): Promise<ServiceWorkerRegistration> => {
    await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    return navigator.serviceWorker.ready;
  };

  const subscribe = useCallback(async () => {
    if (!user) {
      toast.error('Please sign in to enable notifications');
      return false;
    }

    if (!isSupported) {
      toast.error(isNativeApp ? 'Notifications are not available in the native phone app yet' : supportMessage);
      return false;
    }

    if (isIosDevice() && !isStandaloneMode()) {
      toast.error('Open Versa from your Home Screen to enable notifications');
      return false;
    }

    setIsLoading(true);

    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== 'granted') {
        toast.error('Notification permission denied');
        return false;
      }

      const registration = await registerServiceWorker();
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

      let subscription = await registration.pushManager.getSubscription();
      let syncedExistingSubscription = false;

      if (subscription && !hasMatchingApplicationServerKey(subscription, applicationServerKey)) {
        await subscription.unsubscribe();
        subscription = null;
      }

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      } else {
        syncedExistingSubscription = true;
      }

      await persistSubscription(subscription);

      setIsSubscribed(true);
      toast.success(syncedExistingSubscription ? 'Notifications synced!' : 'Notifications enabled!');
      return true;
    } catch (error) {
      console.error('Error subscribing to push:', error);
      toast.error('Failed to enable notifications');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!user) {
      toast.error('Please sign in to manage notifications');
      return false;
    }

    setIsLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        const { error } = await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint);

        if (error) throw error;
      }

      setIsSubscribed(false);
      toast.success('Notifications disabled');
      return true;
    } catch (error) {
      console.error('Error unsubscribing:', error);
      toast.error('Failed to disable notifications');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  return {
    isSupported,
    isSubscribed,
    permission,
    isLoading,
    supportMessage,
    subscribe,
    unsubscribe,
  };
}
