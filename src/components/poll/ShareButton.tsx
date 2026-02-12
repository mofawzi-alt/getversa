import { useState, forwardRef } from 'react';
import { Share2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface ShareButtonProps {
  pollId: string;
  pollQuestion: string;
  optionA?: string;
  optionB?: string;
  percentA?: number;
  percentB?: number;
  showResults?: boolean;
  variant?: 'default' | 'icon';
}

const ShareButton = forwardRef<HTMLButtonElement, ShareButtonProps>(function ShareButton({
  pollId,
  pollQuestion,
  optionA,
  optionB,
  percentA,
  percentB,
  showResults = false,
  variant = 'default',
}, ref) {
  const [copied, setCopied] = useState(false);

  const baseUrl = window.location.origin;
  const pollUrl = `${baseUrl}/poll/${pollId}`;
  
  const shareText = showResults && percentA !== undefined && percentB !== undefined
    ? `📊 Poll Results: ${pollQuestion}\n\n${optionA}: ${percentA}%\n${optionB}: ${percentB}%\n\nPowered by Versa — Decision Infrastructure`
    : `🗳️ ${pollQuestion}\n\nA: ${optionA}\nB: ${optionB}\n\nPowered by Versa — Decision Infrastructure`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(pollUrl);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy link');
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'VERSA Poll',
          text: shareText,
          url: pollUrl,
        });
      } catch (err) {
        // User cancelled or share failed
        if ((err as Error).name !== 'AbortError') {
          toast.error('Failed to share');
        }
      }
    } else {
      handleCopyLink();
    }
  };

  if (variant === 'icon') {
    return (
      <Button
        ref={ref}
        variant="ghost"
        size="icon"
        onClick={handleNativeShare}
        className="h-8 w-8 rounded-full"
      >
        <Share2 className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button ref={ref} variant="outline" size="sm" className="gap-2 h-10 px-3 text-card-foreground border-border">
          <Share2 className="h-4 w-4" />
          Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleNativeShare}>
          <Share2 className="h-4 w-4 mr-2" />
          Share via...
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyLink}>
          {copied ? (
            <>
              <Check className="h-4 w-4 mr-2 text-green-500" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-2" />
              Copy Link
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

export default ShareButton;
