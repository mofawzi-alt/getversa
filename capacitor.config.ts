import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.Versa.app',
  appName: 'Versa',
  webDir: 'dist',
  server: {
    url: 'https://getversa.app',
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
