import { forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, TrendingUp, X, Flame, Globe, Users, Trophy } from 'lucide-react';
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
  insights?: {
    countryAlignment?: number;
    countryName?: string;
    ageGroupPreference?: string;
    ageGroupPercent?: number;
    activityPercentile?: number;
    currentStreak?: number;
    earnedBadges?: { name: string; description: string }[];
  };
}

interface ResultsOverlayProps {
  poll: Poll;
  result: VoteResult;
  onContinue: () => void;
}

const ResultsOverlay = forwardRef<HTMLDivElement, ResultsOverlayProps>(({ poll, result, onContinue }, ref) => {
  const userPercent = result.choice === 'A' ? result.percentA : result.percentB;
  const insights = result.insights;

  return (
    <div ref={ref} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/95 backdrop-blur-lg animate-fade-in">
      <div className="w-full max-w-sm bg-card text-card-foreground rounded-3xl p-6 shadow-card animate-bounce-in border border-border overflow-y-auto max-h-[90vh]">
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
        <div className="space-y-4 mb-5">
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

        {/* Total votes */}
        <div className="text-center mb-4">
          <p className="text-sm text-card-foreground/70">
            {result.totalVotes.toLocaleString()} total votes
          </p>
          <p className="text-sm font-medium text-primary">
            You voted with {userPercent}% of users
          </p>
        </div>

        {/* Insight Cards */}
        {insights && (
          <div className="space-y-2 mb-5">
            {/* Country alignment */}
            {insights.countryAlignment !== undefined && insights.countryName && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 border border-primary/20">
                <Globe className="h-4 w-4 text-primary flex-shrink-0" />
                <p className="text-sm text-foreground">
                  You voted with <span className="font-bold text-primary">{insights.countryAlignment}%</span> of {insights.countryName}
                </p>
              </div>
            )}

            {/* Age group preference */}
            {insights.ageGroupPreference && insights.ageGroupPercent && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-accent/10 border border-accent/20">
                <Users className="h-4 w-4 text-accent flex-shrink-0" />
                <p className="text-sm text-foreground">
                  Your age group prefers <span className="font-bold text-accent">{insights.ageGroupPreference}</span> ({insights.ageGroupPercent}%)
                </p>
              </div>
            )}

            {/* Activity percentile */}
            {insights.activityPercentile !== undefined && insights.activityPercentile >= 50 && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-chart-4/10 border border-chart-4/20">
                <Trophy className="h-4 w-4 text-chart-4 flex-shrink-0" />
                <p className="text-sm text-foreground">
                  You're in the <span className="font-bold text-chart-4">top {100 - insights.activityPercentile}%</span> most active voters
                </p>
              </div>
            )}

            {/* Streak */}
            {insights.currentStreak !== undefined && insights.currentStreak >= 2 && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20">
                <Flame className="h-4 w-4 text-destructive flex-shrink-0" />
                <p className="text-sm text-foreground">
                  <span className="font-bold text-destructive">{insights.currentStreak}-day streak!</span> Keep it going
                </p>
              </div>
            )}

            {/* Earned badges */}
            {insights.earnedBadges && insights.earnedBadges.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {insights.earnedBadges.map((badge, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/25"
                  >
                    <Flame className="h-3 w-3 text-primary" />
                    <span className="text-xs font-semibold text-primary">{badge.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
