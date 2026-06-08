import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

const ONESIGNAL_APP_ID = '0b64a490-9689-42c9-80a3-e84a0e4f1a0b';

type OneSignalClickEvent = {
  notification?: {
    additionalData?: Record<string, unknown>;
    launchURL?: string;
    url?: string;
  };
  result?: { url?: string };
  url?: string;
};

type OneSignalSubscriptionChangeEvent = {
  current?: { id?: string | null };
};

type OneSignalPlugin = {
  initialize: (appId: string) => void;
  login: (userId: string) => void;
  logout: () => void;
  Notifications: {
    addEventListener?: (eventName: 'click', listener: (event: OneSignalClickEvent) => void) => void;
    getPermissionAsync?: () => Promise<boolean>;
    permission?: boolean;
    canRequestPermission?: boolean;
    requestPermission?: (fallbackToSettings?: boolean) => Promise<boolean>;
  };
  User: {
    pushSubscription: {
      addEventListener?: (eventName: 'change', listener: (event: OneSignalSubscriptionChangeEvent) => void) => void;
      getIdAsync?: () => Promise<string | null>;
      id?: string | null;
      getOptedInAsync?: () => Promise<boolean>;
      optedIn?: boolean;
      optIn?: () => Promise<void> | void;
      optOut?: () => Promise<void> | void;
    };
  };
};

let initialized = false;
let clickListenerRegistered = false;
let subscriptionListenerRegistered = false;
let activeUserId: string | null = null;

async function loadOneSignal(): Promise<OneSignalPlugin | null> {
  if (!Capacitor.isNativePlatform()) return null;
  const mod = await import('onesignal-cordova-plugin') as unknown as OneSignalPlugin & { default?: OneSignalPlugin };
  return mod.default ?? mod;
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
  try { localStorage.setItem('versa_pending_notification_route', route); } catch { console.warn('[OneSignal] could not store pending route'); }
  window.dispatchEvent(new CustomEvent('versa:navigate', { detail: { url: route } }));
}

export function getNotificationRoute(value: unknown): string | null {
  return normalizeNotificationRoute(value);
}

export function openNotificationRoute(route: string) {
  dispatchNotificationRoute(route);
}

