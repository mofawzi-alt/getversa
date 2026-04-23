import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { installNativeSessionMirror, restoreSessionNative, clearNativeSession, getAuthRedirectUrl } from '@/lib/nativeSession';
import { disableBiometric } from '@/lib/biometric';

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
    // Set up auth listener FIRST, then get initial session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Defer profile fetch to avoid Supabase deadlock
        setTimeout(() => {
          fetchProfile(session.user.id);
        }, 0);
      } else {
        setProfile(null);
        setIsAdmin(false);
      }
      
      setLoading(false);
    });

    // Mirror Supabase sessions into native secure storage (iOS Keychain / Android EncryptedSharedPreferences)
    installNativeSessionMirror();

    // On native cold-start, try to restore the session from Keychain BEFORE
    // falling back to web localStorage (which WKWebView can wipe under storage pressure).
    let cancelled = false;
    const fallbackTimer = setTimeout(async () => {
      const { data: { session: webSession } } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!webSession) {
        const restored = await restoreSessionNative();
        if (cancelled) return;
        if (restored) {
          // onAuthStateChange will fire and populate state — nothing else to do.
          return;
        }
      }

      setSession(prev => prev ?? webSession);
      setUser(prev => prev ?? (webSession?.user ?? null));
      if (webSession?.user) fetchProfile(webSession.user.id);
      setLoading(false);
    }, 100);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      clearTimeout(fallbackTimer);
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
      const result = await Promise.race([
        supabase.auth.signInWithPassword({ email, password }),
        new Promise<{ error: Error }>((_, reject) =>
          setTimeout(() => reject(new Error('Sign-in timed out. Check your connection and try again.')), 15000)
        ),
      ]);
      return { error: (result as { error: Error | null }).error };
    } catch (e) {
      return { error: e instanceof Error ? e : new Error('Sign-in failed') };
    }
  };

  const signOut = async () => {
    // Clear local UI state IMMEDIATELY so the rest of the app re-renders to
    // logged-out even if the network calls below stall.
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsAdmin(false);

    // Clear biometric enrollment + native keychain session so the next user
    // on the same device does NOT inherit Face ID prompts or restored tokens.
    try { disableBiometric(); } catch {}
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
    } catch {}

    // WKWebView on iOS can silently drop the /logout fetch and hang forever.
    // Race against a 3s timeout — we've already cleared local state above.
    try {
      await Promise.race([
        supabase.auth.signOut({ scope: 'local' }),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
    } catch {}
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