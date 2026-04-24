import { Camera } from 'lucide-react';
import { forwardRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  url?: string | null;
  username?: string | null;
  /** Tailwind size classes (e.g. 'w-12 h-12'). Default w-12 h-12. */
  className?: string;
  /** Override fallback background classes (default neutral muted). */
  fallbackClassName?: string;
}

/**
 * Circular user avatar.
 * Renders the uploaded avatar image when present, otherwise a neutral circle
 * with a camera icon hinting at uploading a profile picture.
 *
 * Forwards refs so it can be used inside framer-motion / Radix primitives without
 * triggering React "function components cannot be given refs" warnings.
 */
const UserAvatar = forwardRef<HTMLDivElement, UserAvatarProps>(function UserAvatar(
  {
    url,
    username,
    className = 'w-12 h-12',
    fallbackClassName = 'bg-muted text-muted-foreground',
  },
  ref,
) {
  const [errored, setErrored] = useState(false);
  const showImage = !!url && !errored;

  if (showImage) {
    return (
      <img
        ref={ref as unknown as React.Ref<HTMLImageElement>}
        src={url!}
        alt={username ? `@${username}` : 'User avatar'}
        loading="lazy"
        decoding="async"
        className={cn('rounded-full object-cover shrink-0 bg-muted', className)}
        onError={() => setErrored(true)}
      />
    );
  }
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-full shrink-0 flex items-center justify-center',
        fallbackClassName,
        className,
      )}
      aria-label={username ? `@${username}` : 'User avatar'}
    >
      <Camera className="w-1/2 h-1/2 opacity-60" strokeWidth={1.75} />
    </div>
  );
});

export default UserAvatar;