function registerNotificationClickListener(OneSignal: OneSignalPlugin) {
  if (clickListenerRegistered) return;
  try {
    OneSignal.Notifications.addEventListener?.('click', (event) => {
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

function registerPushSubscriptionListener(OneSignal: OneSignalPlugin) {
  if (subscriptionListenerRegistered) return;
  try {
    OneSignal.User.pushSubscription.addEventListener?.('change', async (event) => {
      console.log('[OneSignal] subscription change:', event);
      const id = event?.current?.id;
      if (id && activeUserId) {
        await saveSubscription(activeUserId, id);
      }
    });
    subscriptionListenerRegistered = true;
  } catch (err) {
    console.error('[OneSignal] subscription listener failed:', err);
  }
}

async function readNativePermission(OneSignal: OneSignalPlugin): Promise<boolean> {
  if (typeof OneSignal.Notifications?.getPermissionAsync === 'function') {
    return Boolean(await OneSignal.Notifications.getPermissionAsync());
  }
  return Boolean(OneSignal.Notifications?.permission);
}

function canRequestNativePermission(OneSignal: OneSignalPlugin): boolean {
  const canRequest = OneSignal.Notifications?.canRequestPermission;
  return typeof canRequest === 'boolean' ? canRequest : true;
}

async function requestOneSignalPermission(OneSignal: OneSignalPlugin): Promise<boolean> {
  if (await readNativePermission(OneSignal)) return true;

  if (typeof OneSignal.Notifications?.requestPermission === 'function') {
    const granted = await OneSignal.Notifications.requestPermission(true);
    return Boolean(granted) || await readNativePermission(OneSignal);
  }

  return false;
}

async function getPushSubscriptionId(OneSignal: OneSignalPlugin): Promise<string | null> {
  const pushSubscription = OneSignal.User?.pushSubscription;
  if (!pushSubscription) return null;

  if (typeof pushSubscription.getIdAsync === 'function') {
    return await pushSubscription.getIdAsync();
  }

  return pushSubscription.id ?? null;
}

async function isPushOptedIn(OneSignal: OneSignalPlugin): Promise<boolean> {
  const pushSubscription = OneSignal.User?.pushSubscription;
  if (!pushSubscription) return false;

  if (typeof pushSubscription.getOptedInAsync === 'function') {
    return Boolean(await pushSubscription.getOptedInAsync());
  }

  if (typeof pushSubscription.optedIn === 'boolean') {
    return pushSubscription.optedIn;
  }

  return true;
}

async function optInNativePush(OneSignal: OneSignalPlugin) {
  const pushSubscription = OneSignal.User?.pushSubscription;
  if (typeof pushSubscription?.optIn === 'function') {
    await pushSubscription.optIn();
  }
}

/**
 * Initialize OneSignal on native iOS/Android. No-op on web.
 * Call this once after the user is authenticated.
 */
export async function initOneSignal(userId: string | null) {
  if (!Capacitor.isNativePlatform()) return;
  activeUserId = userId;
  if (initialized) {
    if (userId) await linkUserId(userId);
    return;
  }

  try {
    const OneSignal = await loadOneSignal();
    if (!OneSignal) return;

    OneSignal.initialize(ONESIGNAL_APP_ID);
    registerNotificationClickListener(OneSignal);
    registerPushSubscriptionListener(OneSignal);

    OneSignal.Notifications.requestPermission(true).then(async (granted: boolean) => {
      console.log('[OneSignal] permission granted:', granted);
      if (granted && userId) {
        await optInNativePush(OneSignal);
        await syncSubscription(OneSignal, userId);
      }
    });

    if (userId) await linkUserId(userId);
    initialized = true;
  } catch (err) {
    console.error('[OneSignal] init failed:', err);
  }
}

async function linkUserId(userId: string) {
  try {
    activeUserId = userId;
    const OneSignal = await loadOneSignal();
    if (!OneSignal) return;
    OneSignal.login(userId);
    await syncSubscription(OneSignal, userId);
  } catch (err) {
    console.error('[OneSignal] linkUserId failed:', err);
  }
}

async function syncSubscription(OneSignal: OneSignalPlugin, userId: string) {
  try {
    const id = await getPushSubscriptionId(OneSignal);
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

export async function getNativeOneSignalStatus(userId: string | null) {
  if (!Capacitor.isNativePlatform()) {
    return { supported: false, permission: 'default' as NotificationPermission, subscribed: false };
  }

  await initOneSignal(userId);
  const OneSignal = await loadOneSignal();
  if (!OneSignal) {
    return { supported: false, permission: 'default' as NotificationPermission, subscribed: false };
  }

  const granted = await readNativePermission(OneSignal);
  const subscriptionId = await getPushSubscriptionId(OneSignal);
  const optedIn = await isPushOptedIn(OneSignal);
  const permission: NotificationPermission = granted
    ? 'granted'
    : canRequestNativePermission(OneSignal)
      ? 'default'
      : 'denied';

  if (userId && granted && subscriptionId && optedIn) {
    await saveSubscription(userId, subscriptionId);
  }

  return {
    supported: true,
    permission,
    subscribed: granted && Boolean(subscriptionId) && optedIn,
  };
}

export async function requestNativeOneSignalPush(userId: string) {
  if (!Capacitor.isNativePlatform()) return false;

  await initOneSignal(userId);
  const OneSignal = await loadOneSignal();
  if (!OneSignal) return false;

  OneSignal.login(userId);
  const granted = await requestOneSignalPermission(OneSignal);
  if (!granted) return false;

  await optInNativePush(OneSignal);
  await syncSubscription(OneSignal, userId);
  const subscriptionId = await getPushSubscriptionId(OneSignal);
  return Boolean(subscriptionId);
}

export async function disableNativeOneSignalPush(userId: string) {
  if (!Capacitor.isNativePlatform()) return;

  const OneSignal = await loadOneSignal();
  const pushSubscription = OneSignal?.User?.pushSubscription;
  if (typeof pushSubscription?.optOut === 'function') {
    await pushSubscription.optOut();
  }

  await supabase
    .from('onesignal_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('platform', Capacitor.getPlatform());
}

/**
 * Logout — call on sign-out to disassociate the device from this user.
 */
export async function logoutOneSignal() {
  if (!Capacitor.isNativePlatform() || !initialized) return;
  try {
    activeUserId = null;
    const OneSignal = await loadOneSignal();
    if (!OneSignal) return;
    OneSignal.logout();
  } catch (err) {
    console.error('[OneSignal] logout failed:', err);
  }
}
