import { useState } from 'react';
import { Swords } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFriends } from '@/hooks/useFriends';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ChallengeButtonProps {
  pollId: string;
  pollQuestion: string;
  userChoice: 'A' | 'B';
}

const TAUNT_PRESETS = [
  "I dare you to disagree 😏",
  "Bet you won't pick the same 👀",
  "Let's see if we match 🤝",
  "Prove me wrong 🔥",
];

export default function ChallengeButton({ pollId, pollQuestion, userChoice }: ChallengeButtonProps) {
  const { user } = useAuth();
  const { friends } = useFriends();
  const [open, setOpen] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const [taunt, setTaunt] = useState(TAUNT_PRESETS[0]);
  const [sending, setSending] = useState(false);

  if (!user || friends.length === 0) return null;

  const handleSend = async () => {
    if (!selectedFriend) return;
    setSending(true);
    try {
      // Insert challenge
      const { error } = await supabase
        .from('poll_challenges' as any)
        .insert({
          challenger_id: user.id,
          challenged_id: selectedFriend,
          poll_id: pollId,
          taunt_message: taunt,
          challenger_choice: userChoice,
        });

      if (error) throw error;

      // Create in-app notification
      const friendData = friends.find(f => f.friend_id === selectedFriend);
      await supabase.from('notifications').insert({
        user_id: selectedFriend,
        title: '⚔️ You\'ve been challenged!',
        body: `${friendData ? 'Your friend' : 'Someone'} challenged you: "${taunt}"`,
        type: 'poll_challenge',
        data: { poll_id: pollId, challenger_id: user.id },
      });

      // Send push notification
      await supabase.functions.invoke('send-push-notification', {
        body: {
          title: '⚔️ Challenge received!',
          body: `"${taunt}" — Vote now!`,
          url: `/poll/${pollId}`,
          poll_id: pollId,
          user_ids: [selectedFriend],
        },
      });

      toast.success('Challenge sent! 🔥');
      setOpen(false);
    } catch (err) {
      toast.error('Failed to send challenge');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors"
      >
        <Swords className="h-3 w-3" /> Challenge
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Swords className="h-4 w-4 text-primary" /> Challenge a Friend
            </DialogTitle>
          </DialogHeader>

          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{pollQuestion}</p>

          {/* Friend selector */}
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {friends.map(friend => (
              <button
                key={friend.friend_id}
                onClick={() => setSelectedFriend(friend.friend_id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-colors ${
                  selectedFriend === friend.friend_id
                    ? 'bg-primary/10 border border-primary/30'
                    : 'bg-muted/50 hover:bg-muted'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">
                    {(friend.friend_username || '?')[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{friend.friend_username || 'Friend'}</p>
                  {friend.compatibility_score != null && (
                    <p className="text-[10px] text-muted-foreground">{friend.compatibility_score}% match</p>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Taunt selector */}
          <div className="mt-3">
            <p className="text-xs font-semibold text-foreground mb-1.5">Pick your taunt:</p>
            <div className="flex flex-wrap gap-1.5">
              {TAUNT_PRESETS.map(t => (
                <button
                  key={t}
                  onClick={() => setTaunt(t)}
                  className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                    taunt === t
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSend}
            disabled={!selectedFriend || sending}
            className="w-full mt-3 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Swords className="h-4 w-4" />
            {sending ? 'Sending...' : 'Send Challenge'}
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
