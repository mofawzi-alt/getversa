import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
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

const notifyCapgoAppReady = () => {
  if (!isNativeApp) return;
  void CapacitorUpdater.notifyAppReady().catch((err) => {
    console.warn("[CapacitorUpdater] notifyAppReady failed", err);
  });
};

const hideNativeSplash = (fadeOutDuration = 150) => {
  if (!isNativeApp) return;
  void SplashScreen.hide({ fadeOutDuration }).catch((err) => {
    console.warn("[SplashScreen] hide failed", err);
  });
};

if (window.__VERSA_NATIVE_OAUTH_BRIDGE_ACTIVE__) {
  console.info("[Versa] Native OAuth bridge handled callback before app boot.");
} else {
  notifyCapgoAppReady();

  void import("./App.tsx").then(({ default: App }) => {
  if (isNativeApp) {
    void import("@capacitor/status-bar")
      .then(({ StatusBar, Style }) =>
        Promise.all([
          StatusBar.setOverlaysWebView({ overlay: true }),
          StatusBar.setStyle({ style: Style.Dark }),
        ])
      )
      .catch((err) => {
        console.warn("[StatusBar] setup failed", err);
      });
  }

  createRoot(document.getElementById("root")!).render(
    <HelmetProvider>
      <App />
    </HelmetProvider>
  );

  requestAnimationFrame(() => hideNativeSplash());
  });
}