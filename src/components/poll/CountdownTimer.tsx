import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CountdownTimerProps {
  endsAt: string;
  className?: string;
  showIcon?: boolean;
  size?: 'xs' | 'sm';
}

function format(diffMs: number): string {
  if (diffMs <= 0) return 'Ended';
  const totalSec = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes >= 10) return `${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

/**
 * Live countdown for trending polls.
 * - <1h: red text
 * - <10m: red + pulsing
 */
export default function CountdownTimer({ endsAt, className, showIcon = true, size = 'xs' }: CountdownTimerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const diff = new Date(endsAt).getTime() - Date.now();
    // Tick every second when <10m, every 30s when <1h, otherwise every minute
    const interval = diff < 10 * 60 * 1000 ? 1000 : diff < 60 * 60 * 1000 ? 30 * 1000 : 60 * 1000;
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [endsAt]);

  const diffMs = new Date(endsAt).getTime() - now;
  if (diffMs <= 0) return null;

  const isCritical = diffMs < 10 * 60 * 1000; // <10 min
  const isUrgent = diffMs < 60 * 60 * 1000;   // <1 hour
  const label = format(diffMs);

  const textSize = size === 'sm' ? 'text-xs' : 'text-[10px]';
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-2.5 w-2.5';
  const colorClass = isUrgent ? 'text-destructive' : 'text-muted-foreground';

  const content = (
    <span className={cn('inline-flex items-center gap-1 font-semibold tabular-nums', textSize, colorClass, className)}>
      {showIcon && <Timer className={iconSize} />}
      <span>Closes in {label}</span>
    </span>
  );

  if (isCritical) {
    return (
      <motion.span
        animate={{ opacity: [1, 0.55, 1] }}
        transition={{ duration: 1.2, repeat: Infinity }}
        className="inline-flex"
      >
        {content}
      </motion.span>
    );
  }

  return content;
}
