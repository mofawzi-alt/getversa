/**
 * Native OAuth Bridge — runs at the very top of the app entry point.
 *
 * When the native iOS app opens OAuth in SFSafariViewController, the
 * callback lands on https://getversa.app/?native_oauth=1#access_token=...
 * or https://getversa.app/?native_oauth=1&code=...
 *
 * SFSafariViewController loads our full web app at that URL. This module
 * detects the marker + tokens and immediately redirects to the custom URL
 * scheme (com.Versa.app://auth-callback#tokens), which hands control
 * back to the native Capacitor app.
 *
 * This script is a no-op when:
 * - Running inside the Capacitor WKWebView (Capacitor.isNativePlatform)
 * - No ?native_oauth=1 param is present
 * - No access_token in the hash fragment and no OAuth code in the query
 */

const CALLBACK_SCHEME = 'com.Versa.app';

const renderNativeOAuthHoldingScreen = () => {
  const render = () => {
    if (!document.body) return;
    document.body.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fff;color:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;text-align:center;">
        <div style="max-width:320px;">
          <div style="width:28px;height:28px;margin:0 auto 18px;border:3px solid #e5e7eb;border-top-color:#E8392A;border-radius:999px;animation:versa-spin .8s linear infinite;"></div>
          <h1 style="font-size:22px;line-height:1.2;margin:0 0 8px;font-weight:800;">Completing sign in</h1>
          <p style="font-size:15px;line-height:1.45;margin:0;color:#6b7280;">Return to Versa to continue.</p>
        </div>
        <style>@keyframes versa-spin{to{transform:rotate(360deg)}}</style>
      </div>
    `;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render, { once: true });
  } else {
    render();
  }
};

try {
  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash;

  if (params.get('native_oauth') === '1') {
    // Prevent the full React app from booting inside SFSafariViewController.
    // OAuth callback pages should only hand control back to the native app;
    // loading Home/Auth here can crash independently of the actual signed-in app.
    (window as Window & { __VERSA_NATIVE_OAUTH_BRIDGE_ACTIVE__?: boolean }).__VERSA_NATIVE_OAUTH_BRIDGE_ACTIVE__ = true;
    renderNativeOAuthHoldingScreen();

    if (hash.includes('access_token=') || params.has('code')) {
      // Redirect to custom URL scheme — iOS will route this to the native app.
      // SFSafariViewController will show a brief confirmation prompt.
      window.location.replace(`${CALLBACK_SCHEME}://auth-callback${window.location.search}${hash}`);
    }
  }
} catch {
  // Silently ignore — don't block app boot
}
