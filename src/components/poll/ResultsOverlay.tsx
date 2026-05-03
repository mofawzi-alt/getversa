import { forwardRef, useEffect, useMemo } from 'react';
import ShareButton from './ShareButton';
import ChallengeButton from './ChallengeButton';
import { pickFeedbackMessage } from '@/components/feed/VoteFeedbackOverlay';
import CliffhangerSeries from './CliffhangerSeries';
import { useCelebrityVotes } from '@/hooks/useCelebrityVotes';
import VerifiedBadge from '@/components/VerifiedBadge';
import { useGenderSplitTeaser } from '@/hooks/useGenderSplitTeaser';
import { usePeopleLikeYou } from '@/hooks/usePeopleLikeYou';
import { getInsightTier } from '@/lib/streakGating';
import { useAuth } from '@/contexts/AuthContext';
import StreakInsightTeaser from './StreakInsightTeaser';
  


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

const AUTO_ADVANCE_MS = 1400;

const ResultsOverlay = forwardRef<HTMLDivElement, ResultsOverlayProps>(({ poll, result, onContinue }, ref) => {
  const { profile } = useAuth();
  const userPercent = result.choice === 'A' ? result.percentA : result.percentB;
  const isWinnerA = result.percentA >= result.percentB;
  const userPickedWinner = (result.choice === 'A' && isWinnerA) || (result.choice === 'B' && !isWinnerA);
  const { data: celebrityVotes = [] } = useCelebrityVotes(poll.id, poll.category);
  const streak: number = (profile as any)?.current_streak ?? 0;
  const insightTier = getInsightTier(streak);
  const { data: genderTeaser } = useGenderSplitTeaser(poll.id, poll.option_a, poll.option_b, result.percentA, result.percentB);
  const { data: peopleLikeYou } = usePeopleLikeYou(poll.id, result.choice, poll.option_a, poll.option_b);
  const microFeedback = useMemo(() => pickFeedbackMessage(result.percentA, result.percentB, result.choice), [result.percentA, result.percentB, result.choice]);

  // Auto-advance after 1.4 seconds
  useEffect(() => {
    const timer = setTimeout(onContinue, AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [onContinue]);

  return (
    <div
      ref={ref}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/90 backdrop-blur-md animate-fade-in"
      onClick={onContinue}
    >
      <div className="w-full max-w-sm bg-card text-card-foreground rounded-2xl p-5 shadow-card border border-border animate-scale-in">
        {/* Question */}
        <p className="text-sm font-medium text-muted-foreground mb-4 leading-snug text-center">
          {poll.question}
        </p>

        {/* Options with results */}
        <div className="space-y-3 mb-4">
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

        {/* Footer */}
        <div className="text-center space-y-1.5">
          <p className="text-xs text-muted-foreground">
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
          {celebrityVotes.length > 0 && (
            <div className="space-y-0.5 mt-1">
              {celebrityVotes.map((celeb, i) => (
                <div key={i} className="flex items-center justify-center gap-1">
                  <VerifiedBadge size="sm" />
                  <span className="text-[10px] font-semibold text-foreground/80">
                    {celeb.choice === result.choice
                      ? `${celeb.username} also chose this`
                      : `${celeb.username} voted the other way`}
                  </span>
                </div>
              ))}
            </div>
          )}
          {genderTeaser && (
            <p className="text-[11px] text-muted-foreground mt-1.5">{genderTeaser.text}</p>
          )}
          {peopleLikeYou && (
            <p className="text-[11px] text-foreground/70 mt-1 font-medium">👥 {peopleLikeYou.text}</p>
          )}
          <StreakInsightTeaser pollId={poll.id} choice={result.choice} />
          
          <div className="flex items-center justify-center gap-3 mt-2">
            <ChallengeButton pollId={poll.id} pollQuestion={poll.question} userChoice={result.choice} />
          </div>
          <CliffhangerSeries currentPollId={poll.id} onPollTap={() => onContinue()} />
        </div>

        {/* Progress bar for auto-advance */}
        <div className="mt-4 h-0.5 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full"
            style={{
              animation: `progress-fill ${AUTO_ADVANCE_MS}ms linear forwards`,
            }}
          />
        </div>
      </div>
    </div>
  );
});

ResultsOverlay.displayName = 'ResultsOverlay';
export default ResultsOverlay;

const isVideoUrl = (url?: string | null) =>
  !!url && /\.(mp4|webm|mov|ogg)(\?|$)/i.test(url);

/* ── Option row ── */
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
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 ${
        isUserChoice ? `ring-2 ring-${side === 'A' ? 'option-a' : 'option-b'}` : ''
      }`}>
        {imageUrl ? (
          isVideoUrl(imageUrl) ? (
            <video src={imageUrl} className="w-full h-full object-contain bg-black" autoPlay loop muted playsInline />
          ) : (
            <img src={imageUrl} alt={label} className="w-full h-full object-contain bg-black" />
          )
        ) : (
          <div className={`w-full h-full ${barColor} flex items-center justify-center`}>
            <span className="text-primary-foreground font-bold text-xs">{side}</span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className={`text-sm font-medium ${isUserChoice ? textColor : 'text-foreground'}`}>
            {label.length <= 40 ? label : label.slice(0, 40).replace(/\s+\S*$/, '') + '...'}
          </span>
          <span className={`font-bold text-base ml-2 flex-shrink-0 ${isWinner ? 'text-foreground' : 'text-muted-foreground'}`}>
            {percent}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
          <div
            className={`h-full rounded-full ${barColor}`}
            style={{
              width: `${percent}%`,
              transition: 'width 0.7s ease-out',
            }}
          />
        </div>
        {isUserChoice && (
          <p className={`text-xs ${textColor} mt-0.5`}>Your vote</p>
        )}
      </div>
    </div>
  );
}
