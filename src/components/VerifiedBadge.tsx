import { BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VerifiedBadgeProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

export default function VerifiedBadge({ className, size = 'sm' }: VerifiedBadgeProps) {
  return (
    <BadgeCheck
      className={cn('text-blue-500 shrink-0 inline-block', sizeMap[size], className)}
      aria-label="Verified Public Figure"
    />
  );
}
