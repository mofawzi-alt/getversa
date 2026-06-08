import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

const ONESIGNAL_APP_ID = '0b64a490-9689-42c9-80a3-e84a0e4f1a0b';

let initialized = false;
let clickListenerRegistered = false;

type NotificationClickEvent = {
  notification?: {
    additionalData?: Record<string, unknown>;
    launchURL?: unknown;
    url?: unknown;
  };
  result?: { url?: unknown };
  url?: unknown;
};

type PushSubscriptionChangeEvent = {
  current?: { id?: string };
};

type OneSignalNative = {
  initialize: (appId: string) => void;
  Notifications: {
    requestPermission: (fallbackToSettings: boolean) => Promise<boolean>;
    addEventListener: (event: 'click', listener: (event: NotificationClickEvent) => void) => void;
  };
  User: {
    pushSubscription: {
      addEventListener: (event: 'change', listener: (event: PushSubscriptionChangeEvent) => void) => void;
      getIdAsync?: () => Promise<string | null | undefined>;
      id?: string | null;
    };
  };
  login: (userId: string) => void;
  logout: () => void;
};

async function getOneSignal(): Promise<OneSignalNative | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    // Dynamic import so the web bundle never tries to resolve the native-only plugin.
    const mod = await import(/* @vite-ignore */ 'onesignal-cordova-plugin');
    return ((mod as { default?: unknown }).default ?? mod) as OneSignalNative;
  } catch (err) {
    console.error('[OneSignal] failed to load native plugin:', err);
    return null;
  }
}

function normalizeNotificationRoute(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const raw = value.trim();
  if (raw.startsWith('/')) return raw;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/home';
    }
    if (parsed.protocol === 'versa:' || parsed.protocol === 'com.versa.app:' || parsed.protocol === 'com.Versa.app:') {
      const path = `/${[parsed.host, parsed.pathname.replace(/^\//, '')].filter(Boolean).join('/')}`;
      return `${path}${parsed.search}${parsed.hash}` || '/home';
    }
  } catch {
    return null;
  }
  return null;
}

function dispatchNotificationRoute(route: string) {
  try {
    localStorage.setItem('versa_pending_notification_route', route);
  } catch {
    console.warn('[OneSignal] unable to store pending notification route');
  }
  window.dispatchEvent(new CustomEvent('versa:navigate', { detail: { url: route } }));
}

export function getNotificationRoute(value: unknown): string | null {
  return normalizeNotificationRoute(value);
}

export function openNotificationRoute(route: string) {
  dispatchNotificationRoute(route);
}

function registerNotificationClickListener(OneSignal: OneSignalNative) {
  if (clickListenerRegistered) return;
  try {
    OneSignal.Notifications.addEventListener('click', (event) => {
      const additionalData = event?.notification?.additionalData ?? {};
      const route = normalizeNotificationRoute(
        additionalData.url ??
        event?.notification?.launchURL ??
        event?.notification?.url ??
        event?.result?.url ??
        event?.url
      );
      if (route) dispatchNotificationRoute(route);
    });
    clickListenerRegistered = true;
  } catch (err) {
    console.error('[OneSignal] click listener failed:', err);
  }
}

async function requestPermissionAndSync(OneSignal: OneSignalNative, userId: string | null) {
  const granted = await OneSignal.Notifications.requestPermission(true);
  console.log('[OneSignal] permission granted:', granted);
  if (granted && userId) {
    await syncSubscription(OneSignal, userId);
  }
  return granted === true;
}

/**
 * Initialize OneSignal on native iOS/Android. No-op on web.
 * Call this once after the user is authenticated.
 */
export async function initOneSignal(userId: string | null) {
  if (!Capacitor.isNativePlatform()) return;
  if (initialized) {
    if (userId) await linkUserId(userId);
    return;
  }

  try {
    const OneSignal = getOneSignal();

    OneSignal.initialize(ONESIGNAL_APP_ID);
    registerNotificationClickListener(OneSignal);

    await requestPermissionAndSync(OneSignal, userId);

    OneSignal.User.pushSubscription.addEventListener('change', async (event) => {
      console.log('[OneSignal] subscription change:', event);
      const id = event?.current?.id;
      if (id && userId) {
        await saveSubscription(userId, id);
      }
    });

    if (userId) await linkUserId(userId);
    initialized = true;
  } catch (err) {
    console.error('[OneSignal] init failed:', err);
  }
}

export async function requestOneSignalPermission(userId: string | null) {
  if (!Capacitor.isNativePlatform()) return false;

  if (!initialized) {
    await initOneSignal(userId);
  }

  try {
    const OneSignal = getOneSignal();
    return await requestPermissionAndSync(OneSignal, userId);
  } catch (err) {
    console.error('[OneSignal] requestPermission failed:', err);
    return false;
  }
}

async function linkUserId(userId: string) {
  try {
    const OneSignal = getOneSignal();
    OneSignal.login(userId);
    await syncSubscription(OneSignal, userId);
  } catch (err) {
    console.error('[OneSignal] linkUserId failed:', err);
  }
}

async function syncSubscription(OneSignal: OneSignalNative, userId: string) {
  try {
    const id = OneSignal.User.pushSubscription.getIdAsync
      ? await OneSignal.User.pushSubscription.getIdAsync()
      : OneSignal.User.pushSubscription.id;
    if (id) await saveSubscription(userId, id);
  } catch (err) {
    console.error('[OneSignal] syncSubscription failed:', err);
  }
}

async function saveSubscription(userId: string, playerId: string) {
  try {
    const { error } = await supabase
      .from('onesignal_subscriptions')
      .upsert(
        { user_id: userId, player_id: playerId, platform: Capacitor.getPlatform() },
        { onConflict: 'user_id,player_id' },
      );
    if (error) throw error;
    console.log('[OneSignal] saved subscription', playerId);
  } catch (err) {
    console.error('[OneSignal] saveSubscription failed:', err);
  }
}

/**
 * Logout — call on sign-out to disassociate the device from this user.
 */
export async function logoutOneSignal() {
  if (!Capacitor.isNativePlatform() || !initialized) return;
  try {
    const OneSignal = getOneSignal();
    OneSignal.logout();
  } catch (err) {
    console.error('[OneSignal] logout failed:', err);
  }
}
