import { useState } from 'react';
import { Share2, MessageCircle, Send } from 'lucide-react';
import { toast } from 'sonner';
import SharePollToFriendSheet from '@/components/messages/SharePollToFriendSheet';
import { useAuth } from '@/contexts/AuthContext';

interface PostVoteSharePromptProps {
  pollId: string;
  pollQuestion: string;
  optionA: string;
  optionB: string;
  userChoice: 'A' | 'B';
  percentA: number;
  percentB: number;
}

export default function PostVoteSharePrompt({
  pollId,
  pollQuestion,
  optionA,
  optionB,
  userChoice,
  percentA,
  percentB,
}: PostVoteSharePromptProps) {
  const { user } = useAuth();
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const userPick = userChoice === 'A' ? optionA : optionB;
  const userPercent = userChoice === 'A' ? percentA : percentB;
  const pollUrl = `${window.location.origin}/poll/${pollId}`;

  const shareText = `I picked ${userPick} (${userPercent}% agree) 👀\n\n"${pollQuestion}"\n\nWhat would you choose?`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'What would you pick?',
          text: shareText,
          url: pollUrl,
        });
      } catch {
        // cancelled
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareText}\n${pollUrl}`);
        toast.success('Copied to clipboard!');
      } catch {
        toast.error('Failed to copy');
      }
    }
  };

  const handleWhatsApp = () => {
    const encoded = encodeURIComponent(`${shareText}\n${pollUrl}`);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
        {user && (
          <button
            onClick={(e) => { e.stopPropagation(); setShareSheetOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold hover:bg-primary/90 transition-colors"
          >
            <Send className="h-3 w-3" />
            Send in chat
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); handleShare(); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold hover:bg-primary/20 transition-colors"
        >
          <Share2 className="h-3 w-3" />
          Share link
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleWhatsApp(); }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-green-500/10 text-green-600 text-[11px] font-bold hover:bg-green-500/20 transition-colors"
        >
          <MessageCircle className="h-3 w-3" />
          WhatsApp
        </button>
      </div>

      <SharePollToFriendSheet
        pollId={pollId}
        pollQuestion={pollQuestion}
        open={shareSheetOpen}
        onOpenChange={setShareSheetOpen}
      />
    </>
  );
}
