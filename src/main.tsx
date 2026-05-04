import { createRoot } from "react-dom/client";
import "./lib/authRedirectCapture";
import App from "./App.tsx";
import "./index.css";
import { Capacitor } from "@capacitor/core";

// Native iOS: make the WebView extend under the status bar so our
// safe-area CSS (env(safe-area-inset-top)) is the single source of truth
// for the header offset. Without this, iOS leaves a white bar AND our
// CSS adds extra padding, causing the logo to overlap the notch.
if (Capacitor?.isNativePlatform?.()) {
  void (async () => {
    try {
      const { StatusBar, Style } = await import("@capacitor/status-bar");
      await StatusBar.setOverlaysWebView({ overlay: true });
      await StatusBar.setStyle({ style: Style.Dark });
    } catch (err) {
      console.warn("[StatusBar] setup failed", err);
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

createRoot(document.getElementById("root")!).render(<App />);
