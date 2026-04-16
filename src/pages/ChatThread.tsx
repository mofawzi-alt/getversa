import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  useConversationMessages,
  useSendMessage,
  useMarkConversationRead,
  Message,
} from '@/hooks/useMessages';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Send, Loader2, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import PickPollToShareSheet from '@/components/messages/PickPollToShareSheet';
import { toast } from 'sonner';

interface PollPreview {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  image_a_url: string | null;
  image_b_url: string | null;
}

function SharedPollBubble({ pollId }: { pollId: string }) {
  const [poll, setPoll] = useState<PollPreview | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('polls')
      .select('id, question, option_a, option_b, image_a_url, image_b_url')
      .eq('id', pollId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setPoll(data as PollPreview);
      });
    return () => {
      cancelled = true;
    };
  }, [pollId]);

  if (!poll) {
    return (
      <div className="rounded-xl border border-border p-3 text-xs text-muted-foreground">
        Loading poll…
      </div>
    );
  }

  return (
    <button
      onClick={() => navigate(`/poll/${poll.id}`)}
      className="rounded-xl overflow-hidden border border-border bg-background w-[240px] text-left hover:opacity-90 transition-opacity"
    >
      <div className="grid grid-cols-2 aspect-[2/1]">
        {[poll.image_a_url, poll.image_b_url].map((src, i) => (
          <div key={i} className="bg-muted relative">
            {src && <img src={src} alt="" className="w-full h-full object-cover" />}
          </div>
        ))}
      </div>
      <div className="p-2.5">
        <p className="text-xs font-semibold line-clamp-2 leading-snug">{poll.question}</p>
        <p className="text-[10px] text-muted-foreground mt-1">Tap to vote →</p>
      </div>
    </button>
  );
}

function MessageBubble({ msg, mine }: { msg: Message; mine: boolean }) {
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'} max-w-[80%]`}>
        {msg.message_type === 'poll_share' && msg.shared_poll_id ? (
          <SharedPollBubble pollId={msg.shared_poll_id} />
        ) : (
          <div
            className={`rounded-2xl px-3.5 py-2 text-sm break-words ${
              mine
                ? 'bg-primary text-primary-foreground rounded-br-md'
                : 'bg-muted text-foreground rounded-bl-md'
            }`}
          >
            {msg.content}
          </div>
        )}
        <span className="text-[10px] text-muted-foreground mt-0.5 px-1">
          {format(new Date(msg.created_at), 'h:mm a')}
        </span>
      </div>
    </div>
  );
}

export default function ChatThread() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [otherUsername, setOtherUsername] = useState<string>('');
  const [text, setText] = useState('');
  const [pollPickerOpen, setPollPickerOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useConversationMessages(conversationId);
  const sendMessage = useSendMessage();
  const markRead = useMarkConversationRead();

  // Resolve other username
  useEffect(() => {
    if (!conversationId || !user) return;
    supabase
      .from('conversations')
      .select('user1_id, user2_id')
      .eq('id', conversationId)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!data) return;
        const otherId = data.user1_id === user.id ? data.user2_id : data.user1_id;
        const { data: profile } = await supabase
          .rpc('get_public_profiles', { user_ids: [otherId] });
        setOtherUsername(profile?.[0]?.username || 'Friend');
      });
  }, [conversationId, user]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Mark as read when opening / when new messages arrive
  useEffect(() => {
    if (conversationId && messages.length > 0) {
      markRead.mutate(conversationId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, messages.length]);

  const handleSend = () => {
    if (!conversationId || !text.trim()) return;
    sendMessage.mutate({ conversationId, content: text.trim() });
    setText('');
  };

  const handleSendPoll = async (pollId: string) => {
    if (!conversationId) return;
    try {
      await sendMessage.mutateAsync({ conversationId, sharedPollId: pollId });
      setPollPickerOpen(false);
      toast.success('Poll sent!');
    } catch {
      // toast handled in hook
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      {/* Header */}
      <header
        className="flex items-center gap-3 px-3 py-3 border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <button
          onClick={() => navigate('/messages')}
          className="p-2 -ml-2 rounded-full hover:bg-muted active:bg-muted/80"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
          {(otherUsername || '?')[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{otherUsername || 'Loading…'}</p>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4">
        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!isLoading && messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-12">
            Say hi 👋
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} msg={m} mine={m.sender_id === user?.id} />
        ))}
      </div>

      {/* Composer */}
      <div
        className="border-t border-border bg-background px-3 py-2"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPollPickerOpen(true)}
            className="w-10 h-10 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center shrink-0 text-foreground"
            aria-label="Share a poll"
          >
            <BarChart3 className="h-4 w-4" />
          </button>
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Message…"
            className="flex-1 rounded-full"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!text.trim() || sendMessage.isPending}
            className="rounded-full shrink-0"
          >
            {sendMessage.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <PickPollToShareSheet
        open={pollPickerOpen}
        onOpenChange={setPollPickerOpen}
        onPick={handleSendPoll}
        sending={sendMessage.isPending}
      />
    </div>
  );
}
