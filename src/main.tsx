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

// Native iOS boot work — deferred until AFTER first paint so the home screen
// can render as fast as possible. None of these are needed to draw the UI.
const runNativeBootTasks = () => {
  if (!Capacitor?.isNativePlatform?.()) return;

  // 1) StatusBar first — only thing that affects layout, runs ASAP.
  void (async () => {
    try {
      const { StatusBar, Style } = await import("@capacitor/status-bar");
      await StatusBar.setOverlaysWebView({ overlay: true });
      await StatusBar.setStyle({ style: Style.Dark });
    } catch (err) {
      console.warn("[StatusBar] setup failed", err);
    }
  })();

  // 2) Hide native splash screen the instant React is on screen.
  void (async () => {
    try {
      const { SplashScreen } = await import("@capacitor/splash-screen");
      await SplashScreen.hide({ fadeOutDuration: 200 });
    } catch (err) {
      console.warn("[SplashScreen] hide failed", err);
    }
  })();

  // 3) Everything below is pure background work — push it to idle time.
  const runIdle = (cb: () => void) => {
    const ric = (window as any).requestIdleCallback;
    if (typeof ric === "function") ric(cb, { timeout: 2000 });
    else setTimeout(cb, 600);
  };

  runIdle(() => {
    void initOneSignal(null);

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
        const { Keyboard } = await import("@capacitor/keyboard");
        await Keyboard.setAccessoryBarVisible({ isVisible: false });
      } catch (err) {
        console.warn("[Keyboard] hide accessory bar failed", err);
      }
    })();
  });
};

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

// Kick off native boot tasks AFTER the first React render is scheduled,
// so the UI paints first and the user no longer stares at white.
requestAnimationFrame(() => {
  runNativeBootTasks();
  // Warm the home feed image cache in the background.
  import("@/lib/preloadFeedImages").then((m) => m.preloadFeedImages?.(6)).catch(() => {});
});
}
