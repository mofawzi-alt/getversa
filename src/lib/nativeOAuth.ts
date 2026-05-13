/**
 * Native OAuth for iOS via SFSafariViewController.
 *
 * Apple App Store guideline 4 requires OAuth / sign-in flows to use
 * ASWebAuthenticationSession or SFSafariViewController rather than
 * plain WKWebView. On native Capacitor we:
 *   1. Ask Supabase for the OAuth URL (skipBrowserRedirect: true)
 *   2. Open it in SFSafariViewController via @capacitor/browser
 *   3. After auth, Supabase redirects to https://getversa.app/?native_oauth=1#tokens
 *   4. The page detects the marker and bridges tokens to the custom URL scheme
 *   5. @capacitor/app catches the deep link, we parse tokens and set session
 *
 * On web the module is a no-op — the standard lovable managed OAuth runs.
 */

import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

/** Custom URL schemes registered by Capacitor for OAuth callbacks */
const CALLBACK_SCHEMES = ['com.versa.app', 'com.Versa.app'];

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

  // Use the live site URL with a marker so the landing page can bridge
  // tokens back to the native app via the custom URL scheme.
  const redirectTo = 'https://getversa.app/?native_oauth=1';

  // Build the Lovable Cloud managed OAuth broker URL directly.
  // (Supabase direct OAuth would require manually configured client secrets;
  //  the broker uses Lovable's managed Google credentials automatically.)
  const state = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const brokerParams = new URLSearchParams({
    provider,
    redirect_uri: redirectTo,
    state,
  });
  const oauthUrl = `https://getversa.app/~oauth/initiate?${brokerParams.toString()}`;
  const data = { url: oauthUrl };

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

    // Listen for the custom-scheme redirect (bridged by the landing page)
    const urlListener = App.addListener('appUrlOpen', async ({ url }) => {
      if (!CALLBACK_SCHEMES.some((scheme) => url.startsWith(`${scheme}://auth-callback`))) return;

      try {
        await Browser.close();
      } catch {
        // browser may already be closed
      }

      // Tokens arrive in the URL fragment: #access_token=…&refresh_token=…
      const hash = url.includes('#') ? url.split('#')[1] : '';
      const params = new URLSearchParams(hash);
      const queryString = (() => {
        const queryStart = url.indexOf('?');
        if (queryStart === -1) return '';
        const hashStart = url.indexOf('#', queryStart);
        return url.slice(queryStart + 1, hashStart === -1 ? undefined : hashStart);
      })();
      const query = new URLSearchParams(queryString);
      const code = query.get('code');
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');

      if (code) {
        try {
          await supabase.auth.exchangeCodeForSession(code);
        } catch (e) {
          console.error('[nativeOAuth] exchangeCodeForSession failed', e);
        }
      } else if (access_token && refresh_token) {
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
