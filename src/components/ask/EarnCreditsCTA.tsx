import { Coins, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  balance: number;
  charged: number;
}

export default function EarnCreditsCTA({ balance, charged }: Props) {
  const navigate = useNavigate();
  const nextCost = 3; // cost of a typical medium insight
  const votesNeeded = Math.max(1, nextCost - balance);

  return (
    <button
      onClick={() => navigate('/browse')}
      className="w-full mt-2 flex items-center justify-between gap-2 rounded-2xl bg-primary/5 border border-primary/20 p-3 active:scale-[0.99] transition"
    >
      <div className="flex items-center gap-2 text-left">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Coins className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-xs font-bold text-foreground">
            {balance > 0
              ? `${balance} credit${balance === 1 ? '' : 's'} left`
              : 'Browse polls to earn credits'}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {balance >= nextCost
              ? 'Ready for your next insight'
              : `Vote on ${votesNeeded} more poll${votesNeeded === 1 ? '' : 's'} in Browse to unlock →`}
          </p>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-primary shrink-0" />
    </button>
  );
}
