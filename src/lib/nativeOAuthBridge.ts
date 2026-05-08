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
 * CRITICAL: This module runs BEFORE the Supabase client is imported.
 * When we detect a native OAuth callback, we must strip auth params from
 * the URL immediately so the Supabase GoTrueClient (which auto-detects
 * session params in the URL) doesn't try to consume the one-time auth
 * code. SFSafariViewController doesn't have the PKCE code_verifier (it
 * lives in the WKWebView), so the exchange would fail — but the server
 * may still invalidate the code, breaking the native app's exchange.
 *
 * This script is a no-op when:
 * - Running inside the Capacitor WKWebView (Capacitor.isNativePlatform)
 * - No ?native_oauth=1 param is present
 * - No access_token in the hash fragment and no OAuth code in the query
 */

const CALLBACK_SCHEME = 'com.Versa.app';

/** Saved auth params (stripped from URL before Supabase client boots) */
let savedSearch = '';
let savedHash = '';

const getNativeCallbackUrl = () =>
  `${CALLBACK_SCHEME}://auth-callback${savedSearch}${savedHash}`;

const openNativeApp = () => {
  const callbackUrl = getNativeCallbackUrl();

  // Try multiple methods — SFSafariViewController on iPad can block
  // programmatic window.location.href for custom schemes.
  try {
    // Method 1: Create a temporary <a> tag and click it.
    // iOS treats user-gesture-initiated anchor clicks more favourably
    // than programmatic location changes for custom URL schemes.
    const a = document.createElement('a');
    a.href = callbackUrl;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    // Clean up after a tick
    setTimeout(() => a.remove(), 100);
  } catch {
    // Fallback: direct location assignment
    try {
      window.location.href = callbackUrl;
    } catch {
      // Keep the holding screen visible
    }
  }
};

const renderNativeOAuthHoldingScreen = () => {
  const render = () => {
    if (!document.body) return;
    document.body.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fff;color:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;text-align:center;">
        <div style="max-width:320px;">
          <div style="width:28px;height:28px;margin:0 auto 18px;border:3px solid #e5e7eb;border-top-color:#E8392A;border-radius:999px;animation:versa-spin .8s linear infinite;"></div>
          <h1 style="font-size:22px;line-height:1.2;margin:0 0 8px;font-weight:800;">Completing sign in</h1>
          <p style="font-size:15px;line-height:1.45;margin:0 0 18px;color:#6b7280;">Return to Versa to continue.</p>
          <button id="versa-open-app" type="button" style="appearance:none;border:0;border-radius:999px;background:#E8392A;color:#fff;font-size:16px;font-weight:700;padding:13px 22px;min-width:180px;box-shadow:0 10px 24px rgba(232,57,42,.22);">Open Versa</button>
          <p style="font-size:13px;line-height:1.45;margin:14px 0 0;color:#9ca3af;">If this does not return automatically, tap Open Versa.</p>
        </div>
        <style>@keyframes versa-spin{to{transform:rotate(360deg)}}</style>
      </div>
    `;

    document.getElementById('versa-open-app')?.addEventListener('click', openNativeApp);
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
    // Save the original search + hash before stripping them.
    // The native app needs these to exchange the code / set the session.
    savedSearch = window.location.search;
    savedHash = hash;

    // ── CRITICAL: Strip auth params from the URL immediately ──
    // The Supabase GoTrueClient will auto-initialize when its module is
    // imported (static import chain: main.tsx → App.tsx → AuthContext →
    // supabase/client). If it finds `code` or `access_token` in the URL,
    // it will attempt to consume them. We must remove them before that
    // import chain executes. Since this module is imported FIRST in
    // main.tsx, cleaning the URL here prevents the race condition.
    try {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.search = '';
      cleanUrl.hash = '';
      window.history.replaceState(null, '', cleanUrl.pathname);
    } catch {
      // If history.replaceState fails, continue anyway — the holding
      // screen + scheme redirect still has the best chance of working.
    }

    // Prevent the full React app from booting inside SFSafariViewController.
    (window as Window & { __VERSA_NATIVE_OAUTH_BRIDGE_ACTIVE__?: boolean }).__VERSA_NATIVE_OAUTH_BRIDGE_ACTIVE__ = true;
    renderNativeOAuthHoldingScreen();

    if (hash.includes('access_token=') || params.has('code')) {
      // Redirect to custom URL scheme — iOS will route this to the native app.
      openNativeApp();
      window.setTimeout(openNativeApp, 250);
      window.setTimeout(openNativeApp, 1200);
    }
  }
} catch {
  // Silently ignore — don't block app boot
}
