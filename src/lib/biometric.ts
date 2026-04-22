// Face ID / Touch ID helper for native iOS/Android via @aparajita/capacitor-biometric-auth.
// The plugin is lazy-loaded so the web preview never tries to import it.
import { Capacitor } from '@capacitor/core';

const BIO_ENABLED_KEY = 'versa_biometric_enabled';
const BIO_EMAIL_KEY = 'versa_biometric_email';

export const isNative = () => {
  try {
    return Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
};

export const isAppleMobileDevice = () => {
  try {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const platform = navigator.platform || '';
    const isTouchMac = platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    return /iPhone|iPad|iPod/i.test(ua) || isTouchMac;
  } catch {
    return false;
  }
};

export const shouldRenderBiometricSettings = () => isNative() || isAppleMobileDevice();

export interface BiometricAvailability {
  available: boolean;
  type: 'face' | 'fingerprint' | 'iris' | 'generic' | 'none';
  reason?: string;
  code?: string;
}

export interface BiometricPromptResult {
  ok: boolean;
  code?: string;
  message?: string;
}

const loadPlugin = async () => {
  const mod = await import('@aparajita/capacitor-biometric-auth');
  return mod;
};

const resolveBiometryType = (
  biometryType: number,
  BiometryType: {
    faceId?: number;
    faceAuthentication?: number;
    touchId?: number;
    fingerprintAuthentication?: number;
    irisAuthentication?: number;
  },
): BiometricAvailability['type'] => {
  switch (biometryType) {
    case BiometryType.faceId:
    case BiometryType.faceAuthentication:
      return 'face';
    case BiometryType.touchId:
    case BiometryType.fingerprintAuthentication:
      return 'fingerprint';
    case BiometryType.irisAuthentication:
      return 'iris';
    default:
      return 'generic';
  }
};

export const checkBiometricAvailability = async (): Promise<BiometricAvailability> => {
  if (!isNative()) return { available: false, type: 'none', reason: 'web' };

  try {
    const { BiometricAuth, BiometryType } = await loadPlugin();
    const info = await BiometricAuth.checkBiometry();
    const type = resolveBiometryType(info.biometryType, BiometryType);

    if (!info.isAvailable) {
      return {
        available: false,
        type: type === 'generic' ? 'none' : type,
        reason: info.reason || 'unavailable',
        code: info.code || undefined,
      };
    }

    return {
      available: true,
      type,
      reason: info.reason || undefined,
      code: info.code || undefined,
    };
  } catch {
    return { available: false, type: 'none', reason: 'error', code: 'error' };
  }
};

export const promptBiometric = async (reason = 'Sign in to Versa'): Promise<BiometricPromptResult> => {
  if (!isNative()) return { ok: false, code: 'web', message: 'Biometrics require the installed app.' };

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

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed';
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '') || undefined
      : undefined;

    return { ok: false, code, message };
  }
};

export const isBiometricEnabled = (): boolean => {
  try {
    return localStorage.getItem(BIO_ENABLED_KEY) === 'true';
  } catch {
    return false;
  }
};

export const getBiometricEmail = (): string | null => {
  try {
    return localStorage.getItem(BIO_EMAIL_KEY);
  } catch {
    return null;
  }
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
