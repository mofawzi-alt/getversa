import { Capacitor } from '@capacitor/core';

const SAFE_BACKGROUND_DELAY_MS = '120000';
const AUTH_UPDATE_HOLD_MS = 10 * 60 * 1000;

const isNativeApp = () => {
  try {
    return Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
};

const withUpdater = async (action: (updater: any) => Promise<void>) => {
  if (!isNativeApp()) return;
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    await action(CapacitorUpdater);
  } catch (error) {
    console.warn('[CapacitorUpdater] guard failed', error);
  }
};

export const markNativeBundleReady = () => {
  void withUpdater((updater) => updater.notifyAppReady());
};

export const protectNativeUpdatesDuringShortBackgrounds = () => {
  void withUpdater((updater) =>
    updater.setMultiDelay({
      delayConditions: [{ kind: 'background', value: SAFE_BACKGROUND_DELAY_MS }],
    }),
  );
};

export const holdNativeUpdatesForAuth = () => {
  const holdUntil = new Date(Date.now() + AUTH_UPDATE_HOLD_MS).toISOString();
  void withUpdater((updater) =>
    updater.setMultiDelay({
      delayConditions: [
        { kind: 'date', value: holdUntil },
        { kind: 'background', value: SAFE_BACKGROUND_DELAY_MS },
      ],
    }),
  );
};

export const releaseNativeAuthUpdateHold = () => {
  void withUpdater(async (updater) => {
    await updater.cancelDelay();
    await updater.setMultiDelay({
      delayConditions: [{ kind: 'background', value: SAFE_BACKGROUND_DELAY_MS }],
    });
  });
};

export const installNativeUpdateGuards = () => {
  if (!isNativeApp()) return;

  protectNativeUpdatesDuringShortBackgrounds();

  void import('@capacitor/app')
    .then(({ App }) =>
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) markNativeBundleReady();
      }),
    )
    .catch((error) => {
      console.warn('[CapacitorUpdater] app state guard failed', error);
    });
};