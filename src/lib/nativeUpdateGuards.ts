// Native OTA updates are intentionally removed while debugging iOS freeze loops.
// Keep these exported functions as no-ops so existing auth code can call them safely.

export const markNativeBundleReady = () => {
  return;
};

export const protectNativeUpdatesDuringShortBackgrounds = () => {
  return;
};

export const holdNativeUpdatesForAuth = () => {
  return;
};

export const releaseNativeAuthUpdateHold = () => {
  return;
};

export const installNativeUpdateGuards = () => {
  return;
};