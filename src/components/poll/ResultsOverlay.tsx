import { forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, X } from 'lucide-react';
import ShareButton from './ShareButton';

interface Poll {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  image_a_url?: string | null;
  image_b_url?: string | null;
  category?: string | null;
  is_sponsored?: boolean;
  sponsor_name?: string;
}

interface VoteResult {
  pollId: string;
  choice: 'A' | 'B';
  percentA: number;
  percentB: number;
  totalVotes: number;
  insights?: unknown;
}

interface ResultsOverlayProps {
  poll: Poll;
  result: VoteResult;
  onContinue: () => void;
}

const ResultsOverlay = forwardRef<HTMLDivElement, ResultsOverlayProps>(({ poll, result, onContinue }, ref) => {
  const userPercent = result.choice === 'A' ? result.percentA : result.percentB;
  const isWinnerA = result.percentA >= result.percentB;
  const userPickedWinner = (result.choice === 'A' && isWinnerA) || (result.choice === 'B' && !isWinnerA);

  return (
    <div ref={ref} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/95 backdrop-blur-lg animate-fade-in">
      <div className="w-full max-w-sm bg-card text-card-foreground rounded-3xl p-6 shadow-card animate-bounce-in border border-border">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">Results</span>
          <div className="flex items-center gap-2">
            <ShareButton
              pollId={poll.id}
              pollQuestion={poll.question}
              optionA={poll.option_a}
              optionB={poll.option_b}
              percentA={result.percentA}
              percentB={result.percentB}
              showResults={true}
              variant="icon"
            />
            <button onClick={onContinue} className="p-1 hover:bg-secondary rounded-full transition-colors">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Question */}
        <h2 className="text-lg font-display font-bold text-foreground mb-6 leading-snug">
          {poll.question}
        </h2>

        {/* Option A */}
        <div className="space-y-4 mb-6">
          <OptionRow
            label={poll.option_a}
            imageUrl={poll.image_a_url}
            percent={result.percentA}
            isWinner={isWinnerA}
            isUserChoice={result.choice === 'A'}
            side="A"
          />
          <OptionRow
            label={poll.option_b}
            imageUrl={poll.image_b_url}
            percent={result.percentB}
            isWinner={!isWinnerA}
            isUserChoice={result.choice === 'B'}
            side="B"
          />
        </div>

        {/* Footer stats */}
        <div className="text-center space-y-1.5 mb-6">
          <p className="text-sm text-muted-foreground">
            {result.totalVotes.toLocaleString()} votes
          </p>
          <p className="text-sm font-medium text-foreground">
            You voted with {userPercent}% of users
          </p>
          <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${
            userPickedWinner
              ? 'bg-primary/10 text-primary'
              : 'bg-muted text-muted-foreground'
          }`}>
            {userPickedWinner ? 'Majority' : 'Minority'}
          </span>
        </div>

        {/* Continue */}
        <Button
          onClick={onContinue}
          className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl"
        >
          Next Poll
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </div>
  );
});

ResultsOverlay.displayName = 'ResultsOverlay';
export default ResultsOverlay;

/* ── Small sub-component ── */
function OptionRow({ label, imageUrl, percent, isWinner, isUserChoice, side }: {
  label: string;
  imageUrl?: string | null;
  percent: number;
  isWinner: boolean;
  isUserChoice: boolean;
  side: 'A' | 'B';
}) {
  const barColor = side === 'A' ? 'bg-option-a' : 'bg-option-b';
  const textColor = side === 'A' ? 'text-option-a' : 'text-option-b';

  return (
    <div className="flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 ${
        isUserChoice ? `ring-2 ring-${side === 'A' ? 'option-a' : 'option-b'}` : ''
      }`}>
        {imageUrl ? (
          <img src={imageUrl} alt={label} className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full ${barColor} flex items-center justify-center`}>
            <span className="text-primary-foreground font-bold text-xs">{side}</span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className={`text-sm font-medium truncate ${isUserChoice ? textColor : 'text-foreground'}`}>
            {label}
          </span>
          <span className={`font-bold text-base ml-2 flex-shrink-0 ${isWinner ? 'text-foreground' : 'text-muted-foreground'}`}>
            {percent}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        {isUserChoice && (
          <p className={`text-xs ${textColor} mt-0.5`}>Your vote</p>
        )}
      </div>
    </div>
  );
}
