import "./index.css";

declare global {
  interface Window {
    __VERSA_NATIVE_OAUTH_BRIDGE_ACTIVE__?: boolean;
  }
}

const notifyCapgoAppReady = async () => {
  const [{ Capacitor }, { CapacitorUpdater }] = await Promise.all([
    import("@capacitor/core"),
    import("@capgo/capacitor-updater"),
  ]);

  const isNativeApp = Capacitor?.isNativePlatform?.() === true;
  if (!isNativeApp) return;

  void CapacitorUpdater.notifyAppReady().catch((err) => {
    console.warn("[CapacitorUpdater] notifyAppReady failed", err);
  });
};

const hideNativeSplash = async (fadeOutDuration = 150) => {
  const [{ Capacitor }, { SplashScreen }] = await Promise.all([
    import("@capacitor/core"),
    import("@capacitor/splash-screen"),
  ]);

  const isNativeApp = Capacitor?.isNativePlatform?.() === true;
  if (!isNativeApp) return;

  void SplashScreen.hide({ fadeOutDuration }).catch((err) => {
    console.warn("[SplashScreen] hide failed", err);
  });
};

const boot = async () => {
  await notifyCapgoAppReady().catch((err) => {
    console.warn("[CapacitorUpdater] setup failed", err);
  });

  await import("./lib/nativeOAuthBridge");
  await import("./lib/authRedirectCapture");

  if (window.__VERSA_NATIVE_OAUTH_BRIDGE_ACTIVE__) {
    console.info("[Versa] Native OAuth bridge handled callback before app boot.");
    return;
  }

  const [{ createRoot }, { HelmetProvider }, { default: App }, { Capacitor }] = await Promise.all([
    import("react-dom/client"),
    import("react-helmet-async"),
    import("./App.tsx"),
    import("@capacitor/core"),
  ]);

  if (Capacitor?.isNativePlatform?.() === true) {
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

  requestAnimationFrame(() => {
    void hideNativeSplash();
  });
};

void boot();