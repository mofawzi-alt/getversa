import { Button } from '@/components/ui/button';
import { ArrowRight, TrendingUp, X } from 'lucide-react';
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
}

interface ResultsOverlayProps {
  poll: Poll;
  result: VoteResult;
  onContinue: () => void;
}

export default function ResultsOverlay({ poll, result, onContinue }: ResultsOverlayProps) {
  const userPercent = result.choice === 'A' ? result.percentA : result.percentB;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/95 backdrop-blur-lg animate-fade-in">
      <div className="w-full max-w-sm bg-card text-card-foreground rounded-3xl p-6 shadow-card animate-bounce-in border border-border">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-primary">
            <TrendingUp className="h-5 w-5" />
            <span className="font-semibold">Results</span>
          </div>
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
        <h2 className="text-xl font-display font-extrabold text-foreground mb-6">
          {poll.question}
        </h2>

        {/* Results */}
        <div className="space-y-4 mb-6">
          {/* Option A */}
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 ${
              result.choice === 'A' ? 'ring-2 ring-option-a' : ''
            }`}>
              {poll.image_a_url ? (
                <img src={poll.image_a_url} alt={poll.option_a} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-option-a flex items-center justify-center">
                  <span className="text-option-a-foreground font-bold">A</span>
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-medium ${result.choice === 'A' ? 'text-option-a' : ''}`}>
                  {poll.option_a}
                </span>
                <span className="font-bold text-lg">{result.percentA}%</span>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out bg-option-a"
                  style={{ width: `${result.percentA}%` }}
                />
              </div>
              {result.choice === 'A' && (
                <p className="text-xs text-option-a mt-1">Your vote</p>
              )}
            </div>
          </div>

          {/* Option B */}
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 ${
              result.choice === 'B' ? 'ring-2 ring-option-b' : ''
            }`}>
              {poll.image_b_url ? (
                <img src={poll.image_b_url} alt={poll.option_b} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-option-b flex items-center justify-center">
                  <span className="text-option-b-foreground font-bold">B</span>
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-medium ${result.choice === 'B' ? 'text-option-b' : ''}`}>
                  {poll.option_b}
                </span>
                <span className="font-bold text-lg">{result.percentB}%</span>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out bg-option-b"
                  style={{ width: `${result.percentB}%` }}
                />
              </div>
              {result.choice === 'B' && (
                <p className="text-xs text-option-b mt-1">Your vote</p>
              )}
            </div>
          </div>
        </div>

        {/* Total votes + alignment */}
        <div className="text-center space-y-1 mb-4">
          <p className="text-sm text-card-foreground/70">
            {result.totalVotes.toLocaleString()} total votes
          </p>
          <p className="text-sm font-medium text-primary">
            You voted with {userPercent}% of users
          </p>
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
}
