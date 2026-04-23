import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.c889c415dd2249d6b1128e85df955085',
  appName: 'Versa',
  webDir: 'dist',
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
