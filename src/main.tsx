import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import "./lib/nativeOAuthBridge"; // Must run before anything else
import "./lib/authRedirectCapture";
import App from "./App.tsx";
import "./index.css";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { getNotificationRoute, initOneSignal, openNotificationRoute } from "@/lib/onesignal";

declare global {
  interface Window {
    __VERSA_NATIVE_OAUTH_BRIDGE_ACTIVE__?: boolean;
  }
}

if (window.__VERSA_NATIVE_OAUTH_BRIDGE_ACTIVE__) {
  console.info("[Versa] Native OAuth bridge handled callback before app boot.");
} else {

// Native iOS: make the WebView extend under the status bar so our
// safe-area CSS (env(safe-area-inset-top)) is the single source of truth
// for the header offset. Without this, iOS leaves a white bar AND our
// CSS adds extra padding, causing the logo to overlap the notch.
if (Capacitor?.isNativePlatform?.()) {
  void initOneSignal(null);
  // Tell Capgo this bundle booted successfully so it doesn't roll back.
  void (async () => {
    try {
      const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
      await CapacitorUpdater.notifyAppReady();
    } catch (err) {
      console.warn("[CapacitorUpdater] notifyAppReady failed", err);
    }
  })();
  void CapacitorApp.getLaunchUrl().then((launch) => {
    const route = getNotificationRoute(launch?.url);
    if (route && route !== "/home") openNotificationRoute(route);
  }).catch(() => {});
  void CapacitorApp.addListener("appUrlOpen", ({ url }) => {
    const route = getNotificationRoute(url);
    if (route && route !== "/home" && !route.startsWith("/auth-callback")) openNotificationRoute(route);
  });

  void (async () => {
    try {
      const { StatusBar, Style } = await import("@capacitor/status-bar");
      await StatusBar.setOverlaysWebView({ overlay: true });
      await StatusBar.setStyle({ style: Style.Dark });
    } catch (err) {
      console.warn("[StatusBar] setup failed", err);
    }
    try {
      const { Keyboard } = await import("@capacitor/keyboard");
      // Hide the iOS keyboard accessory bar (gray bar with ↑ ↓ ✓)
      // so inputs look clean like iMessage.
      await Keyboard.setAccessoryBarVisible({ isVisible: false });
    } catch (err) {
      console.warn("[Keyboard] hide accessory bar failed", err);
    }
  })();
}

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

const isNativeApp = Capacitor?.isNativePlatform?.() === true;

const clearServiceWorkersAndCaches = async () => {
  if (!("serviceWorker" in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));

  if ("caches" in window) {
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
  }
};

if (isPreviewHost || isInIframe || isNativeApp) {
  void clearServiceWorkersAndCaches();
}

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
}
