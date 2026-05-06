/**
 * Native OAuth Bridge — runs at the very top of the app entry point.
 *
 * When the native iOS app opens OAuth in SFSafariViewController, the
 * callback lands on https://getversa.app/?native_oauth=1#access_token=...
 *
 * SFSafariViewController loads our full web app at that URL. This module
 * detects the marker + tokens and immediately redirects to the custom URL
 * scheme (com.Versa.app://auth-callback#tokens), which hands control
 * back to the native Capacitor app.
 *
 * This script is a no-op when:
 * - Running inside the Capacitor WKWebView (Capacitor.isNativePlatform)
 * - No ?native_oauth=1 param is present
 * - No access_token in the hash fragment
 */

const CALLBACK_SCHEME = 'com.Versa.app';

try {
  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash;

  if (
    params.get('native_oauth') === '1' &&
    hash.includes('access_token=')
  ) {
    // Redirect to custom URL scheme — iOS will route this to the native app.
    // SFSafariViewController will show a brief confirmation prompt.
    window.location.replace(`${CALLBACK_SCHEME}://auth-callback${hash}`);
  }
} catch {
  // Silently ignore — don't block app boot
}
