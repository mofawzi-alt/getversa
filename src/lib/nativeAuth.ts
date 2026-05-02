// Native OAuth detection for Capacitor.
// Since the WebView loads from https://getversa.app, the standard
// lovable.auth.signInWithOAuth web redirect flow works natively —
// no Capacitor-specific plugins are needed for Apple/Google sign-in.
import { Capacitor } from '@capacitor/core';

export const isNativePlatform = (): boolean => {
  try { return Capacitor?.isNativePlatform?.() === true; } catch { return false; }
};
