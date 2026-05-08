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
  },
};

export default config;
