import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import {
  installNativeSessionMirror,
  persistSessionNative,
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

// Logout guard is intentionally sessionStorage-only so it never survives a
// process cold-start. Cross-launch logout state is tracked in Capacitor
// Preferences via markNativeLoggedOut() / isNativeLoggedOut(), which IS
// cleared explicitly on a deliberate new sign-in or biometric unlock.
const hasLogoutGuard = () => {
  try {
    return sessionStorage.getItem(LOGOUT_GUARD_KEY) === 'true';
  } catch {
    return false;
  }
};

const setLogoutGuard = () => {
  try {
    sessionStorage.setItem(LOGOUT_GUARD_KEY, 'true');
  } catch {}
};

const clearLogoutGuard = () => {
  try {
    sessionStorage.removeItem(LOGOUT_GUARD_KEY);
    localStorage.removeItem(LOGOUT_GUARD_KEY); // legacy cleanup
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
  signUp: (
    email: string,
    password: string,
    metadata?: Record<string, string>
  ) => Promise<{ error: Error | null; user: User | null; session: Session | null }>;
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
  const deliberateSignInRef = useRef(false);

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
        // Generate a unique username — append random suffix to avoid collisions
        const baseUsername = (authUser.email?.split('@')[0] || 'user').replace(/[^a-z0-9_]/gi, '').toLowerCase();
        const uniqueUsername = `${baseUsername}_${Math.random().toString(36).slice(2, 6)}`;
        
        const { data: newProfile, error: insertError } = await supabase
          .from('users')
          .insert({
            id: authUser.id,
            email: authUser.email || '',
            username: uniqueUsername,
            points: 0,
            current_streak: 0,
            longest_streak: 0,
            total_days_active: 0,
          })
          .select()
          .single();
        
        if (insertError) {
          console.error('Failed to auto-create user profile:', insertError.message);
          // Retry with a more unique username
          const fallbackUsername = `user_${Date.now().toString(36)}`;
          const { data: retryProfile } = await supabase
            .from('users')
            .insert({
              id: authUser.id,
              email: authUser.email || '',
              username: fallbackUsername,
              points: 0,
              current_streak: 0,
              longest_streak: 0,
              total_days_active: 0,
            })
            .select()
            .single();
          profileData = retryProfile;
        } else {
          profileData = newProfile;
        }
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

    const processAuthStateChange = async (event: string, nextSession: Session | null) => {
      // Accept SIGNED_IN, INITIAL_SESSION, and TOKEN_REFRESHED as "deliberate"
      // when our ref is set — Supabase can emit any of these after a native
      // session restore on iOS cold-start.
      const isExplicitSignIn =
        !!nextSession &&
        deliberateSignInRef.current &&
        (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED');

      if (isExplicitSignIn) {
        deliberateSignInRef.current = false;
        clearLogoutGuard();
        void withTimeout(async () => {
          await clearNativeLoggedOut();
        }, undefined, 1200);
      }

      const forcedNativeLogout = isExplicitSignIn
        ? false
        : await withTimeout(() => isNativeLoggedOut(), false, 800);

      if (cancelled) return;

      if (hasLogoutGuard() || forcedNativeLogout) {
        deliberateSignInRef.current = false;
        clearAuthState();
        finishBoot();

        if (nextSession) {
          window.setTimeout(() => {
            void supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
          }, 0);
        }

        return;
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        window.setTimeout(() => {
          void fetchProfile(nextSession.user.id);
        }, 0);
      } else {
        setProfile(null);
        setIsAdmin(false);
      }

      finishBoot();
    };

    // Set up auth listener FIRST, then get initial session.
    // Keep the callback synchronous: Supabase warns async callbacks can deadlock
    // auth/session restoration on iOS/Capacitor cold-starts.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      window.setTimeout(() => {
        void processAuthStateChange(event, nextSession);
      }, 0);
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
        // Treat a successful native restore as a deliberate sign-in so the
        // SIGNED_IN listener accepts it and clears any stale logout flags.
        deliberateSignInRef.current = true;
        const restored = await withTimeout(() => restoreSessionNative(), false, 1200);
        if (cancelled) return;
        if (restored) {
          // onAuthStateChange will fire and populate state — nothing else to do.
          return;
        }
        deliberateSignInRef.current = false;
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

  const signUp = async (email: string, password: string, metadata?: Record<string, string>) => {
    // On native (iOS/Android Capacitor) window.location.origin resolves to
    // capacitor:// or localhost — Supabase rejects those redirects. Always
    // route email-confirmation links to the production web URL on native.
    const redirectUrl = getAuthRedirectUrl();

    deliberateSignInRef.current = true;
    clearLogoutGuard();
    void withTimeout(async () => {
      await clearNativeLoggedOut();
    }, undefined, 1200);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: metadata,
      },
    });

    if (error) {
      deliberateSignInRef.current = false;
      return { error, user: null, session: null };
    }

    const nextSession = data.session ?? await getSessionWithTimeout(1500);
    if (nextSession) {
      setSession(nextSession);
      setUser(nextSession.user ?? null);
      void withTimeout(async () => {
        await persistSessionNative({
          access_token: nextSession.access_token,
          refresh_token: nextSession.refresh_token,
        });
      }, undefined, 1200);
      if (nextSession.user) {
        void fetchProfile(nextSession.user.id);
      }
    } else {
      deliberateSignInRef.current = false;
    }

    return { error: null, user: data.user ?? nextSession?.user ?? null, session: nextSession };
  };

  const signIn = async (email: string, password: string) => {
    // Race the auth call against a 15s timeout so the UI never hangs forever
    // (WKWebView on iOS can silently drop fetches under low-memory conditions).
    try {
      deliberateSignInRef.current = true;
      // Clear explicit logout guards before a deliberate new sign-in attempt.
      // Otherwise the auth listener can reject the fresh session as if it were
      // a stale restored session from the previous account.
      clearLogoutGuard();
      void withTimeout(async () => {
        await clearNativeLoggedOut();
      }, undefined, 1200);

      const result = await Promise.race([
        supabase.auth.signInWithPassword({ email, password }),
        new Promise<{ error: Error }>((_, reject) =>
          setTimeout(() => reject(new Error('Sign-in timed out. Check your connection and try again.')), 15000)
        ),
      ]);
      const authResult = result as {
        error: Error | null;
        data?: { session: Session | null };
      };
      const error = authResult.error;
      if (error) {
        deliberateSignInRef.current = false;
      }
      if (!error) {
        clearLogoutGuard();
        void withTimeout(async () => {
          await clearNativeLoggedOut();
        }, undefined, 1200);

        const nextSession = authResult.data?.session ?? await getSessionWithTimeout(1500);
        if (nextSession) {
          setSession(nextSession);
          setUser(nextSession.user ?? null);
          void withTimeout(async () => {
            await persistSessionNative({
              access_token: nextSession.access_token,
              refresh_token: nextSession.refresh_token,
            });
          }, undefined, 1200);

          if (nextSession.user) {
            void fetchProfile(nextSession.user.id);
          }
        }
      }
      return { error };
    } catch (e) {
      deliberateSignInRef.current = false;
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
    deliberateSignInRef.current = false;

    // Clear local UI state IMMEDIATELY so the rest of the app re-renders to
    // logged-out even if the network calls below stall.
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsAdmin(false);

    // Hard-clear any lingering Supabase tokens in localStorage / sessionStorage
    // synchronously so a stale session can't be restored on next app open.
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

    // Fire-and-forget all native + network teardown so the UI never hangs
    // on a stalled WKWebView fetch or Capacitor bridge call.
    void withTimeout(async () => { await markNativeLoggedOut(); }, undefined, 1500);
    try { clearBiometricUnlocked(); } catch {}
    void withTimeout(async () => { await clearNativeSession(); }, undefined, 1500);
    void withTimeout(async () => { await supabase.auth.signOut({ scope: 'global' }); }, undefined, 3000);
    void withTimeout(async () => { await supabase.auth.signOut({ scope: 'local' }); }, undefined, 1500);

    // Release the guard quickly so a second tap never appears stuck. We've
    // already cleared local state; the background tasks will finish on their own.
    window.setTimeout(() => {
      logoutInFlightRef.current = false;
    }, 400);
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