import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getPollDisplayImageSrc, handlePollImageError } from '@/lib/pollImages';
import { shouldUseBrandTreatment, getBrandBgColor } from '@/lib/brandConfig';

interface PollOptionImageProps {
  imageUrl: string | null;
  option: string;
  question?: string;
  side: 'A' | 'B';
  className?: string;         // outer container classes (sizing)
  showLoader?: boolean;
  eager?: boolean;
  pollId?: string;
}

/**
 * Unified poll option image component.
 * - Brand/logo polls: centered logo on brand-colored background with 25% padding
 * - Photo polls: full-bleed object-cover
 */
export default function PollOptionImage({
  imageUrl,
  option,
  question,
  side,
  className = 'w-full h-full',
  showLoader = false,
  eager = false,
  pollId,
}: PollOptionImageProps) {
  const [loaded, setLoaded] = useState(false);

  const imgSrc = getPollDisplayImageSrc({ imageUrl, option, question: question ?? '', side });
  const isBrand = shouldUseBrandTreatment(option, imageUrl);

  if (!imgSrc) {
    // Fallback: colored box with text
    const colorVar = side === 'A' ? 'option-a' : 'option-b';
    return (
      <div className={`${className} bg-gradient-to-br from-${colorVar} to-${colorVar}/80 flex items-center justify-center p-4`}>
        <span className={`text-${colorVar}-foreground text-center font-bold text-xl leading-tight`}>{option}</span>
      </div>
    );
  }

  if (isBrand) {
    const bgColor = getBrandBgColor(option);
    return (
      <div className={`${className} relative flex items-center justify-center`} style={{ backgroundColor: bgColor }}>
        {showLoader && !loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-white/50" />
          </div>
        )}
        <img
          key={pollId ? `${pollId}-${side}` : undefined}
          src={imgSrc}
          alt={option}
          className={`max-w-[50%] max-h-[50%] object-contain pointer-events-none transition-opacity duration-300 ${loaded || !showLoader ? 'opacity-100' : 'opacity-0'}`}
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={(e) => handlePollImageError(e, { option, question, side })}
          loading={eager ? 'eager' : 'lazy'}
        />
      </div>
    );
  }

  // Photo treatment: full bleed
  return (
    <div className={`${className} relative overflow-hidden`}>
      {showLoader && !loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      <img
        key={pollId ? `${pollId}-${side}` : undefined}
        src={imgSrc}
        alt={option}
        className={`w-full h-full object-cover bg-muted pointer-events-none transition-opacity duration-300 ${loaded || !showLoader ? 'opacity-100' : 'opacity-0'}`}
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={(e) => handlePollImageError(e, { option, question, side })}
        loading={eager ? 'eager' : 'lazy'}
      />
    </div>
  );
}
