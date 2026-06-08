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
    getPermissionAsync?: () => Promise<boolean>;
    canRequestPermission?: () => Promise<boolean>;
    permissionNative?: () => Promise<number>;
    addEventListener: (event: 'click', listener: (event: NotificationClickEvent) => void) => void;
  };
  User: {
    pushSubscription: {
      addEventListener: (event: 'change', listener: (event: PushSubscriptionChangeEvent) => void) => void;
      getIdAsync?: () => Promise<string | null | undefined>;
      id?: string | null;
      optIn?: () => void;
    };
  };
  login: (userId: string) => void;
  logout: () => void;
};

async function getOneSignal(): Promise<OneSignalNative | null> {
  if (!Capacitor.isNativePlatform()) return null;
  // The Cordova plugin injects itself onto the global scope at native runtime
  // (window.OneSignal / window.cordova.plugins.OneSignal). We read from there
  // because the web bundle is served from a URL — bare-specifier imports
  // can't be resolved at runtime inside the WebView.
  const w = window as unknown as {
    OneSignal?: OneSignalNative;
    plugins?: { OneSignal?: OneSignalNative };
    cordova?: { plugins?: { OneSignal?: OneSignalNative } };
  };
  // Wait briefly for cordova_plugins to finish wiring up on cold start.
  for (let i = 0; i < 20; i++) {
    const found =
      w.OneSignal ??
      w.cordova?.plugins?.OneSignal ??
      w.plugins?.OneSignal ??
      null;
    if (found) return found;
    await new Promise((r) => setTimeout(r, 100));
  }
  console.error('[OneSignal] native plugin global not found on window');
  return null;
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
  const before = await OneSignal.Notifications.getPermissionAsync?.().catch(() => false);
  const canPrompt = await OneSignal.Notifications.canRequestPermission?.().catch(() => null);
  const nativePermission = await OneSignal.Notifications.permissionNative?.().catch(() => null);
  console.log('[OneSignal] permission before request:', { before, canPrompt, nativePermission });

  const requested = before === true ? true : await OneSignal.Notifications.requestPermission(true);
  OneSignal.User.pushSubscription.optIn?.();

  const granted = requested === true || await OneSignal.Notifications.getPermissionAsync?.().catch(() => false) === true;
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
    const OneSignal = await getOneSignal();
    if (!OneSignal) return;

    OneSignal.initialize(ONESIGNAL_APP_ID);
    registerNotificationClickListener(OneSignal);

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

export type RequestPermissionResult =
  | { ok: true }
  | { ok: false; reason: 'not-native' | 'plugin-missing' | 'denied' | 'error'; message?: string };

export async function requestOneSignalPermission(userId: string | null): Promise<RequestPermissionResult> {
  if (!Capacitor.isNativePlatform()) return { ok: false, reason: 'not-native' };

  if (!initialized) {
    await initOneSignal(userId);
  }

  try {
    const OneSignal = await getOneSignal();
    if (!OneSignal) {
      return {
        ok: false,
        reason: 'plugin-missing',
        message: 'OneSignal native plugin not found. Run `npx cap sync ios` and rebuild in Xcode.',
      };
    }
    const granted = await requestPermissionAndSync(OneSignal, userId);
    return granted ? { ok: true } : { ok: false, reason: 'denied', message: 'Permission denied in iOS Settings.' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[OneSignal] requestPermission failed:', err);
    return { ok: false, reason: 'error', message };
  }
}

async function linkUserId(userId: string) {
  try {
    const OneSignal = await getOneSignal();
    if (!OneSignal) return;
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
    const OneSignal = await getOneSignal();
    if (!OneSignal) return;
    OneSignal.logout();
  } catch (err) {
    console.error('[OneSignal] logout failed:', err);
  }
}
