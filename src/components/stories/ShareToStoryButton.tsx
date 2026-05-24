import { useState } from 'react';
import { CirclePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserStories, type UserStoryType } from '@/hooks/useUserStories';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { getNativeSafeImageSrc } from '@/lib/pollImages';

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
    const safeImageUrl = getNativeSafeImageSrc(imageUrl, null as any);
    const safeContent = {
      ...content,
      image_url: getNativeSafeImageSrc(content.image_url, safeImageUrl || null),
      image_a_url: getNativeSafeImageSrc(content.image_a_url, null as any),
      image_b_url: getNativeSafeImageSrc(content.image_b_url, null as any),
      card_image: getNativeSafeImageSrc(content.card_image, null as any),
      icon_url: getNativeSafeImageSrc(content.icon_url, null as any),
    };

    postStory(
      { story_type: storyType, content: safeContent, image_url: safeImageUrl },
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
