import { useState } from 'react';
import { Swords } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFriends } from '@/hooks/useFriends';
import { toast } from 'sonner';
import { pickDuelPollIds } from '@/lib/duels';
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
  'Prove me wrong 🔥',
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
      const pollIds = await pickDuelPollIds([pollId]);
      if (pollIds.length < 5) {
        toast.error('Not enough polls available');
        return;
      }

      const { data: inserted, error } = await supabase
        .from('poll_challenges')
        .insert({
          challenger_id: user.id,
          challenged_id: selectedFriend,
          poll_id: pollIds[0],
          poll_ids: pollIds,
          game_type: 'duel_5',
          taunt_message: taunt,
          challenger_choice: JSON.stringify([userChoice]),
        })
        .select('id')
        .single();

      if (error) throw error;

      const newDuelId = inserted?.id;

      const { data: meData } = await supabase
        .from('users')
        .select('username')
        .eq('id', user.id)
        .maybeSingle();

      const challengerName = meData?.username || 'A friend';
      const title = `⚔️ ${challengerName} challenged you!`;
      const body = `${taunt} • Tap to accept and play.`;
      const deepUrl = newDuelId ? `/play/duels/${newDuelId}` : '/play/duels';

      await supabase.from('notifications').insert({
        user_id: selectedFriend,
        title,
        body,
        type: 'poll_challenge',
        data: { tab: 'duels', challenger_id: user.id, duel_id: newDuelId, url: deepUrl },
      });

      await supabase.functions.invoke('send-push-notification', {
        body: {
          title,
          body,
          url: deepUrl,
          user_ids: [selectedFriend],
          skip_in_app: true,
        },
      });

      toast.success('Duel sent! 🔥');
      setOpen(false);
      setSelectedFriend(null);
    } catch {
      toast.error('Failed to send challenge');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors"
      >
        <Swords className="h-3 w-3" /> Challenge
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          <div className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden">
            <div className="p-5 pb-3 shrink-0">
              <DialogHeader className="text-left">
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <Swords className="h-4 w-4 text-primary" /> Challenge a Friend
                </DialogTitle>
              </DialogHeader>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-2">{pollQuestion}</p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 min-h-0">
              <div className="space-y-1.5 pb-4">
                {friends.map((friend) => (
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
                        <p className="text-[10px] text-muted-foreground">
                          {friend.compatibility_score}% match
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <div className="pb-4">
                <p className="text-xs font-semibold text-foreground mb-1.5">Pick your taunt:</p>
                <div className="flex flex-wrap gap-1.5">
                  {TAUNT_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setTaunt(preset)}
                      className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                        taunt === preset
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-border/40 bg-background p-5 pt-3 safe-area-bottom shrink-0">
              <button
                onClick={handleSend}
                disabled={!selectedFriend || sending}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Swords className="h-4 w-4" />
                {sending ? 'Starting…' : 'Start Duel'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
