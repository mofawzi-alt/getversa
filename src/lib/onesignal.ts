import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import OneSignal, { LogLevel } from '@onesignal/capacitor-plugin';
import { supabase } from '@/integrations/supabase/client';

/**
 * OneSignal native bridge for iOS/Android.
 * On web, this whole module is a no-op (web push uses usePushNotifications).
 */

const ONESIGNAL_APP_ID = '0b64a490-9689-42c9-80a3-e84a0e4f1a0b';
const PLAYER_ID_KEY = 'onesignal_player_id';
const PENDING_USER_ID_KEY = 'onesignal_pending_user_id';
let initPromise: Promise<void> | null = null;

function isNative(): boolean {
  return Capacitor?.isNativePlatform?.() === true;
}

export type RequestPermissionResult =
  | { ok: true }
  | { ok: false; reason: 'not-native' | 'denied' | 'error'; message?: string };

async function ensureOneSignalInitialized(userId: string | null): Promise<void> {
  if (!isNative()) return;
  initPromise ??= (async () => {
    OneSignal.Debug.setLogLevel(LogLevel.Warn);
    await OneSignal.initialize(ONESIGNAL_APP_ID);
  })();
  await initPromise;

  if (userId) {
    await OneSignal.login(userId);
    await Preferences.set({ key: PENDING_USER_ID_KEY, value: userId });
  }
}

/**
 * Initialize the OneSignal link for this user.
 * Call after sign-in. Safe to call multiple times.
 */
export async function initOneSignal(userId: string | null): Promise<void> {
  if (!isNative()) return;
  try {
    await ensureOneSignalInitialized(userId);
    await syncPlayerIdToSupabase(userId);
  } catch (err) {
    console.error('[OneSignal] initOneSignal failed', err);
  }
}

/**
 * Trigger the iOS permission prompt and link this device to the user.
 * The native prompt is shown automatically on first launch by AppDelegate;
 * calling this re-checks state and persists the subscription.
 */
export async function requestOneSignalPermission(
  userId: string | null,
): Promise<RequestPermissionResult> {
  if (!isNative()) return { ok: false, reason: 'not-native' };

  try {
    await ensureOneSignalInitialized(userId);
    const accepted = await OneSignal.Notifications.requestPermission(true);
    await OneSignal.User.pushSubscription.optIn();

    if (!accepted) {
      return {
        ok: false,
        reason: 'denied',
        message: 'Turn on notifications in Settings → Versa → Notifications.',
      };
    }

    // Give OneSignal/APNs a moment to produce a subscription id if it hasn't yet.
    let playerId: string | null = null;
    for (let i = 0; i < 20; i++) {
      const id = await OneSignal.User.pushSubscription.getIdAsync();
      if (id) {
        playerId = id;
        await Preferences.set({ key: PLAYER_ID_KEY, value: id });
        break;
      }
      await new Promise((r) => setTimeout(r, 250));
    }

    if (!playerId) {
      return {
        ok: false,
        reason: 'denied',
        message:
          'Notifications not yet enabled. If iOS asked for permission, choose Allow. Otherwise enable in Settings → Versa → Notifications.',
      };
    }

    if (userId) {
      await saveSubscription(userId, playerId);
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[OneSignal] requestOneSignalPermission failed', err);
    return { ok: false, reason: 'error', message };
  }
}

/**
 * Sign-out hook — clears the pending user id so native calls OneSignal.logout.
 */
export async function logoutOneSignal(): Promise<void> {
  if (!isNative()) return;
  try {
    await ensureOneSignalInitialized(null);
    await OneSignal.logout();
    await Preferences.set({ key: PENDING_USER_ID_KEY, value: '' });
  } catch (err) {
    console.error('[OneSignal] logoutOneSignal failed', err);
  }
}

async function syncPlayerIdToSupabase(userId: string | null): Promise<void> {
  if (!userId) return;
  const playerId = await OneSignal.User.pushSubscription.getIdAsync();
  if (playerId) {
    await Preferences.set({ key: PLAYER_ID_KEY, value: playerId });
    await saveSubscription(userId, playerId);
  }
}

async function saveSubscription(userId: string, playerId: string): Promise<void> {
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
    console.error('[OneSignal] saveSubscription failed', err);
  }
}

/**
 * Route helpers kept for backwards compatibility with the rest of the app
 * (notification click handler used to live here). The native click handler
 * is now wired by OneSignal directly inside AppDelegate; deep-link handling
 * for clicked notifications continues to use the existing
 * `versa:navigate` event listeners in the app shell.
 */
export function getNotificationRoute(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const raw = value.trim();
  if (raw.startsWith('/')) return raw;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/home';
    }
  } catch {
    return null;
  }
  return null;
}

export function openNotificationRoute(route: string): void {
  try {
    localStorage.setItem('versa_pending_notification_route', route);
  } catch {
    /* noop */
  }
  window.dispatchEvent(new CustomEvent('versa:navigate', { detail: { url: route } }));
}
