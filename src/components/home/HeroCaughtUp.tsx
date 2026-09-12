import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { useT } from '@/hooks/useT';

export default function HeroCaughtUp() {
  const { t } = useT();
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const cairoNow = new Date(now.getTime() + (now.getTimezoneOffset() + 120) * 60000);
      const next = new Date(cairoNow);
      next.setHours(7, 0, 0, 0);
      if (cairoNow.getHours() >= 7) next.setDate(next.getDate() + 1);
      const diff = next.getTime() - cairoNow.getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setCountdown(`${h}h ${m}m`);
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="w-full px-3 py-3">
      <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        <p className="text-xs font-medium">{t('Next drop in')} <span className="text-foreground font-bold">{countdown}</span> · {t('New polls at 9 AM')}</p>
      </div>
    </div>
  );
}
