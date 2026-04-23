// Native social sign-in is temporarily disabled. The Google/Apple Capacitor
// plugins were removed to unblock iOS builds; we'll re-add them later when we
// wire native OAuth properly.
import { Capacitor } from '@capacitor/core';

export const isNativePlatform = (): boolean => {
  try { return Capacitor?.isNativePlatform?.() === true; } catch { return false; }
};

export async function signInWithAppleNative(): Promise<{ error: Error | null }> {
  return { error: new Error('Apple sign-in is not available in this build yet.') };
}

export async function signInWithGoogleNative(): Promise<{ error: Error | null }> {
  return { error: new Error('Google sign-in is not available in this build yet.') };
}
