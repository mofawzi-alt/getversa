import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { isNativePlatform } from '@/lib/nativeAuth';

const COOKIE_KEY = 'versa_cookie_consent';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Apple Guideline 5.1.2(i): on native iOS/Android we do NOT show a
    // cookie prompt because Versa does not use cookies for tracking or
    // advertising on Apple devices. Showing one without ATT triggers a
    // rejection. Web browsers still see the banner for GDPR/EU clarity.
    if (isNativePlatform()) return;
    try {
      if (!localStorage.getItem(COOKIE_KEY)) setVisible(true);
    } catch {}
  }, []);

  const respond = (accepted: boolean) => {
    try { localStorage.setItem(COOKIE_KEY, accepted ? 'accepted' : 'declined'); } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[100] p-4 pb-safe animate-slide-up pointer-events-none">
      <div className="max-w-md mx-auto bg-card border border-border/60 rounded-2xl p-4 shadow-lg flex flex-col gap-3">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Versa uses only essential cookies to keep you signed in. We do not use cookies for advertising or to track you across other apps and websites.
        </p>
        <div className="flex gap-2 pointer-events-auto">
          <Button onClick={() => respond(true)} className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-full h-10">
            Got it
          </Button>
          <Button onClick={() => respond(false)} variant="secondary" className="flex-1 rounded-full h-10">
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}
