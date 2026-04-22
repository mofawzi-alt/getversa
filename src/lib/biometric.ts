// Face ID / Touch ID helper for native iOS/Android via @aparajita/capacitor-biometric-auth.
// Stores the last-used email + a flag locally so we can offer a one-tap re-login after the
// user has signed in once with their password. The actual session is restored via Supabase
// refresh token (which Supabase persists in localStorage automatically).
import { Capacitor } from '@capacitor/core';
import { BiometricAuth, BiometryType } from '@aparajita/capacitor-biometric-auth';

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

export const checkBiometricAvailability = async (): Promise<BiometricAvailability> => {
  if (!isNative()) return { available: false, type: 'none', reason: 'web' };
  try {
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
  } catch (e) {
    return { available: false, type: 'none', reason: 'error' };
  }
};

export const promptBiometric = async (reason = 'Sign in to Versa'): Promise<boolean> => {
  if (!isNative()) return false;
  try {
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
