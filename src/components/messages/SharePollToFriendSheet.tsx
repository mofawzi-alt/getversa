import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useFriends } from '@/hooks/useFriends';
import { useOpenConversation, useSendMessage } from '@/hooks/useMessages';
import { Send, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import ShareToStoryButton from '@/components/stories/ShareToStoryButton';

interface Props {
  pollId: string;
  pollQuestion?: string;
  optionA?: string;
  optionB?: string;
  percentA?: number;
  percentB?: number;
  imageUrl?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SharePollToFriendSheet({ pollId, pollQuestion, optionA, optionB, percentA, percentB, imageUrl, open, onOpenChange }: Props) {
  const { friends, loadingFriends } = useFriends();
  const openConv = useOpenConversation();
  const sendMessage = useSendMessage();
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);

  const handleSend = async (friendId: string) => {
    setPendingId(friendId);
    try {
      const convId = await openConv.mutateAsync(friendId);
      await sendMessage.mutateAsync({ conversationId: convId, sharedPollId: pollId });
      setSentTo((prev) => new Set(prev).add(friendId));
      toast.success('Poll sent!');
    } catch {
      // toast handled in hooks
    } finally {
      setPendingId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
        <SheetHeader className="text-left mb-3">
          <SheetTitle>Send to a friend</SheetTitle>
          {pollQuestion && (
            <p className="text-sm text-muted-foreground line-clamp-2">{pollQuestion}</p>
          )}
        </SheetHeader>

        {loadingFriends && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loadingFriends && friends.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Add friends first to share polls in chat.
          </div>
        )}

        <div className="space-y-1">
          {friends.map((f) => {
            const sent = sentTo.has(f.friend_id);
            const loading = pendingId === f.friend_id;
            return (
              <div
                key={f.friend_id}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                  {(f.friend_username || '?')[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{f.friend_username || 'Unknown'}</p>
                  {f.compatibility_score !== null && (
                    <p className="text-xs text-muted-foreground">
                      {f.compatibility_score}% match
                    </p>
                  )}
                </div>
                <button
                  onClick={() => !sent && !loading && handleSend(f.friend_id)}
                  disabled={sent || loading}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium flex items-center gap-1.5 transition-colors ${
                    sent
                      ? 'bg-green-500/10 text-green-600'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  } disabled:opacity-60`}
                >
                  {loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : sent ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Sent
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" /> Send
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
