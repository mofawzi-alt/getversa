import { cn } from '@/lib/utils';

interface UserAvatarProps {
  url?: string | null;
  username?: string | null;
  /** Tailwind size classes (e.g. 'w-12 h-12'). Default w-12 h-12. */
  className?: string;
  /** Override fallback background classes (default uses brand gradient). */
  fallbackClassName?: string;
}

/**
 * Circular user avatar.
 * Renders the uploaded avatar image when present, otherwise a clean colored circle.
 * No initials, no icon — minimal by request.
 */
export default function UserAvatar({
  url,
  username,
  className = 'w-12 h-12',
  fallbackClassName = 'bg-gradient-primary',
}: UserAvatarProps) {
  if (url) {
    return (
      <img
        src={url}
        alt={username ? `@${username}` : 'User avatar'}
        loading="lazy"
        className={cn('rounded-full object-cover shrink-0 bg-muted', className)}
        onError={(e) => {
          // Hide broken image and let parent fallback show via CSS
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }
  return (
    <div
      className={cn('rounded-full shrink-0', fallbackClassName, className)}
      aria-label={username ? `@${username}` : 'User avatar'}
    />
  );
}
