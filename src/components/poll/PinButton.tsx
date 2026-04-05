import { Pin, PinOff } from 'lucide-react';
import { usePinnedPoll } from '@/hooks/usePinnedPoll';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface PinButtonProps {
  pollId: string;
  className?: string;
  size?: 'sm' | 'md';
}

export default function PinButton({ pollId, className = '', size = 'sm' }: PinButtonProps) {
  const { user } = useAuth();
  const { userPinId, pinPoll, unpinPoll } = usePinnedPoll();

  if (!user) return null;

  const isPinned = userPinId === pollId;
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPinned) {
      unpinPoll.mutate(undefined, { onSuccess: () => toast.success('Unpinned from home') });
    } else {
      pinPoll.mutate(pollId, { onSuccess: () => toast.success('Pinned to top of home') });
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`p-1.5 rounded-full transition-colors ${
        isPinned
          ? 'bg-primary/20 text-primary'
          : 'bg-black/30 text-white/70 hover:text-white hover:bg-black/50'
      } ${className}`}
      title={isPinned ? 'Unpin from home' : 'Pin to top of home'}
    >
      {isPinned ? <PinOff className={iconSize} /> : <Pin className={iconSize} />}
    </button>
  );
}
