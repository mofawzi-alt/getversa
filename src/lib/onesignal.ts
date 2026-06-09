import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import OneSignal, { LogLevel, OSNotificationPermission, type PushSubscriptionChangedState } from '@onesignal/capacitor-plugin';
import { supabase } from '@/integrations/supabase/client';

/**
 * OneSignal native bridge for iOS/Android.
 * On web, this whole module is a no-op (web push uses usePushNotifications).
 */

const ONESIGNAL_APP_ID = '0b64a490-9689-42c9-80a3-e84a0e4f1a0b';
const PLAYER_ID_KEY = 'onesignal_player_id';
const PENDING_USER_ID_KEY = 'onesignal_pending_user_id';
let initPromise: Promise<void> | null = null;
let observerRegistered = false;
let activeUserId: string | null = null;

function isNative(): boolean {
  return Capacitor?.isNativePlatform?.() === true;
}

export type RequestPermissionResult =
  | { ok: true }
  | { ok: false; reason: 'not-native' | 'missing-plugin' | 'denied' | 'error'; message?: string };

function permissionIsEnabled(permission: number): boolean {
  return permission === OSNotificationPermission.Authorized
    || permission === OSNotificationPermission.Provisional
    || permission === OSNotificationPermission.Ephemeral;
}

function hasOneSignalPlugin(): boolean {
  return Capacitor?.isPluginAvailable?.('OneSignalCapacitor') === true;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(label)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function registerSubscriptionObserver() {
  if (observerRegistered) return;
  observerRegistered = true;
  OneSignal.User.pushSubscription.addEventListener('change', (event: PushSubscriptionChangedState) => {
    const playerId = event.current?.id ?? null;
    if (!playerId) return;
    void Preferences.set({ key: PLAYER_ID_KEY, value: playerId });
    if (activeUserId) {
      void saveSubscription(activeUserId, playerId);
    }
  });
}

async function waitForPushSubscriptionId(timeoutMs = 5_000): Promise<string | null> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const id = await withTimeout(OneSignal.User.pushSubscription.getIdAsync(), 2_000, 'OneSignal subscription id check timed out');
    if (id) return id;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

async function ensureOneSignalInitialized(userId: string | null): Promise<void> {
  if (!isNative()) return;
  initPromise ??= (async () => {
    OneSignal.Debug.setLogLevel(LogLevel.Warn);
    await withTimeout(OneSignal.initialize(ONESIGNAL_APP_ID), 5_000, 'OneSignal initialize timed out');
    registerSubscriptionObserver();
  })();
  try {
    await initPromise;
  } catch (error) {
    initPromise = null;
    throw error;
  }

  if (userId) {
    activeUserId = userId;
    await withTimeout(OneSignal.login(userId), 5_000, 'OneSignal login timed out');
    await Preferences.set({ key: PENDING_USER_ID_KEY, value: userId });
  } else {
    activeUserId = null;
  }
}

/**
 * Initialize the OneSignal link for this user.
 * Call after sign-in. Safe to call multiple times.
 */
export async function initOneSignal(userId: string | null): Promise<void> {
  if (!isNative()) return;
  if (!hasOneSignalPlugin()) {
    console.warn('[OneSignal] Native plugin missing. A new iOS build is required before push can be enabled.');
    return;
  }
  try {
    await ensureOneSignalInitialized(userId);
    const hasPermission = await OneSignal.Notifications.hasPermission();
    if (hasPermission) {
      await OneSignal.User.pushSubscription.optIn();
      void waitForPushSubscriptionId(10_000).then((playerId) => {
        if (playerId && userId) void saveSubscription(userId, playerId);
      });
    }
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
  if (!hasOneSignalPlugin()) {
    return {
      ok: false,
      reason: 'missing-plugin',
      message: 'This installed iOS build is missing the native notification plugin. Install a fresh TestFlight/App Store build after running npm run ios:update.',
    };
  }

  try {
    await ensureOneSignalInitialized(userId);

    const nativePermission = await withTimeout(
      OneSignal.Notifications.permissionNative(),
      3_000,
      'OneSignal native permission check timed out',
    );
    let accepted = permissionIsEnabled(nativePermission) || await withTimeout(
      OneSignal.Notifications.hasPermission(),
      3_000,
      'OneSignal permission check timed out',
    );

    if (!accepted) {
      accepted = await withTimeout(
        OneSignal.Notifications.requestPermission(true),
        15_000,
        'OneSignal permission request timed out',
      );
    }

    accepted = accepted || await withTimeout(
      OneSignal.Notifications.hasPermission(),
      3_000,
      'OneSignal permission recheck timed out',
    );
    await withTimeout(OneSignal.User.pushSubscription.optIn(), 5_000, 'OneSignal opt-in timed out');

    if (!accepted) {
      return {
        ok: false,
        reason: 'denied',
        message: 'Turn on notifications in Settings → Versa → Notifications.',
      };
    }

    // Give OneSignal/APNs a moment to produce a subscription id if it hasn't yet.
    const playerId = await waitForPushSubscriptionId();

    if (!playerId) {
      return { ok: true };
    }

    await Preferences.set({ key: PLAYER_ID_KEY, value: playerId });
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
    activeUserId = null;
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
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const { error } = await supabase
        .from('onesignal_subscriptions')
        .upsert(
          { user_id: userId, player_id: playerId, platform: Capacitor.getPlatform() },
          { onConflict: 'user_id,player_id' },
        );
      if (error) throw error;
      console.log('[OneSignal] saved subscription', playerId);
      return;
    } catch (err) {
      if (attempt === 5) {
        console.error('[OneSignal] saveSubscription failed', err);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
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
