import { Coins, Sparkles, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useT } from '@/hooks/useT';

interface Props {
  open: boolean;
  cost: number;
  balance: number;
  teaser: string;
  route: 'simple' | 'medium' | 'complex';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onEarn: () => void;
}

export default function UnlockModal({
  open, cost, balance, teaser, route: _route, loading, onConfirm, onCancel, onEarn,
}: Props) {
  const { t } = useT();
  if (!open) return null;
  const canAfford = balance >= cost;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={onCancel}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-background rounded-t-3xl sm:rounded-3xl p-5 pb-8 safe-area-bottom space-y-4 animate-in slide-in-from-bottom"
      >
        <div className="flex items-start justify-between">
          <div className="inline-flex h-10 w-10 rounded-full bg-primary/10 items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-full hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-1">
          <h3 className="text-lg font-bold">
            {canAfford ? t('Ready to ask?') : t('You need more credits')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {canAfford
              ? t('This will use credits from your balance.')
              : t('Vote on polls to earn credits — then come back and ask anything.')}
          </p>
        </div>

        {/* Balance */}
        <div className="flex items-center justify-between rounded-xl border border-border p-3">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-foreground">
              {t('{n} credit{s} left', { n: balance, s: balance === 1 ? '' : 's' })}
            </span>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">
            {t('Need {n}', { n: cost })}
          </span>
        </div>

        {canAfford ? (
          <button
            onClick={onConfirm}
            disabled={loading}
            className="w-full h-12 rounded-full bg-primary text-primary-foreground text-sm font-bold active:scale-[0.98] transition disabled:opacity-60"
          >
            {loading ? t('Getting answer…') : t('Ask now')}
          </button>
        ) : (
          <div className="space-y-2">
            <button
              onClick={onEarn}
              className="w-full h-12 rounded-full bg-primary text-primary-foreground text-sm font-bold active:scale-[0.98] transition"
            >
              {t('Vote to earn credits')}
            </button>
            <p className="text-[11px] text-center text-muted-foreground">
              {t('You need {n} more credit{s}. Every vote earns credits.', { n: cost - balance, s: cost - balance === 1 ? '' : 's' })}
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
