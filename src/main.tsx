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

const renderBootFailure = () => {
  document.getElementById("root")!.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fff;color:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;text-align:center;">
      <div style="max-width:320px;">
        <h1 style="font-size:22px;line-height:1.2;margin:0 0 8px;font-weight:800;">Versa needs a restart</h1>
        <p style="font-size:15px;line-height:1.45;margin:0;color:#6b7280;">Fully close the app, then open it again.</p>
      </div>
    </div>
  `;
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

  try {
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
  } catch (err) {
    console.error("[Versa] App boot failed", err);
    renderBootFailure();
    void hideNativeSplash(0);
  }
};

void boot();