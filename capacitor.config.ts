import type { CapacitorConfig } from '@capacitor/cli';

// IMPORTANT: Do NOT add `server.url` here for production / App Store builds.
// `server.url` makes Capacitor load the entire web app over the network on
// every launch (no bundled JS, no cached images), which makes the app feel
// extremely slow on cellular and shows blank/gray image placeholders.
//
// For production we want Capacitor to serve the bundled `dist/` folder
// (built via `npm run build` and copied with `npx cap sync ios`).
//
// If you ever need live-reload during local dev, temporarily add:
//   server: { url: 'https://<sandbox-url>', cleartext: true }
// then REMOVE it again before archiving for the App Store.
const config: CapacitorConfig = {
  appId: 'com.Versa.app',
  appName: 'Versa',
  webDir: 'dist',
  server: {
    // No `url` — production must serve bundled assets for speed and offline.
    allowNavigation: [
      'getversa.app',
      '*.getversa.app',
      'oauth.lovable.app',
      '*.lovable.app',
      'accounts.google.com',
      '*.google.com',
      'appleid.apple.com',
      '*.apple.com',
      '*.icloud.com',
      '*.supabase.co',
    ],
  },
  ios: {
    contentInset: 'never',
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
      backgroundColor: '#FFFFFF00',
    },
    SplashScreen: {
      // Hard cap: native splash auto-hides after 2s no matter what, so the
      // app can NEVER get stuck on the splash on warm launches.
      // JS also calls hide() as soon as React paints (usually <500ms).
      launchShowDuration: 2000,
      launchAutoHide: true,
      launchFadeOutDuration: 150,
      backgroundColor: '#FFFFFF',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    Keyboard: {
      // Hide the iOS keyboard accessory bar (the gray bar with ↑ ↓ ✓
      // above the keyboard). Matches the cleaner look in iMessage.
      resize: 'native',
      resizeOnFullScreen: true,
    },
    CapacitorUpdater: {
      // Auto-download new web bundles in the background.
      // The new version is applied on the NEXT app launch.
      autoUpdate: true,
      // How often the app pings Capgo to check for updates.
      autoUpdateUrl: 'https://api.capgo.app/updates',
      // Tell Capgo to reset to the bundled version if a new one fails.
      resetWhenUpdate: true,
    },
  },
};

export default config;
