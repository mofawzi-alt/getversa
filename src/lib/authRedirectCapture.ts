const PASSWORD_RECOVERY_INTENT_KEY = 'versa.password_recovery_intent.v1';
const RECOVERY_INTENT_MAX_AGE_MS = 15 * 60 * 1000;

const isResetPasswordPath = () => window.location.pathname === '/reset-password';

const hasPasswordRecoveryParams = () => {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);

  return (
    hash.get('type') === 'recovery' ||
    query.get('type') === 'recovery' ||
    hash.has('access_token') ||
    hash.has('refresh_token') ||
    query.has('code')
  );
};

export const capturePasswordRecoveryIntent = () => {
  if (!isResetPasswordPath() || !hasPasswordRecoveryParams()) return;

  try {
    sessionStorage.setItem(PASSWORD_RECOVERY_INTENT_KEY, String(Date.now()));
  } catch {
    // Best-effort only; the reset page still checks the live auth session.
  }
};

export const hasRecentPasswordRecoveryIntent = () => {
  try {
    const raw = sessionStorage.getItem(PASSWORD_RECOVERY_INTENT_KEY);
    const timestamp = raw ? Number(raw) : 0;
    return Number.isFinite(timestamp) && Date.now() - timestamp < RECOVERY_INTENT_MAX_AGE_MS;
  } catch {
    return false;
  }
};

export const clearPasswordRecoveryIntent = () => {
  try {
    sessionStorage.removeItem(PASSWORD_RECOVERY_INTENT_KEY);
  } catch {
    // Storage cleanup is best-effort.
  }
};

capturePasswordRecoveryIntent();