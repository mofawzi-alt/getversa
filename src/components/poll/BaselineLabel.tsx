/**
 * Subtle transparency label shown when poll results include seeded baseline votes.
 * Use anywhere results are displayed to disclose that totals include test data.
 */
interface BaselineLabelProps {
  active: boolean;
  className?: string;
}

import { useT } from '@/hooks/useT';

export default function BaselineLabel({ active, className = '' }: BaselineLabelProps) {
  const { t } = useT();
  if (!active) return null;
  return (
    <p className={`text-[10px] text-muted-foreground/70 italic text-center ${className}`}>
      {t('Results include baseline data')}
    </p>
  );
}
