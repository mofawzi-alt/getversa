import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { supabase } from '@/integrations/supabase/client';

/**
 * OneSignal native bridge for iOS (and Android — same shape).
 *
 * The native OneSignal SDK is initialized in AppDelegate.swift (via
 * scripts/add-onesignal-sdk.mjs). It:
 *   • Requests permission on first launch.
 *   • Writes the subscription/player id to UserDefaults under
 *     `CapacitorStorage` → key `onesignal_player_id`.
 *   • Watches `onesignal_pending_user_id` and calls OneSignal.login/logout
 *     whenever it changes.
 *
 * So the JS side here just:
 *   • Writes the current user id into Capacitor Preferences (native picks it up).
 *   • Polls/reads `onesignal_player_id` and saves it to Supabase.
 *
 * On web, this whole module is a no-op (web push uses usePushNotifications).
 */

const PLAYER_ID_KEY = 'onesignal_player_id';
const PENDING_USER_ID_KEY = 'onesignal_pending_user_id';

function isNative(): boolean {
  return Capacitor?.isNativePlatform?.() === true;
}

export type RequestPermissionResult =
  | { ok: true }
  | { ok: false; reason: 'not-native' | 'plugin-missing' | 'denied' | 'error'; message?: string };

/**
 * Initialize the OneSignal link for this user.
 * Call after sign-in. Safe to call multiple times.
 */
export async function initOneSignal(userId: string | null): Promise<void> {
  if (!isNative()) return;
  try {
    if (userId) {
      await Preferences.set({ key: PENDING_USER_ID_KEY, value: userId });
    }
    // Try to capture the player id if native already produced one.
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
    if (userId) {
      await Preferences.set({ key: PENDING_USER_ID_KEY, value: userId });
    }

    // Give the native SDK a moment to produce a player id if it hasn't yet.
    let playerId: string | null = null;
    for (let i = 0; i < 20; i++) {
      const { value } = await Preferences.get({ key: PLAYER_ID_KEY });
      if (value) {
        playerId = value;
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
    await Preferences.set({ key: PENDING_USER_ID_KEY, value: '' });
  } catch (err) {
    console.error('[OneSignal] logoutOneSignal failed', err);
  }
}

async function syncPlayerIdToSupabase(userId: string | null): Promise<void> {
  if (!userId) return;
  const { value } = await Preferences.get({ key: PLAYER_ID_KEY });
  if (value) {
    await saveSubscription(userId, value);
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
