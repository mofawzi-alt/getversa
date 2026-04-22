// Face ID / Touch ID helper for native iOS/Android via @aparajita/capacitor-biometric-auth.
// The plugin is lazy-loaded so the web preview never tries to import it.
import { Capacitor } from '@capacitor/core';

const BIO_ENABLED_KEY = 'versa_biometric_enabled';
const BIO_EMAIL_KEY = 'versa_biometric_email';

export const isNative = () => {
  try { return Capacitor?.isNativePlatform?.() === true; } catch { return false; }
};

export interface BiometricAvailability {
  available: boolean;
  type: 'face' | 'fingerprint' | 'iris' | 'generic' | 'none';
  reason?: string;
}

const loadPlugin = async () => {
  // Dynamic import — only resolved on native, never bundled into the web entry.
  const mod = await import('@aparajita/capacitor-biometric-auth');
  return mod;
};

export const checkBiometricAvailability = async (): Promise<BiometricAvailability> => {
  if (!isNative()) return { available: false, type: 'none', reason: 'web' };
  try {
    const { BiometricAuth, BiometryType } = await loadPlugin();
    const info = await BiometricAuth.checkBiometry();
    if (!info.isAvailable) {
      return { available: false, type: 'none', reason: info.reason || 'unavailable' };
    }
    let type: BiometricAvailability['type'] = 'generic';
    switch (info.biometryType) {
      case BiometryType.faceId:
      case BiometryType.faceAuthentication:
        type = 'face'; break;
      case BiometryType.touchId:
      case BiometryType.fingerprintAuthentication:
        type = 'fingerprint'; break;
      case BiometryType.irisAuthentication:
        type = 'iris'; break;
    }
    return { available: true, type };
  } catch {
    return { available: false, type: 'none', reason: 'error' };
  }
};

export const promptBiometric = async (reason = 'Sign in to Versa'): Promise<boolean> => {
  if (!isNative()) return false;
  try {
    const { BiometricAuth } = await loadPlugin();
    await BiometricAuth.authenticate({
      reason,
      cancelTitle: 'Cancel',
      iosFallbackTitle: 'Use Passcode',
      androidTitle: 'Versa',
      androidSubtitle: reason,
      androidConfirmationRequired: false,
    });
    return true;
  } catch {
    return false;
  }
};

export const isBiometricEnabled = (): boolean => {
  try { return localStorage.getItem(BIO_ENABLED_KEY) === 'true'; } catch { return false; }
};

export const getBiometricEmail = (): string | null => {
  try { return localStorage.getItem(BIO_EMAIL_KEY); } catch { return null; }
};

export const enableBiometric = (email: string) => {
  try {
    localStorage.setItem(BIO_ENABLED_KEY, 'true');
    localStorage.setItem(BIO_EMAIL_KEY, email);
  } catch {}
};

export const disableBiometric = () => {
  try {
    localStorage.removeItem(BIO_ENABLED_KEY);
    localStorage.removeItem(BIO_EMAIL_KEY);
  } catch {}
};
