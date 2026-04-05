import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getPollDisplayImageSrc, handlePollImageError } from '@/lib/pollImages';
import { getBrandColor, getImageTreatment } from '@/lib/brandDetection';

interface PollOptionImageProps {
  imageUrl: string | null;
  option: string;
  question: string;
  side: 'A' | 'B';
  className?: string;
  /** Maximum logo size as percentage of container width. Default 50% */
  maxLogoSize?: string;
  /** Show loading spinner */
  showLoader?: boolean;
  draggable?: boolean;
  loading?: 'eager' | 'lazy';
}

/**
 * Unified image component for poll options.
 * - Logo polls: brand color background + centered logo with object-fit: contain
 * - Photo polls: full-bleed photo with object-fit: cover
 * 
 * Never stretches any image.
 */
export default function PollOptionImage({
  imageUrl,
  option,
  question,
  side,
  className = '',
  maxLogoSize = '65%',
  showLoader = false,
  draggable = false,
  loading = 'eager',
}: PollOptionImageProps) {
  const [loaded, setLoaded] = useState(false);

  const imgSrc = getPollDisplayImageSrc({
    imageUrl,
    option,
    question,
    side,
  });

  const treatment = getImageTreatment(option, imageUrl);
  const brandColor = getBrandColor(option);

  if (treatment === 'logo' && imgSrc) {
    return (
      <div
        className={`w-full h-full flex items-center justify-center ${className}`}
        style={{ backgroundColor: brandColor || '#1a1a1a' }}
      >
        {showLoader && !loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-white/40" />
          </div>
        )}
        <img
          src={imgSrc}
          alt={option}
          className="pointer-events-none transition-opacity duration-300"
          style={{
            objectFit: 'contain',
            maxWidth: maxLogoSize,
            maxHeight: maxLogoSize,
            opacity: showLoader && !loaded ? 0 : 1,
          }}
          onLoad={() => setLoaded(true)}
          onError={(e) => handlePollImageError(e, { option, question, side })}
          draggable={draggable}
          loading={loading}
        />
      </div>
    );
  }

  // Photo treatment — object-cover, fills container
  return (
    <div className={`w-full h-full relative ${className}`}>
      {showLoader && !loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      <img
        src={imgSrc || undefined}
        alt={option}
        className={`w-full h-full object-cover object-center bg-muted pointer-events-none transition-opacity duration-300 ${
          showLoader && !loaded ? 'opacity-0' : 'opacity-100'
        }`}
        onLoad={() => setLoaded(true)}
        onError={(e) => handlePollImageError(e, { option, question, side })}
        draggable={draggable}
        loading={loading}
      />
    </div>
  );
}
