import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { useConversations } from '@/hooks/useMessages';
import { MessageCircle, Loader2, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import UserAvatar from '@/components/UserAvatar';

export default function Messages() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: conversations = [], isLoading } = useConversations();

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-24">
        <div className="flex items-center gap-2 mb-4">
          <MessageCircle className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Messages</h1>
        </div>

        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && conversations.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium mb-1">No messages yet</p>
            <p className="text-sm">Start a chat from your Friends page</p>
            <button
              onClick={() => navigate('/friends')}
              className="mt-4 text-primary text-sm font-medium underline"
            >
              Go to Friends
            </button>
          </div>
        )}

        <div className="space-y-1">
          {conversations.map((c) => {
            const isMine = c.last_sender_id === user?.id;
            const preview = c.last_message_preview || 'No messages yet';
            return (
              <button
                key={c.conversation_id}
                onClick={() => navigate(`/messages/${c.conversation_id}`)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 active:bg-muted transition-colors text-left"
              >
                <UserAvatar
                  url={c.other_avatar_url}
                  username={c.other_username}
                  className="w-12 h-12"
                  fallbackClassName="bg-primary/10"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold truncate">
                      {c.other_username || 'Unknown'}
                    </p>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: false })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p
                      className={`text-sm truncate ${
                        c.unread_count > 0 && !isMine ? 'font-semibold text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {isMine && 'You: '}
                      {preview}
                    </p>
                    {c.unread_count > 0 && !isMine && (
                      <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center shrink-0">
                        {c.unread_count}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
