import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import {
  installNativeSessionMirror,
  restoreSessionNative,
  clearNativeSession,
  getAuthRedirectUrl,
  isNativeLoggedOut,
  markNativeLoggedOut,
  clearNativeLoggedOut,
} from '@/lib/nativeSession';
import { clearBiometricUnlocked } from '@/lib/biometric';

const LOGOUT_GUARD_KEY = 'versa.force_logged_out.guard';
const BIO_ENABLED_KEY = 'versa_biometric_enabled';
const BIO_EMAIL_KEY = 'versa_biometric_email';

const hasLogoutGuard = () => {
  try {
    return sessionStorage.getItem(LOGOUT_GUARD_KEY) === 'true' || localStorage.getItem(LOGOUT_GUARD_KEY) === 'true';
  } catch {
    return false;
  }
};

const setLogoutGuard = () => {
  try {
    sessionStorage.setItem(LOGOUT_GUARD_KEY, 'true');
    localStorage.setItem(LOGOUT_GUARD_KEY, 'true');
  } catch {}
};

const clearLogoutGuard = () => {
  try {
    sessionStorage.removeItem(LOGOUT_GUARD_KEY);
    localStorage.removeItem(LOGOUT_GUARD_KEY);
  } catch {}
};

const withTimeout = async <T,>(
  operation: () => Promise<T>,
  fallback: T,
  timeoutMs = 1500,
): Promise<T> => {
  let timeoutId: number | undefined;

  try {
    return await Promise.race([
      operation().catch(() => fallback),
      new Promise<T>((resolve) => {
        timeoutId = window.setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  }
};

const getSessionWithTimeout = async (timeoutMs = 1500): Promise<Session | null> => {
  return withTimeout(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session ?? null;
  }, null, timeoutMs);
};

interface UserProfile {
  id: string;
  email: string;
  username: string | null;
  age_range: string | null;
  gender: string | null;
  country: string | null;
  city: string | null;
  category_interests: string[] | null;
  income_range: string | null;
  employment_status: string | null;
  industry: string | null;
  education_level: string | null;
  points: number;
  created_at: string;
  [key: string]: unknown; // Index signature for dynamic access
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const logoutInFlightRef = useRef(false);

  const fetchProfile = async (userId: string) => {
    let { data: profileData } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    
    // Auto-create user record if missing
    if (!profileData) {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: newProfile } = await supabase
          .from('users')
          .insert({
            id: authUser.id,
            email: authUser.email || '',
            username: authUser.email?.split('@')[0] || null,
            points: 0,
            current_streak: 0,
            longest_streak: 0,
            total_days_active: 0,
          })
          .select()
          .single();
        profileData = newProfile;
      }
    }
    
    if (profileData) {
      setProfile(profileData);
    }

    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    setIsAdmin(Array.isArray(rolesData) && rolesData.some((r) => r.role === 'admin'));
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let bootSettled = false;

    const finishBoot = () => {
      if (cancelled || bootSettled) return;
      bootSettled = true;
      setLoading(false);
    };

    const clearAuthState = () => {
      setSession(null);
      setUser(null);
      setProfile(null);
      setIsAdmin(false);
    };

    const bootFailsafeTimer = window.setTimeout(() => {
      console.warn('[Auth] Startup timed out; continuing without blocking UI');
      finishBoot();
    }, 3500);

    // Set up auth listener FIRST, then get initial session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      const isExplicitSignIn = event === 'SIGNED_IN' && !!nextSession;

      if (isExplicitSignIn) {
        clearLogoutGuard();
        try { await clearNativeLoggedOut(); } catch {}
      }

      const forcedNativeLogout = isExplicitSignIn
        ? false
        : await withTimeout(() => isNativeLoggedOut(), false, 800);

      if (hasLogoutGuard() || forcedNativeLogout) {
        clearAuthState();
        finishBoot();

        if (nextSession) {
          void supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
        }

        return;
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      
      if (nextSession?.user) {
        clearLogoutGuard();
        setTimeout(() => {
          void fetchProfile(nextSession.user.id);
        }, 0);
      } else {
        setProfile(null);
        setIsAdmin(false);
      }
      
      finishBoot();
    });

    // Mirror Supabase sessions into native secure storage (iOS Keychain / Android EncryptedSharedPreferences)
    installNativeSessionMirror();

    // On native cold-start, try to restore the session from Keychain BEFORE
    // falling back to web localStorage (which WKWebView can wipe under storage pressure).
    const fallbackTimer = window.setTimeout(async () => {
      const forcedNativeLogout = await withTimeout(() => isNativeLoggedOut(), false, 800);

      if (hasLogoutGuard() || forcedNativeLogout) {
        clearAuthState();
        finishBoot();
        return;
      }

      const webSession = await getSessionWithTimeout(1200);
      if (cancelled) return;

      if (hasLogoutGuard() || await withTimeout(() => isNativeLoggedOut(), false, 800)) {
        clearAuthState();
        finishBoot();
        return;
      }

      if (!webSession) {
        const restored = await withTimeout(() => restoreSessionNative(), false, 1200);
        if (cancelled) return;
        if (restored) {
          // onAuthStateChange will fire and populate state — nothing else to do.
          return;
        }
      }

      setSession((prev) => prev ?? webSession);
      setUser((prev) => prev ?? (webSession?.user ?? null));
      if (webSession?.user) {
        clearLogoutGuard();
        void fetchProfile(webSession.user.id);
      }
      finishBoot();
    }, 100);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.clearTimeout(fallbackTimer);
      window.clearTimeout(bootFailsafeTimer);
    };
  }, []);

  const signUp = async (email: string, password: string) => {
    // On native (iOS/Android Capacitor) window.location.origin resolves to
    // capacitor:// or localhost — Supabase rejects those redirects. Always
    // route email-confirmation links to the production web URL on native.
    const redirectUrl = getAuthRedirectUrl();

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    // Race the auth call against a 15s timeout so the UI never hangs forever
    // (WKWebView on iOS can silently drop fetches under low-memory conditions).
    try {
      // Clear explicit logout guards before a deliberate new sign-in attempt.
      // Otherwise the auth listener can reject the fresh session as if it were
      // a stale restored session from the previous account.
      clearLogoutGuard();
      try { await clearNativeLoggedOut(); } catch {}

      const result = await Promise.race([
        supabase.auth.signInWithPassword({ email, password }),
        new Promise<{ error: Error }>((_, reject) =>
          setTimeout(() => reject(new Error('Sign-in timed out. Check your connection and try again.')), 15000)
        ),
      ]);
      const error = (result as { error: Error | null }).error;
      if (!error) {
        try { await clearNativeLoggedOut(); } catch {}
        clearLogoutGuard();
      }
      return { error };
    } catch (e) {
      return { error: e instanceof Error ? e : new Error('Sign-in failed') };
    }
  };

  const signOut = async () => {
    if (logoutInFlightRef.current) return;
    logoutInFlightRef.current = true;

    let preservedBiometricEnabled: string | null = null;
    let preservedBiometricEmail: string | null = null;

    try {
      preservedBiometricEnabled = localStorage.getItem(BIO_ENABLED_KEY);
      preservedBiometricEmail = localStorage.getItem(BIO_EMAIL_KEY);
    } catch {}

    setLogoutGuard();

    // Stop native session restore first so a stale session cannot come back.
    try { await markNativeLoggedOut(); } catch {}

    // Clear local UI state IMMEDIATELY so the rest of the app re-renders to
    // logged-out even if the network calls below stall.
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsAdmin(false);

    // Keep Face ID enabled for future app locks, but clear the current
    // unlocked flag and the mirrored native session.
    try { clearBiometricUnlocked(); } catch {}
    try { await clearNativeSession(); } catch {}

    // Hard-clear any lingering Supabase tokens in localStorage / sessionStorage
    // so a stale session can't be restored on next app open. Do this BEFORE the
    // network call so even if signOut() hangs we're already locally logged out.
    try {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith('sb-') || k.includes('supabase')) localStorage.removeItem(k);
      });
      Object.keys(sessionStorage).forEach((k) => {
        if (k.startsWith('sb-') || k.includes('supabase')) sessionStorage.removeItem(k);
      });

      if (preservedBiometricEnabled === 'true') {
        localStorage.setItem(BIO_ENABLED_KEY, 'true');
      }
      if (preservedBiometricEmail) {
        localStorage.setItem(BIO_EMAIL_KEY, preservedBiometricEmail);
      }
    } catch {}

    try {
      await Promise.race([
        supabase.auth.signOut({ scope: 'global' }),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
    } catch {}

    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {}

    logoutInFlightRef.current = false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isAdmin,
        loading,
        signUp,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}