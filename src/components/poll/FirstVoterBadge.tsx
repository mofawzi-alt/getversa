import { Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FirstVoterBadgeProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md';
}

/**
 * Awarded to the first 10 voters on any poll.
 * Shown on the result screen and on profile vote history.
 */
export default function FirstVoterBadge({ className, size = 'sm' }: FirstVoterBadgeProps) {
  const padding = size === 'md' ? 'px-2.5 py-1' : size === 'sm' ? 'px-2 py-0.5' : 'px-1.5 py-0.5';
  const text = size === 'md' ? 'text-xs' : size === 'sm' ? 'text-[11px]' : 'text-[10px]';
  const icon = size === 'md' ? 'h-3.5 w-3.5' : size === 'sm' ? 'h-3 w-3' : 'h-2.5 w-2.5';

  return (
    <motion.span
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider text-white shadow-sm',
        'bg-gradient-to-r from-amber-500 to-yellow-500',
        padding,
        text,
        className
      )}
      title="Among the first 10 to vote on this poll"
    >
      <Sparkles className={cn(icon, 'fill-white/40')} />
      First Voter
    </motion.span>
  );
}
