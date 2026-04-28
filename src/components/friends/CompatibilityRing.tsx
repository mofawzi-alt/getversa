interface CompatibilityRingProps {
  score: number | null;
  size?: number;
}

/**
 * Circular % match ring used in friend rows.
 * Pure visual — no logic, no data fetching.
 * Color tiers mirror getCompatibilityColor() in Friends.tsx.
 */
export default function CompatibilityRing({ score, size = 44 }: CompatibilityRingProps) {
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const value = score ?? 0;
  const dash = (value / 100) * circumference;

  const colorClass =
    score === null
      ? 'text-muted-foreground'
      : score >= 80
        ? 'text-green-500'
        : score >= 60
          ? 'text-primary'
          : score >= 40
            ? 'text-yellow-500'
            : 'text-orange-500';

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      aria-label={score !== null ? `${score}% vote match (agreement on shared polls)` : 'No shared votes yet'}
    >
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-secondary"
        />
        {score !== null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeLinecap="round"
            className={`${colorClass} transition-all duration-700`}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-[11px] font-bold ${colorClass}`}>
          {score !== null ? `${score}%` : '—'}
        </span>
      </div>
    </div>
  );
}
