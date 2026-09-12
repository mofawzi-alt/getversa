import { useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { translate } from '@/lib/i18n';

/**
 * UI translation hook. Keys are the English strings, so anything
 * without an Arabic entry safely renders in English.
 */
export function useT() {
  const { lang, isRTL } = useLanguage();
  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(key, lang, vars),
    [lang],
  );
  return { t, lang, isRTL };
}
