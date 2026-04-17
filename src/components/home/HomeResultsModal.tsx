import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Users } from 'lucide-react';
import ShareButton from '@/components/poll/ShareButton';
import { useGenderSplitTeaser } from '@/hooks/useGenderSplitTeaser';

interface HomeResultsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poll: {
    id: string;
    question: string;
    option_a: string;
    option_b: string;
    image_a_url: string | null;
    image_b_url: string | null;
    percentA: number;
    percentB: number;
    totalVotes: number;
    category: string | null;
  } | null;
  imageA: string;
  imageB: string;
  headerLabel?: string;
}

export default function HomeResultsModal({ open, onOpenChange, poll, imageA, imageB, headerLabel }: HomeResultsModalProps) {
  if (!poll) return null;

  const isWinnerA = poll.percentA >= poll.percentB;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 rounded-2xl overflow-hidden max-w-sm border-border/30 bg-card">
        {/* Split images */}
        <div className="flex h-44 relative">
          <div className="w-1/2 h-full relative overflow-hidden">
            <img src={poll.image_a_url || imageA} alt={poll.option_a} className="w-full h-full object-cover bg-muted" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute bottom-2 left-2 right-1">
              <p className="text-white text-xs font-bold drop-shadow-lg truncate">{poll.option_a}</p>
            </div>
          </div>
          <div className="absolute inset-y-0 left-1/2 w-px bg-background/15 z-10" />
          <div className="w-1/2 h-full relative overflow-hidden">
            <img src={poll.image_b_url || imageB} alt={poll.option_b} className="w-full h-full object-cover bg-muted" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute bottom-2 left-1 right-2 text-right">
              <p className="text-white text-xs font-bold drop-shadow-lg truncate">{poll.option_b}</p>
            </div>
          </div>
        </div>

        {/* Results below image */}
        <div className="flex justify-between items-center px-4 pt-2">
          <div className="flex flex-col items-center flex-1">
            <span className="text-2xl font-bold text-option-a">{poll.percentA}%</span>
          </div>
          <div className="flex flex-col items-center flex-1">
            <span className="text-2xl font-bold text-option-b">{poll.percentB}%</span>
          </div>
        </div>

        {/* Info */}
        <div className="px-4 py-3 space-y-2">
          {headerLabel && (
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
              {headerLabel}
            </p>
          )}
          <h3 className="text-sm font-bold text-foreground">{poll.question}</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {poll.totalVotes} votes</span>
              {poll.category && <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold text-[10px]">{poll.category}</span>}
            </div>
            <ShareButton
              pollId={poll.id}
              pollQuestion={poll.question}
              optionA={poll.option_a}
              optionB={poll.option_b}
              percentA={poll.percentA}
              percentB={poll.percentB}
              showResults={true}
              variant="icon"
            />
          </div>

          {/* Bars */}
          <div className="space-y-2 pt-1">
            <Bar label={poll.option_a} percent={poll.percentA} isWinner={isWinnerA} side="A" />
            <Bar label={poll.option_b} percent={poll.percentB} isWinner={!isWinnerA} side="B" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Bar({ label, percent, isWinner, side }: { label: string; percent: number; isWinner: boolean; side: 'A' | 'B' }) {
  const color = side === 'A' ? 'bg-option-a' : 'bg-option-b';
  return (
    <div>
      <div className="flex justify-between text-xs mb-0.5">
        <span className="font-medium text-foreground truncate">{label}</span>
        <span className={`font-bold ${isWinner ? 'text-foreground' : 'text-muted-foreground'}`}>{percent}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%`, transition: 'width 0.5s ease-out' }} />
      </div>
    </div>
  );
}
