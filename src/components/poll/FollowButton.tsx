import { UserPlus, UserCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFollows } from '@/hooks/useFollows';
import { cn } from '@/lib/utils';

interface FollowButtonProps {
  creatorId: string;
  creatorName?: string | null;
  variant?: 'default' | 'compact' | 'icon';
  className?: string;
}

export default function FollowButton({ 
  creatorId, 
  creatorName,
  variant = 'default',
  className 
}: FollowButtonProps) {
  const { isFollowing, toggleFollow, followMutation, unfollowMutation } = useFollows();
  
  const following = isFollowing(creatorId);
  const isLoading = followMutation.isPending || unfollowMutation.isPending;

  if (variant === 'icon') {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleFollow(creatorId);
        }}
        disabled={isLoading}
        className={cn(
          "p-1.5 rounded-full transition-all",
          following 
            ? "bg-primary/20 text-primary" 
            : "bg-secondary/50 text-secondary-foreground hover:bg-primary/20 hover:text-primary",
          className
        )}
        title={following ? 'Unfollow' : 'Follow'}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : following ? (
          <UserCheck className="h-4 w-4" />
        ) : (
          <UserPlus className="h-4 w-4" />
        )}
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleFollow(creatorId);
        }}
        disabled={isLoading}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
          following 
            ? "bg-primary/20 text-primary" 
            : "bg-secondary text-secondary-foreground hover:bg-primary/20 hover:text-primary",
          className
        )}
      >
        {isLoading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : following ? (
          <>
            <UserCheck className="h-3 w-3" />
            Following
          </>
        ) : (
          <>
            <UserPlus className="h-3 w-3" />
            Follow
          </>
        )}
      </button>
    );
  }

  return (
    <Button
      onClick={(e) => {
        e.stopPropagation();
        toggleFollow(creatorId);
      }}
      disabled={isLoading}
      variant={following ? "secondary" : "default"}
      size="sm"
      className={cn("gap-2", className)}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : following ? (
        <>
          <UserCheck className="h-4 w-4" />
          Following
        </>
      ) : (
        <>
          <UserPlus className="h-4 w-4" />
          Follow{creatorName ? ` ${creatorName}` : ''}
        </>
      )}
    </Button>
  );
}
