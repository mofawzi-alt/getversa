/**
 * Native OAuth for iOS via SFSafariViewController.
 *
 * Apple App Store guideline 4 requires OAuth / sign-in flows to use
 * ASWebAuthenticationSession or SFSafariViewController rather than
 * plain WKWebView. On native Capacitor we:
 *   1. Ask Supabase for the OAuth URL (skipBrowserRedirect: true)
 *   2. Open it in SFSafariViewController via @capacitor/browser
 *   3. Listen for the custom-scheme callback via @capacitor/app
 *   4. Parse tokens from the URL hash, set the Supabase session
 *   5. Close the browser overlay
 *
 * On web the module is a no-op — the standard lovable managed OAuth runs.
 */

import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

/** Custom URL scheme registered by Capacitor for this app ID */
const CALLBACK_SCHEME = 'com.Versa.app';
const CALLBACK_URL = `${CALLBACK_SCHEME}://auth-callback`;

/**
 * Attempt OAuth via SFSafariViewController on native.
 * @returns `true` if the native flow was handled (success OR user-cancelled).
 *          `false` if not on native — caller should fall back to web flow.
 */
export async function startNativeOAuth(
  provider: 'google' | 'apple',
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  const [{ Browser }, { App }] = await Promise.all([
    import('@capacitor/browser'),
    import('@capacitor/app'),
  ]);

  // 1. Get the OAuth URL without navigating
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      skipBrowserRedirect: true,
      redirectTo: CALLBACK_URL,
    },
  });

  if (error || !data?.url) {
    throw new Error(error?.message || 'Failed to build OAuth URL');
  }

  // 2. Wire up listeners BEFORE opening the browser
  return new Promise<boolean>((resolve) => {
    let settled = false;

    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      urlListener.then((h) => h.remove()).catch(() => {});
      browserListener.then((h) => h.remove()).catch(() => {});
      resolve(value);
    };

    // Listen for the custom-scheme redirect
    const urlListener = App.addListener('appUrlOpen', async ({ url }) => {
      if (!url.startsWith(`${CALLBACK_SCHEME}://auth-callback`)) return;

      try {
        await Browser.close();
      } catch {
        // browser may already be closed
      }

      // Tokens arrive in the URL fragment: #access_token=…&refresh_token=…
      const hash = url.includes('#') ? url.split('#')[1] : '';
      const params = new URLSearchParams(hash);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');

      if (access_token && refresh_token) {
        try {
          await supabase.auth.setSession({ access_token, refresh_token });
        } catch (e) {
          console.error('[nativeOAuth] setSession failed', e);
        }
      }
      settle(true);
    });

    // User may dismiss the Safari sheet without completing auth
    const browserListener = Browser.addListener('browserFinished', () => {
      settle(true); // handled (user cancelled)
    });

    // 3. Open SFSafariViewController
    Browser.open({
      url: data.url,
      presentationStyle: 'popover',
      windowName: '_self',
    }).catch(() => settle(false));
  });
}
