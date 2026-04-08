import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

const COOKIE_KEY = 'versa_cookie_consent';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
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
    <div className="fixed bottom-0 inset-x-0 z-[100] p-4 pb-safe animate-slide-up">
      <div className="max-w-md mx-auto bg-card border border-border/60 rounded-2xl p-4 shadow-lg flex flex-col gap-3">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Versa uses essential cookies to keep you logged in and improve your experience. By continuing you accept our cookie use.
        </p>
        <div className="flex gap-2">
          <Button onClick={() => respond(true)} className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-full h-10">
            Accept
          </Button>
          <Button onClick={() => respond(false)} variant="secondary" className="flex-1 rounded-full h-10">
            Decline
          </Button>
        </div>
      </div>
    </div>
  );
}
