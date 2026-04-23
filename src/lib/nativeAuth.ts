// Native iOS/Android social sign-in using platform plugins.
// Uses ID-token flow → exchanges with Supabase via signInWithIdToken so we never
// rely on browser-based OAuth redirects (which break in WKWebView without a
// custom URL scheme + universal links).
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

export const isNativePlatform = (): boolean => {
  try { return Capacitor?.isNativePlatform?.() === true; } catch { return false; }
};

// ---------- Apple ----------
export async function signInWithAppleNative(): Promise<{ error: Error | null }> {
  try {
    const { SignInWithApple } = await import('@capacitor-community/apple-sign-in');
    const rawNonce = cryptoRandomString();
    const hashedNonce = await sha256Hex(rawNonce);

    const result = await SignInWithApple.authorize({
      clientId: 'app.lovable.c889c415dd2249d6b1128e85df955085',
      redirectURI: 'https://getversa.app/',
      scopes: 'email name',
      state: cryptoRandomString(),
      nonce: hashedNonce,
    });

    const idToken = result?.response?.identityToken;
    if (!idToken) return { error: new Error('No identity token from Apple') };

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: idToken,
      nonce: rawNonce,
    });
    return { error: error ?? null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/cancel/i.test(msg)) return { error: null }; // user cancelled — silent
    return { error: new Error(msg) };
  }
}

// ---------- Google ----------
let googleInitDone = false;
async function ensureGoogleInit() {
  if (googleInitDone) return;
  const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
  await GoogleAuth.initialize({
    // Web client ID — must be set in Google Cloud + iOS plist (see README in repo).
    clientId: import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID || '',
    scopes: ['profile', 'email'],
    grantOfflineAccess: false,
  });
  googleInitDone = true;
}

export async function signInWithGoogleNative(): Promise<{ error: Error | null }> {
  try {
    await ensureGoogleInit();
    const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
    const user = await GoogleAuth.signIn();
    const idToken = user?.authentication?.idToken;
    if (!idToken) return { error: new Error('No ID token from Google') };

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });
    return { error: error ?? null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/cancel|popup_closed/i.test(msg)) return { error: null };
    return { error: new Error(msg) };
  }
}

// ---------- helpers ----------
function cryptoRandomString(len = 32): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
