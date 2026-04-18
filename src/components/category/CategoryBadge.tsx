import { getCategoryIcon, getCategoryColorClass } from '@/lib/categoryMeta';

interface CategoryBadgeProps {
  category: string;
  label?: string;
  size?: 'xs' | 'sm';
  variant?: 'pill' | 'plain' | 'overlay';
  className?: string;
}

export default function CategoryBadge({
  category,
  label,
  size = 'xs',
  variant = 'pill',
  className = '',
}: CategoryBadgeProps) {
  const Icon = getCategoryIcon(category);
  const isSmall = size === 'sm';

  const colorClass = getCategoryColorClass(category);

  const baseClasses =
    variant === 'plain'
      ? 'inline-flex items-center text-primary'
      : variant === 'overlay'
      ? 'inline-flex items-center rounded-full backdrop-blur-md bg-white/90 text-foreground font-semibold shadow-md ring-1 ring-black/5'
      : `inline-flex items-center rounded-full font-medium ${colorClass}`;

  const spacingClasses = isSmall ? 'gap-1.5 text-xs px-2 py-0.5' : 'gap-1 text-[10px] px-1.5 py-0.5';
  const iconClasses = isSmall ? 'h-3.5 w-3.5' : 'h-3 w-3';

  return (
    <span className={`${baseClasses} ${spacingClasses} ${className}`.trim()}>
      <Icon className={`${iconClasses} shrink-0`} />
      <span className="truncate">{label ?? category}</span>
    </span>
  );
}
