// OTA updates are intentionally disabled while debugging iOS freeze loops.
// Keep these exported functions as no-ops so existing auth/boot code can call
// them safely without importing Capgo or triggering bundle reload behavior.

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