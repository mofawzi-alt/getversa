/**
 * EgoShareCard — generates a screenshot-worthy result card
 * designed for Instagram/TikTok stories. Identity-driven statements.
 */
import { useMemo } from 'react';

interface EgoShareCardProps {
  question: string;
  choice: 'A' | 'B';
  optionA: string;
  optionB: string;
  percentA: number;
  percentB: number;
  totalVotes: number;
  username?: string;
}

/** Pick an ego-driven headline based on result position */
function getEgoStatement(
  userPercent: number,
  isWinner: boolean,
  totalVotes: number,
): string {
  if (userPercent <= 10) return `Only ${userPercent}% agree with me.`;
  if (userPercent <= 20) return `My taste is controversial.`;
  if (userPercent <= 30) return `I'm in the bold minority.`;
  if (!isWinner && userPercent <= 40) return `I voted against the crowd.`;
  if (isWinner && userPercent >= 80) return `${userPercent}% of Egypt agrees with me.`;
  if (isWinner && userPercent >= 65) return `I'm with the majority on this one.`;
  if (Math.abs(50 - userPercent) <= 5) return `Egypt is completely split.`;
  return `${totalVotes.toLocaleString()} people voted. Here's where I stand.`;
}

export default function EgoShareCard({
  question,
  choice,
  optionA,
  optionB,
  percentA,
  percentB,
  totalVotes,
  username,
}: EgoShareCardProps) {
  const userPercent = choice === 'A' ? percentA : percentB;
  const userOption = choice === 'A' ? optionA : optionB;
  const isWinnerA = percentA >= percentB;
  const isWinner = (choice === 'A' && isWinnerA) || (choice === 'B' && !isWinnerA);
  const egoLine = useMemo(() => getEgoStatement(userPercent, isWinner, totalVotes), [userPercent, isWinner, totalVotes]);

  return (
    <div className="w-full max-w-[340px] mx-auto rounded-2xl overflow-hidden bg-foreground text-background">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <p className="text-[11px] font-medium opacity-50 uppercase tracking-widest mb-1">My Opinion</p>
        <p className="text-lg font-bold leading-tight">{egoLine}</p>
      </div>

      {/* Question */}
      <div className="px-5 pb-3">
        <p className="text-sm opacity-70 leading-snug">{question}</p>
      </div>

      {/* Result bars */}
      <div className="px-5 pb-2 space-y-2">
        <ResultBar
          label={optionA}
          percent={percentA}
          isUser={choice === 'A'}
          side="A"
        />
        <ResultBar
          label={optionB}
          percent={percentB}
          isUser={choice === 'B'}
          side="B"
        />
      </div>

      {/* Footer */}
      <div className="px-5 py-3 flex items-center justify-between opacity-50">
        <span className="text-[10px] font-medium">
          {totalVotes.toLocaleString()} votes
        </span>
        <span className="text-[10px] font-semibold tracking-wide">
          {username ? `@${username}` : ''} · versa
        </span>
      </div>
    </div>
  );
}

function ResultBar({ label, percent, isUser, side }: {
  label: string; percent: number; isUser: boolean; side: 'A' | 'B';
}) {
  const barBg = side === 'A' ? 'bg-option-a' : 'bg-option-b';
  return (
    <div className={`relative rounded-lg overflow-hidden ${isUser ? 'ring-1 ring-background/30' : ''}`}>
      <div className="relative z-10 flex items-center justify-between px-3 py-2">
        <span className={`text-xs font-semibold ${isUser ? 'text-background' : 'text-background/60'}`}>
          {label} {isUser && '← You'}
        </span>
        <span className={`text-sm font-bold ${isUser ? 'text-background' : 'text-background/60'}`}>
          {percent}%
        </span>
      </div>
      <div
        className={`absolute inset-0 ${barBg} opacity-${isUser ? '40' : '15'}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export { getEgoStatement };
