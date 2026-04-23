import { useState } from 'react';
import { lovable } from '@/integrations/lovable';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { getAuthRedirectUrl } from '@/lib/nativeSession';
import { isNativePlatform, signInWithAppleNative, signInWithGoogleNative } from '@/lib/nativeAuth';
import { useNavigate } from 'react-router-dom';

/**
 * Apple HIG-compliant Sign in with Apple button + Google button.
 * On native iOS/Android: uses platform plugins (Apple Sign-In, Google Sign-In)
 * On web: uses Lovable Cloud managed OAuth (browser redirect).
 */
export default function SocialAuthButtons({ mode = 'signin' }: { mode?: 'signin' | 'signup' }) {
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);
  const navigate = useNavigate();

  const handleOAuth = async (provider: 'apple' | 'google') => {
    setBusy(provider);
    try {
      // ---- NATIVE path (iOS / Android) ----
      if (isNativePlatform()) {
        const { error } = provider === 'apple'
          ? await signInWithAppleNative()
          : await signInWithGoogleNative();
        if (error) {
          toast.error(error.message || `${provider === 'apple' ? 'Apple' : 'Google'} sign-in failed`);
          setBusy(null);
          return;
        }
        // Session is set by signInWithIdToken — onAuthStateChange will fire.
        navigate('/home');
        setBusy(null);
        return;
      }

      // ---- WEB path ----
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: getAuthRedirectUrl(),
      });
      if (result.error) {
        toast.error(result.error.message || `${provider === 'apple' ? 'Apple' : 'Google'} sign-in failed`);
        setBusy(null);
        return;
      }
      // result.redirected → browser redirects, nothing more to do
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign-in failed. Please try again.';
      toast.error(msg);
      setBusy(null);
    }
  };

  const verb = mode === 'signup' ? 'Sign up' : 'Sign in';

  return (
    <div className="space-y-2.5">
      {/* Apple — black button, Apple HIG required style */}
      <button
        type="button"
        onClick={() => handleOAuth('apple')}
        disabled={busy !== null}
        className="w-full h-11 rounded-lg bg-black text-white font-medium text-sm flex items-center justify-center gap-2 active:opacity-80 transition-opacity disabled:opacity-60"
      >
        {busy === 'apple' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <svg viewBox="0 0 17 21" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true">
            <path d="M14.04 16.34c-.27.62-.59 1.2-.96 1.72-.51.71-.93 1.21-1.25 1.48-.5.45-1.04.69-1.62.7-.41 0-.91-.12-1.5-.36-.59-.24-1.13-.36-1.62-.36-.51 0-1.07.12-1.67.36-.6.24-1.08.37-1.45.39-.55.02-1.1-.22-1.65-.72-.34-.3-.78-.81-1.31-1.55-.57-.78-1.04-1.69-1.41-2.73C.4 14.04.2 12.95.2 11.9c0-1.21.26-2.25.79-3.13.41-.7.97-1.26 1.66-1.66.69-.4 1.44-.61 2.25-.62.43 0 1.01.13 1.74.4.73.27 1.2.4 1.4.4.16 0 .68-.16 1.55-.47.83-.29 1.53-.41 2.1-.36 1.55.13 2.71.74 3.49 1.85-1.39.84-2.07 2.02-2.06 3.53.01 1.18.44 2.16 1.28 2.94.38.36.81.64 1.28.84-.1.3-.21.58-.34.85zM11.86 1.16c0 .9-.33 1.74-.99 2.52-.79.93-1.74 1.46-2.78 1.38-.01-.11-.02-.23-.02-.35 0-.86.38-1.79 1.05-2.55.34-.39.76-.71 1.28-.97.51-.26.99-.4 1.45-.43.01.13.01.27.01.4z"/>
          </svg>
        )}
        <span>{verb} with Apple</span>
      </button>

      {/* Google — white button per Google brand guidelines */}
      <button
        type="button"
        onClick={() => handleOAuth('google')}
        disabled={busy !== null}
        className="w-full h-11 rounded-lg bg-white text-[#1f1f1f] font-medium text-sm flex items-center justify-center gap-2 border border-border active:bg-gray-50 transition-colors disabled:opacity-60"
      >
        {busy === 'google' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <svg viewBox="0 0 18 18" className="h-[18px] w-[18px]" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.61z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.97 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3.01-2.33z"/>
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8.97 8.97 0 0 0 9 0 9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
          </svg>
        )}
        <span>{verb} with Google</span>
      </button>
    </div>
  );
}
