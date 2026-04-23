import { useEffect, useState } from 'react';
import { ScanFace, Fingerprint, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  isNative,
  isBiometricEnabled,
  isBiometricUnlocked,
  markBiometricUnlocked,
  checkBiometricAvailability,
  promptBiometric,
  getBiometricEmail,
  type BiometricAvailability,
} from '@/lib/biometric';
import { hapticSuccess, hapticError } from '@/lib/haptics';
import VersaLogo from '@/components/VersaLogo';

/**
 * Forces the user to authenticate with Face ID / Touch ID on every app
 * cold-start when biometrics are enabled. Even if Supabase has a valid
 * persisted session, the app stays locked behind this gate until the user
 * explicitly taps "Unlock". Required to honor the user's biometric opt-in
 * and to satisfy App Store expectations that the lock actually locks.
 *
 * Biometrics are NEVER auto-prompted (Apple Guideline 2.5.1) — the user
 * must tap the button. We do not pre-call promptBiometric on mount.
 */
export default function BiometricLockGate({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const [bio, setBio] = useState<BiometricAvailability | null>(null);
  const [unlocked, setUnlocked] = useState<boolean>(() => isBiometricUnlocked());
  const [busy, setBusy] = useState(false);

  // Only consider locking on native + with an active session + biometric enrolled.
  const shouldLock =
    isNative() && !!user && isBiometricEnabled() && !unlocked;

  useEffect(() => {
    if (!shouldLock) return;
    let cancelled = false;
    (async () => {
      const info = await checkBiometricAvailability();
      if (!cancelled) setBio(info);
    })();
    return () => { cancelled = true; };
  }, [shouldLock]);

  if (!shouldLock) return <>{children}</>;

  const bioType = bio?.type ?? 'face';
  const bioLabel = bioType === 'face' ? 'Face ID' : bioType === 'fingerprint' ? 'Touch ID' : 'Biometrics';
  const Icon = bioType === 'fingerprint' ? Fingerprint : ScanFace;
  const email = getBiometricEmail();

  const handleUnlock = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await promptBiometric(email ? `Sign in as ${email}` : 'Unlock Versa');
      if (result.ok) {
        hapticSuccess();
        markBiometricUnlocked();
        setUnlocked(true);
      } else {
        hapticError();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    try { await signOut(); } catch {}
  };

  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-background p-6 safe-area-top safe-area-bottom text-center">
      <div className="flex flex-col items-center gap-6 max-w-xs">
        <VersaLogo size="lg" />
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <Icon className="w-10 h-10 text-primary" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-display font-bold text-foreground">Versa is locked</h1>
          <p className="text-sm text-muted-foreground">
            {email ? <>Tap below to unlock with {bioLabel} as <span className="font-medium text-foreground">{email}</span>.</> : <>Tap below to unlock with {bioLabel}.</>}
          </p>
        </div>
        <button
          type="button"
          onClick={handleUnlock}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full bg-primary text-primary-foreground font-medium shadow-card hover:opacity-90 transition disabled:opacity-60 w-full"
        >
          <Icon className="w-5 h-5" />
          {busy ? 'Authenticating…' : `Unlock with ${bioLabel}`}
        </button>
        <button
          type="button"
          onClick={handleSignOut}
          className="inline-flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out instead
        </button>
      </div>
    </div>
  );
}
