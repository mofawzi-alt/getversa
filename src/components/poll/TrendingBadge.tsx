import { Flame } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TrendingBadgeProps {
  className?: string;
  size?: 'xs' | 'sm';
}

/**
 * Auto-rendered when a poll exceeds the trending threshold
 * (>100 votes in the last 2 hours — see useTrendingPolls hook).
 */
export default function TrendingBadge({ className, size = 'xs' }: TrendingBadgeProps) {
  const padding = size === 'sm' ? 'px-2 py-0.5' : 'px-1.5 py-0.5';
  const text = size === 'sm' ? 'text-[11px]' : 'text-[10px]';
  const icon = size === 'sm' ? 'h-3 w-3' : 'h-2.5 w-2.5';

  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider text-white shadow-sm',
        'bg-gradient-to-r from-orange-500 to-red-500',
        padding,
        text,
        className
      )}
    >
      <Flame className={cn(icon, 'fill-white')} />
      Trending
    </motion.span>
  );
}
