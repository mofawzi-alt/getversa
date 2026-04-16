import { useQuery } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Send } from 'lucide-react';

interface PollPick {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  image_a_url: string | null;
  image_b_url: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (pollId: string) => void;
  sending?: boolean;
}

/**
 * Bottom sheet shown inside a chat thread that lets the user pick one of
 * their recently voted polls to share into the conversation.
 */
export default function PickPollToShareSheet({ open, onOpenChange, onPick, sending }: Props) {
  const { user } = useAuth();

  const { data: polls = [], isLoading } = useQuery({
    queryKey: ['recent-voted-polls', user?.id],
    queryFn: async (): Promise<PollPick[]> => {
      if (!user) return [];
      const { data: votes } = await supabase
        .from('votes')
        .select('poll_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);
      const pollIds = (votes || []).map((v) => v.poll_id);
      if (pollIds.length === 0) return [];
      const { data: pollsData } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, image_a_url, image_b_url')
        .in('id', pollIds);
      const map = new Map((pollsData || []).map((p) => [p.id, p]));
      // Preserve vote-order
      return pollIds
        .map((id) => map.get(id))
        .filter(Boolean) as PollPick[];
    },
    enabled: !!user && open,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
        <SheetHeader className="text-left mb-3">
          <SheetTitle>Share a poll</SheetTitle>
          <p className="text-sm text-muted-foreground">Pick one of your recent votes to send.</p>
        </SheetHeader>

        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && polls.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Vote on a poll first, then come back here to share it.
          </div>
        )}

        <div className="space-y-2 pb-4">
          {polls.map((poll) => (
            <button
              key={poll.id}
              onClick={() => !sending && onPick(poll.id)}
              disabled={sending}
              className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 active:bg-muted transition-colors text-left disabled:opacity-50"
            >
              <div className="grid grid-cols-2 w-20 h-12 rounded-lg overflow-hidden shrink-0 border border-border">
                {[poll.image_a_url, poll.image_b_url].map((src, i) => (
                  <div key={i} className="bg-muted relative">
                    {src && <img src={src} alt="" className="w-full h-full object-cover" />}
                  </div>
                ))}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-2 leading-snug">{poll.question}</p>
              </div>
              <Send className="h-4 w-4 text-primary shrink-0" />
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
