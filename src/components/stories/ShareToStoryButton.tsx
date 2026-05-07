import { useState } from 'react';
import { CirclePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserStories, type UserStoryType } from '@/hooks/useUserStories';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ShareToStoryButtonProps {
  storyType: UserStoryType;
  content: Record<string, any>;
  imageUrl?: string | null;
  variant?: 'default' | 'icon' | 'compact';
  className?: string;
}

export default function ShareToStoryButton({
  storyType,
  content,
  imageUrl,
  variant = 'default',
  className = '',
}: ShareToStoryButtonProps) {
  const { user } = useAuth();
  const { postStory, postingStory } = useUserStories();
  const [shared, setShared] = useState(false);

  if (!user) return null;

  const handleShare = () => {
    postStory(
      { story_type: storyType, content, image_url: imageUrl },
      {
        onSuccess: () => setShared(true),
      }
    );
  };

  if (shared) {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled
        className={`gap-1.5 text-primary ${className}`}
      >
        <CirclePlus className="w-4 h-4" />
        {variant !== 'icon' && 'Shared ✓'}
      </Button>
    );
  }

  if (variant === 'icon') {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={handleShare}
        disabled={postingStory}
        className={`h-8 w-8 rounded-full ${className}`}
      >
        <CirclePlus className="w-4 h-4" />
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleShare}
      disabled={postingStory}
      className={`gap-1.5 h-9 px-3 text-foreground border-border ${className}`}
    >
      <CirclePlus className="w-4 h-4" />
      {variant === 'compact' ? 'Add to Story' : 'Add to Story'}
    </Button>
  );
}
