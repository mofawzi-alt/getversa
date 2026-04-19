import { Coins, Sparkles, Lock, X } from 'lucide-react';
import { createPortal } from 'react-dom';

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

const ROUTE_LABEL: Record<string, string> = {
  simple: 'Quick fact',
  medium: 'Insight',
  complex: 'Deep analysis',
};

export default function UnlockModal({
  open, cost, balance, teaser, route, loading, onConfirm, onCancel, onEarn,
}: Props) {
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
          <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{ROUTE_LABEL[route]}</p>
          <h3 className="text-lg font-bold">Unlock this insight?</h3>
        </div>

        {/* Teaser */}
        <div className="rounded-2xl bg-muted/50 p-3.5 relative overflow-hidden">
          <p className="text-sm text-foreground/80 italic leading-relaxed line-clamp-2">"{teaser}"</p>
          <div className="absolute inset-0 flex items-end justify-center pb-1 bg-gradient-to-t from-muted/50 via-muted/30 to-transparent">
            <Lock className="h-4 w-4 text-muted-foreground/60" />
          </div>
        </div>

        {/* Cost vs balance */}
        <div className="flex items-center justify-between rounded-xl border border-border p-3">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-foreground">{cost} credit{cost === 1 ? '' : 's'}</span>
          </div>
          <span className={`text-xs font-semibold ${canAfford ? 'text-muted-foreground' : 'text-destructive'}`}>
            Balance: {balance}
          </span>
        </div>

        {canAfford ? (
          <button
            onClick={onConfirm}
            disabled={loading}
            className="w-full h-12 rounded-full bg-primary text-primary-foreground text-sm font-bold active:scale-[0.98] transition disabled:opacity-60"
          >
            {loading ? 'Unlocking…' : `Unlock for ${cost} credit${cost === 1 ? '' : 's'}`}
          </button>
        ) : (
          <div className="space-y-2">
            <button
              onClick={onEarn}
              className="w-full h-12 rounded-full bg-primary text-primary-foreground text-sm font-bold active:scale-[0.98] transition"
            >
              Browse polls to earn credits
            </button>
            <p className="text-[11px] text-center text-muted-foreground">
              Need {cost - balance} more. Earn +1 credit per vote — unlimited polls in Browse.
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
