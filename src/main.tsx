import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import "./lib/nativeOAuthBridge"; // Must run before anything else
import "./lib/authRedirectCapture";
import "./index.css";
import { Capacitor } from "@capacitor/core";
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import { SplashScreen } from "@capacitor/splash-screen";

declare global {
  interface Window {
    __VERSA_NATIVE_OAUTH_BRIDGE_ACTIVE__?: boolean;
  }
}

const isNativeApp = Capacitor?.isNativePlatform?.() === true;

let capgoReadyConfirmed = false;

const notifyCapgoAppReady = () => {
  if (!isNativeApp || capgoReadyConfirmed) return;
  void CapacitorUpdater.notifyAppReady().then(() => {
    capgoReadyConfirmed = true;
  }).catch((err) => {
    console.warn("[CapacitorUpdater] notifyAppReady failed", err);
  });
};

const installCapgoReadyRetries = () => {
  if (!isNativeApp) return;
  [0, 100, 300, 700, 1500, 3000, 6000].forEach((delay) => {
    window.setTimeout(notifyCapgoAppReady, delay);
  });
};

// Tell Capgo immediately that the downloaded OTA bundle booted. If this waits
// behind React/lazy imports, iOS can briefly show the new bundle and then reload
// back to the previous bundle, which looks like the app "refreshes itself".
notifyCapgoAppReady();

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
    // Safety net — force-hide after 1.2s so users can never get stuck on the
    // splash, even on warm relaunches where the import is already cached.
    const timer = window.setTimeout(() => hideNativeSplash(150), 1200);
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

// Native iOS boot work — keep this intentionally tiny.
// Xcode showed iOS background-task expiration during launch, so we avoid
// starting non-essential bridge/network work while WebKit is coalescing launch.
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

  // 2) Tell Capgo the OTA bundle loaded OK (prevents auto-rollback).
  notifyCapgoAppReady();

  // 3) Keep hiding the native splash from multiple lifecycle moments.
  hideNativeSplash(120);

  // Do not initialize notification/deep-link/keyboard helpers at cold launch.
  // They are not required to render or sign in, and can keep WebKit active
  // during iOS launch suspension on real devices.
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

installCapgoReadyRetries();

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
  if (!isNativeApp) {
    // Warm the home feed image cache on web only. Native iOS should do the
    // least possible background work during launch.
    import("@/lib/preloadFeedImages").then((m) => m.preloadFeedImages?.(6)).catch(() => {});
  }
});
}
