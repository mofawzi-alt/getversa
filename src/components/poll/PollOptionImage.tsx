import { useState, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { getPollDisplayImageSrc, handlePollImageError } from '@/lib/pollImages';
import { getBrandColor, getImageTreatment } from '@/lib/brandDetection';

/**
 * Card variant determines image sizing behavior:
 * - hero: object-cover + center (fills card, balanced cropping)
 * - browse: object-cover + center top (preserves top of image)
 * - history: object-contain + dark bg (shows full image, no crop)
 */
type CardVariant = 'hero' | 'browse' | 'history';

interface PollOptionImageProps {
  imageUrl: string | null;
  option: string;
  question: string;
  side: 'A' | 'B';
  className?: string;
  /** Maximum logo size as percentage of container width. Default 65% */
  maxLogoSize?: string;
  /** Show loading spinner */
  showLoader?: boolean;
  draggable?: boolean;
  loading?: 'eager' | 'lazy';
  /** Card type for image treatment. Default 'hero' */
  variant?: CardVariant;
}

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.ogg'];

function isVideoUrl(url: string | null): boolean {
  if (!url) return false;
  const lower = url.split('?')[0].toLowerCase();
  return VIDEO_EXTENSIONS.some(ext => lower.endsWith(ext));
}

/**
 * Unified media component for poll options.
 * - Video URLs: muted autoplay looping video
 * - Logo polls: brand color background + centered logo with object-fit: contain
 * - Photo polls: treatment varies by card variant
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
  variant = 'hero',
}: PollOptionImageProps) {
  const [loaded, setLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const imgSrc = getPollDisplayImageSrc({
    imageUrl,
    option,
    question,
    side,
  });

  // Auto-play video when it comes into view
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [imgSrc]);

  // Video treatment
  if (isVideoUrl(imageUrl)) {
    const videoStyles: Record<CardVariant, { objectFit: string; objectPosition: string }> = {
      hero: { objectFit: 'cover', objectPosition: 'center' },
      browse: { objectFit: 'cover', objectPosition: 'center top' },
      history: { objectFit: 'contain', objectPosition: 'center' },
    };
    const style = videoStyles[variant];

    return (
      <div
        className={`w-full h-full relative ${className}`}
        style={variant === 'history' ? { backgroundColor: 'hsl(var(--muted))' } : undefined}
      >
        {showLoader && !loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        <video
          ref={videoRef}
          src={imageUrl!}
          className={`w-full h-full pointer-events-none transition-opacity duration-300 ${
            showLoader && !loaded ? 'opacity-0' : 'opacity-100'
          }`}
          style={{
            objectFit: style.objectFit as any,
            objectPosition: style.objectPosition,
          }}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          onLoadedData={() => setLoaded(true)}
          draggable={draggable}
        />
      </div>
    );
  }

  const treatment = getImageTreatment(option, imageUrl);
  const brandColor = getBrandColor(option);

  if (treatment === 'logo' && imgSrc) {
    // Logo treatment is the same for all variants — centered on brand color
    const logoBg = brandColor || (variant === 'history' ? '#f1f5f9' : '#1a1a1a');
    return (
      <div
        className={`w-full h-full flex items-center justify-center ${className}`}
        style={{ backgroundColor: logoBg }}
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

  // Photo treatment — varies by card variant
  const photoStyles: Record<CardVariant, { objectFit: string; objectPosition: string; bg: string }> = {
    hero: { objectFit: 'cover', objectPosition: 'center', bg: 'bg-muted' },
    browse: { objectFit: 'cover', objectPosition: 'center top', bg: 'bg-muted' },
    history: { objectFit: 'contain', objectPosition: 'center', bg: 'bg-muted' },
  };

  const style = photoStyles[variant];

  return (
    <div
      className={`w-full h-full relative ${className}`}
      style={variant === 'history' ? { backgroundColor: 'hsl(var(--muted))' } : undefined}
    >
      {showLoader && !loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      <img
        src={imgSrc || undefined}
        alt={option}
        className={`w-full h-full ${style.bg} pointer-events-none transition-opacity duration-300 ${
          showLoader && !loaded ? 'opacity-0' : 'opacity-100'
        }`}
        style={{
          objectFit: style.objectFit as any,
          objectPosition: style.objectPosition,
        }}
        onLoad={() => setLoaded(true)}
        onError={(e) => handlePollImageError(e, { option, question, side })}
        draggable={draggable}
        loading={loading}
      />
    </div>
  );
}