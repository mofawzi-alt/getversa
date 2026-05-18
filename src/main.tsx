import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import "./lib/nativeOAuthBridge"; // Must run before anything else
import "./lib/authRedirectCapture";
import "./index.css";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";

declare global {
  interface Window {
    __VERSA_NATIVE_OAUTH_BRIDGE_ACTIVE__?: boolean;
  }
}

const isNativeApp = Capacitor?.isNativePlatform?.() === true;

const hideNativeSplash = (fadeOutDuration = 0) => {
  if (!isNativeApp) return;
  void SplashScreen.hide({ fadeOutDuration }).catch((err) => {
    console.warn("[SplashScreen] hide failed", err);
  });
};

// NOTE: we intentionally do NOT hide the splash here. The native splash
// must stay visible until App.tsx is loaded and React has painted at least
// one frame, otherwise users see a white flash between splash and UI.

function NativeSplashFailsafe({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!isNativeApp) return;
    // Safety net only — if AppLoader never resolves, force-hide after 4s
    // so users are never stuck on the splash.
    const timer = window.setTimeout(() => hideNativeSplash(200), 4000);
    return () => window.clearTimeout(timer);
  }, []);

  return <>{children}</>;
}

function AppLoader() {
  const [AppComponent, setAppComponent] = useState<ComponentType | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;

    void import("./App.tsx")
      .then((module) => {
        if (active) setAppComponent(() => module.default);
        // Hide splash AFTER React commits the first paint of the real App.
        requestAnimationFrame(() => requestAnimationFrame(() => hideNativeSplash(200)));
      })
      .catch((err) => {
        console.error("[Versa] App boot failed", err);
        if (active) setLoadFailed(true);
        hideNativeSplash(0);
      });

    return () => {
      active = false;
    };
  }, []);

  if (loadFailed) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background px-6 text-center text-foreground">
        <p className="text-base font-semibold">Versa could not start. Please close and reopen the app.</p>
      </div>
    );
  }

  if (!AppComponent) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <AppComponent />;
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

  // 2) Keep hiding the native splash from multiple lifecycle moments.
  hideNativeSplash(120);

  // 3) Everything below is pure background work — push it to idle time.
  const runIdle = (cb: () => void) => {
    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(() => cb(), { timeout: 2000 });
    else setTimeout(cb, 600);
  };

  runIdle(() => {
    void import("@/lib/onesignal").then((m) => m.initOneSignal(null)).catch(() => {});

    void (async () => {
      try {
        const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
        await CapacitorUpdater.notifyAppReady();
      } catch (err) {
        console.warn("[CapacitorUpdater] notifyAppReady failed", err);
      }
    })();

    void Promise.all([import("@capacitor/app"), import("@/lib/onesignal")]).then(([appModule, oneSignal]) => {
      const CapacitorApp = appModule.App;

      void CapacitorApp.getLaunchUrl().then((launch) => {
        const route = oneSignal.getNotificationRoute(launch?.url);
        if (route && route !== "/home") oneSignal.openNotificationRoute(route);
      }).catch(() => {});

      void CapacitorApp.addListener("appUrlOpen", ({ url }) => {
        const route = oneSignal.getNotificationRoute(url);
        if (route && route !== "/home" && !route.startsWith("/auth-callback")) oneSignal.openNotificationRoute(route);
      });
    }).catch(() => {});

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
    <NativeSplashFailsafe>
      <AppLoader />
    </NativeSplashFailsafe>
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
