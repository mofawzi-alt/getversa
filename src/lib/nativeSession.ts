// Persists Supabase tokens into Capacitor Preferences (iOS Keychain / Android EncryptedSharedPreferences)
// so the session survives WKWebView localStorage purges between cold launches.
// Web is a no-op.
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

const KEY = 'versa.sb.session.v1';
const FORCE_LOGGED_OUT_KEY = 'versa.sb.force_logged_out.v1';

export const isNative = () => {
  try { return Capacitor?.isNativePlatform?.() === true; } catch { return false; }
};

/** Production URL used for native OAuth redirects (window.location.origin
 *  resolves to capacitor:// or localhost on native, which Supabase rejects). */
export const NATIVE_AUTH_REDIRECT_URL = 'https://getversa.app/';

/** Returns the right redirect URL for `emailRedirectTo` / OAuth on each platform. */
export const getAuthRedirectUrl = (): string => {
  if (isNative()) return NATIVE_AUTH_REDIRECT_URL;
  try { return `${window.location.origin}/`; } catch { return NATIVE_AUTH_REDIRECT_URL; }
};

const getPrefs = async () => {
  if (!isNative()) return null;
  try {
    const mod = await import('@capacitor/preferences');
    return mod.Preferences;
  } catch {
    return null;
  }
};

export const markNativeLoggedOut = async () => {
  const Preferences = await getPrefs();
  if (!Preferences) return;
  try {
    await Preferences.set({ key: FORCE_LOGGED_OUT_KEY, value: 'true' });
  } catch {}
};

export const clearNativeLoggedOut = async () => {
  const Preferences = await getPrefs();
  if (!Preferences) return;
  try {
    await Preferences.remove({ key: FORCE_LOGGED_OUT_KEY });
  } catch {}
};

export const isNativeLoggedOut = async (): Promise<boolean> => {
  const Preferences = await getPrefs();
  if (!Preferences) return false;
  try {
    const { value } = await Preferences.get({ key: FORCE_LOGGED_OUT_KEY });
    return value === 'true';
  } catch {
    return false;
  }
};

export const persistSessionNative = async (session: { access_token: string; refresh_token: string } | null) => {
  const Preferences = await getPrefs();
  if (!Preferences) return;
  try {
    if (!session) {
      await Preferences.remove({ key: KEY });
      return;
    }
    await Preferences.remove({ key: FORCE_LOGGED_OUT_KEY });
    await Preferences.set({
      key: KEY,
      value: JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      }),
    });
  } catch {}
};

export const restoreSessionNative = async (): Promise<boolean> => {
  const Preferences = await getPrefs();
  if (!Preferences) return false;
  try {
    const { value: forcedLoggedOut } = await Preferences.get({ key: FORCE_LOGGED_OUT_KEY });
    if (forcedLoggedOut === 'true') return false;

    const { value } = await Preferences.get({ key: KEY });
    if (!value) return false;
    const parsed = JSON.parse(value) as { access_token: string; refresh_token: string };
    if (!parsed?.refresh_token) return false;
    const { data, error } = await supabase.auth.setSession(parsed);
    if (error || !data.session) return false;
    return true;
  } catch {
    return false;
  }
};

export const clearNativeSession = async () => {
  const Preferences = await getPrefs();
  if (!Preferences) return;
  try { await Preferences.remove({ key: KEY }); } catch {}
};

/** Wire Supabase auth changes to native persistence. Call once at app boot. */
export const installNativeSessionMirror = () => {
  if (!isNative()) return;
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) {
      void persistSessionNative({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
    } else {
      void clearNativeSession();
    }
  });
};
