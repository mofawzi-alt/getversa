import { Coins } from 'lucide-react';
import { useAskCredits } from '@/hooks/useAskCredits';

export default function CreditBalance({ compact = false }: { compact?: boolean }) {
  const { data: credits = 0, isLoading } = useAskCredits();

  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary font-bold ${compact ? 'h-7 px-2.5 text-[11px]' : 'h-8 px-3 text-xs'}`}>
      <Coins className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      <span>{isLoading ? '…' : credits}</span>
      {!compact && <span className="text-primary/70 font-medium">credits</span>}
    </div>
  );
}
