import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { AppLanguage } from '@/lib/pollText';

const STORAGE_KEY = 'versa_language';

interface LanguageContextValue {
  lang: AppLanguage;
  isRTL: boolean;
  setLanguage: (lang: AppLanguage) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  isRTL: false,
  setLanguage: () => {},
});

function detectInitialLanguage(): AppLanguage {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ar' || saved === 'en') return saved;
  } catch { /* ignore */ }
  const nav = (navigator.language || '').toLowerCase();
  return nav.startsWith('ar') ? 'ar' : 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [lang, setLang] = useState<AppLanguage>(detectInitialLanguage);
  const [syncedForUser, setSyncedForUser] = useState<string | null>(null);

  // When the signed-in user has a stored preference, adopt it once per login.
  useEffect(() => {
    const pref = (profile as any)?.preferred_language as AppLanguage | undefined;
    if (user && pref && (pref === 'ar' || pref === 'en') && syncedForUser !== user.id) {
      setSyncedForUser(user.id);
      if (pref !== lang) setLang(pref);
    }
  }, [user, profile, syncedForUser, lang]);

  // Apply direction + lang to the document so RTL works everywhere.
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  const value = useMemo<LanguageContextValue>(() => ({
    lang,
    isRTL: lang === 'ar',
    setLanguage: (next: AppLanguage) => {
      setLang(next);
      try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
      if (user) {
        void supabase
          .from('users')
          .update({ preferred_language: next } as any)
          .eq('id', user.id)
          .then(() => {});
      }
    },
  }), [lang, user]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
