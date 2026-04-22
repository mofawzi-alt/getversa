// Lightweight haptics helper. Uses Capacitor on native, web Vibration API as fallback.
// Safe to call on web — silently no-ops if neither is available.
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

const isNative = () => {
  try { return Capacitor?.isNativePlatform?.() === true; } catch { return false; }
};

const webVibrate = (pattern: number | number[]) => {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      (navigator as Navigator).vibrate(pattern);
    }
  } catch {}
};

export const hapticVote = async () => {
  if (isNative()) {
    try { await Haptics.impact({ style: ImpactStyle.Medium }); return; } catch {}
  }
  webVibrate(15);
};

export const hapticLight = async () => {
  if (isNative()) {
    try { await Haptics.impact({ style: ImpactStyle.Light }); return; } catch {}
  }
  webVibrate(8);
};

export const hapticSuccess = async () => {
  if (isNative()) {
    try { await Haptics.notification({ type: NotificationType.Success }); return; } catch {}
  }
  webVibrate([10, 40, 20]);
};

export const hapticError = async () => {
  if (isNative()) {
    try { await Haptics.notification({ type: NotificationType.Error }); return; } catch {}
  }
  webVibrate([30, 50, 30]);
};
