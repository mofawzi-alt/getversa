import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

const ONESIGNAL_APP_ID = '0b64a490-9689-42c9-80a3-e84a0e4f1a0b';

let initialized = false;
let clickListenerRegistered = false;

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
      return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/home';
    }
  } catch {
    return null;
  }
  return null;
}

function dispatchNotificationRoute(route: string) {
  try { localStorage.setItem('versa_pending_notification_route', route); } catch {}
  window.dispatchEvent(new CustomEvent('versa:navigate', { detail: { url: route } }));
}

export function getNotificationRoute(value: unknown): string | null {
  return normalizeNotificationRoute(value);
}

export function openNotificationRoute(route: string) {
  dispatchNotificationRoute(route);
}

function registerNotificationClickListener(OneSignal: any) {
  if (clickListenerRegistered) return;
  try {
    OneSignal.Notifications.addEventListener('click', (event: any) => {
      const additionalData = event?.notification?.additionalData ?? {};
      const route = normalizeNotificationRoute(additionalData.url ?? event?.result?.url);
      if (route) dispatchNotificationRoute(route);
    });
    clickListenerRegistered = true;
  } catch (err) {
    console.error('[OneSignal] click listener failed:', err);
  }
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
    // Dynamic import — package is only available on native builds with Cordova bridge
    const mod = await import('onesignal-cordova-plugin');
    const OneSignal = (mod as any).default ?? mod;

    OneSignal.initialize(ONESIGNAL_APP_ID);
    registerNotificationClickListener(OneSignal);

    // Prompt for permission
    OneSignal.Notifications.requestPermission(true).then(async (granted: boolean) => {
      console.log('[OneSignal] permission granted:', granted);
      if (granted && userId) {
        await syncSubscription(OneSignal, userId);
      }
    });

    // Listen for subscription changes (token can arrive after init)
    OneSignal.User.pushSubscription.addEventListener('change', async (event: any) => {
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

async function linkUserId(userId: string) {
  try {
    const mod = await import('onesignal-cordova-plugin');
    const OneSignal = (mod as any).default ?? mod;
    OneSignal.login(userId);
    await syncSubscription(OneSignal, userId);
  } catch (err) {
    console.error('[OneSignal] linkUserId failed:', err);
  }
}

async function syncSubscription(OneSignal: any, userId: string) {
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
    const mod = await import('onesignal-cordova-plugin');
    const OneSignal = (mod as any).default ?? mod;
    OneSignal.logout();
  } catch (err) {
    console.error('[OneSignal] logout failed:', err);
  }
}
