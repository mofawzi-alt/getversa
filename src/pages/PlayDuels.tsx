import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Swords, Inbox, Send, Trophy, Clock, X, Play as PlayIcon } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFriends } from '@/hooks/useFriends';
import { toast } from 'sonner';

type Tab = 'inbox' | 'sent' | 'history';

interface Duel {
  id: string;
  challenger_id: string;
  challenged_id: string;
  status: string;
  taunt_message: string | null;
  poll_id: string;
  poll_ids: string[] | null;
  challenger_score: number | null;
  challenged_score: number | null;
  match_rate: number | null;
  created_at: string;
  completed_at: string | null;
}

export default function PlayDuels() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { friends } = useFriends();
  const [tab, setTab] = useState<Tab>('inbox');
  const [duels, setDuels] = useState<Duel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStartSheet, setShowStartSheet] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [usernames, setUsernames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    loadDuels();
  }, [user]);

  const loadDuels = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('poll_challenges')
      .select('*')
      .or(`challenger_id.eq.${user!.id},challenged_id.eq.${user!.id}`)
      .order('created_at', { ascending: false });

    const list = (data || []) as Duel[];
    setDuels(list);

    // Fetch usernames for the other party
    const otherIds = Array.from(
      new Set(list.map((d) => (d.challenger_id === user!.id ? d.challenged_id : d.challenger_id)))
    );
    if (otherIds.length) {
      const { data: profs } = await supabase.rpc('get_public_profiles', { user_ids: otherIds });
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => {
        map[p.id] = p.username || 'Friend';
      });
      setUsernames(map);
    }
    setLoading(false);
  };

  const startDuel = async () => {
    if (!selectedFriend) return;
    setSending(true);
    try {
      // Pick 5 random active polls
      const { data: pollData } = await supabase
        .from('polls')
        .select('id')
        .eq('is_active', true)
        .limit(60);
      const shuffled = (pollData || []).sort(() => Math.random() - 0.5).slice(0, 5);
      const pollIds = shuffled.map((p) => p.id);
      if (pollIds.length < 5) {
        toast.error('Not enough polls available');
        setSending(false);
        return;
      }

      const { error } = await supabase.from('poll_challenges').insert({
        challenger_id: user!.id,
        challenged_id: selectedFriend,
        poll_id: pollIds[0],
        poll_ids: pollIds,
        game_type: 'duel_5',
        taunt_message: "Bet you can't match my picks 😏",
      });

      if (error) throw error;

      // Get challenger username for personalized push
      const { data: meData } = await supabase
        .from('users')
        .select('username')
        .eq('id', user!.id)
        .maybeSingle();
      const challengerName = meData?.username || 'A friend';
      const pushTitle = `⚔️ ${challengerName} challenged you!`;
      const pushBody = "Dared you to a 5-poll duel. Can you match their picks?";

      // In-app notification
      await supabase.from('notifications').insert({
        user_id: selectedFriend,
        title: pushTitle,
        body: pushBody,
        type: 'poll_challenge',
        data: { tab: 'duels', challenger_id: user!.id },
      });

      // Web push notification (same pattern as DMs)
      await supabase.functions.invoke('send-push-notification', {
        body: {
          title: pushTitle,
          body: pushBody,
          url: '/play/duels',
          user_ids: [selectedFriend],
          skip_in_app: true,
        },
      });

      toast.success('Duel sent! 🔥');
      setShowStartSheet(false);
      setSelectedFriend(null);
      loadDuels();
    } catch (e) {
      toast.error('Could not start duel');
    } finally {
      setSending(false);
    }
  };

  const respondToDuel = async (duel: Duel, accept: boolean) => {
    const newStatus = accept ? 'accepted' : 'declined';
    const { error } = await supabase
      .from('poll_challenges')
      .update({
        status: newStatus,
        responded_at: new Date().toISOString(),
        ...(accept ? {} : { completed_at: new Date().toISOString() }),
      })
      .eq('id', duel.id)
      .eq('challenged_id', user!.id)
      .eq('status', 'pending');
    if (error) {
      toast.error('Could not respond');
      return;
    }

    // Notify challenger
    const { data: meData } = await supabase
      .from('users')
      .select('username')
      .eq('id', user!.id)
      .maybeSingle();
    const myName = meData?.username || 'Your friend';
    const title = accept ? `🔥 ${myName} accepted your duel!` : `😬 ${myName} declined your duel`;
    const body = accept ? 'Game on — may the best taste win.' : 'Maybe next time.';

    await supabase.from('notifications').insert({
      user_id: duel.challenger_id,
      title,
      body,
      type: 'poll_challenge',
      data: { tab: 'duels', challenged_id: user!.id },
    });
    await supabase.functions.invoke('send-push-notification', {
      body: {
        title,
        body,
        url: '/play/duels',
        user_ids: [duel.challenger_id],
        skip_in_app: true,
      },
    });

    if (accept) {
      toast.success('Challenge accepted! 🔥');
      navigate(`/play/duels/${duel.id}`);
      return;
    }
    toast.success('Challenge declined');
    setDuels((prev) =>
      prev.map((d) => (d.id === duel.id ? { ...d, status: newStatus } : d))
    );
  };

  const cancelDuel = async (duelId: string) => {
    if (!confirm('Cancel this duel challenge?')) return;
    const { error } = await supabase
      .from('poll_challenges')
      .delete()
      .eq('id', duelId)
      .eq('challenger_id', user!.id)
      .eq('status', 'pending');
    if (error) {
      toast.error('Could not cancel');
      return;
    }
    toast.success('Challenge cancelled');
    setDuels((prev) => prev.filter((d) => d.id !== duelId));
  };

  const inbox = duels.filter(
    (d) => d.challenged_id === user?.id && d.status === 'pending'
  );
  const sent = duels.filter(
    (d) => d.challenger_id === user?.id && d.status === 'pending'
  );
  const history = duels.filter((d) => d.status !== 'pending');

  const list = tab === 'inbox' ? inbox : tab === 'sent' ? sent : history;

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6">
        <button
          onClick={() => navigate('/play')}
          className="flex items-center gap-1 text-sm text-muted-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Play
        </button>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Swords className="h-5 w-5 text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Duels</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Friend Battles</h1>
          </div>
          <button
            onClick={() => setShowStartSheet(true)}
            className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1"
          >
            <Swords className="h-3.5 w-3.5" /> New Duel
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 p-1 bg-muted rounded-full">
          {(['inbox', 'sent', 'history'] as Tab[]).map((t) => {
            const count = t === 'inbox' ? inbox.length : t === 'sent' ? sent.length : history.length;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-full text-xs font-bold capitalize transition-colors ${
                  tab === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                {t === 'inbox' && <Inbox className="h-3 w-3 inline mr-1" />}
                {t === 'sent' && <Send className="h-3 w-3 inline mr-1" />}
                {t === 'history' && <Trophy className="h-3 w-3 inline mr-1" />}
                {t} {count > 0 && `(${count})`}
              </button>
            );
          })}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex w-14 h-14 rounded-full bg-muted items-center justify-center mb-3">
              <Swords className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              {tab === 'inbox' && 'No incoming duels yet'}
              {tab === 'sent' && 'No pending duels sent'}
              {tab === 'history' && 'No completed duels yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((d) => {
              const otherId = d.challenger_id === user?.id ? d.challenged_id : d.challenger_id;
              const otherName = usernames[otherId] || 'Friend';
              const isMine = d.challenger_id === user?.id;

              return (
                <div
                  key={d.id}
                  className="p-4 rounded-2xl bg-card border border-border/40"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-primary">
                        {otherName[0]?.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground">
                        {isMine ? `You → ${otherName}` : `${otherName} → You`}
                      </p>
                      {d.taunt_message && (
                        <p className="text-xs text-muted-foreground mt-0.5 italic">
                          "{d.taunt_message}"
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(d.created_at).toLocaleDateString()}
                        {d.poll_ids && (
                          <span className="ml-1 px-1.5 py-0.5 rounded bg-muted font-bold">
                            {d.poll_ids.length} polls
                          </span>
                        )}
                        {d.match_rate !== null && (
                          <span className="ml-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">
                            {d.match_rate}% match
                          </span>
                        )}
                      </div>
                    </div>
                    {tab === 'inbox' && (
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => respondToDuel(d, true)}
                          className="px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => respondToDuel(d, false)}
                          className="px-3 py-1.5 rounded-full bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive text-xs font-bold transition-colors"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                    {tab === 'sent' && (
                      <button
                        onClick={() => cancelDuel(d.id)}
                        aria-label="Cancel challenge"
                        className="px-2.5 py-1.5 rounded-full bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive text-xs font-bold flex-shrink-0 flex items-center gap-1 transition-colors"
                      >
                        <X className="h-3 w-3" /> Cancel
                      </button>
                    )}
                    {tab === 'history' && (
                      <button
                        onClick={() => navigate(`/play/duels/${d.id}`)}
                        className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold flex-shrink-0 flex items-center gap-1"
                      >
                        <PlayIcon className="h-3 w-3" />
                        {d.status === 'completed' ? 'View' : 'Play'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Start sheet */}
        {showStartSheet && (
          <div
            className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowStartSheet(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl bg-background flex flex-col max-h-[85vh] overflow-hidden"
            >
              <div className="p-5 pb-3">
                <h3 className="text-base font-bold text-foreground mb-1 flex items-center gap-2">
                  <Swords className="h-4 w-4 text-primary" /> Pick a friend
                </h3>
                <p className="text-xs text-muted-foreground">
                  We'll auto-pick 5 polls for both of you.
                </p>
              </div>
              <div className="flex-1 overflow-y-auto px-5">
                {friends.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-sm text-muted-foreground mb-3">No friends yet</p>
                    <button
                      onClick={() => navigate('/friends')}
                      className="text-xs font-bold text-primary"
                    >
                      Add friends →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5 pb-3">
                    {friends.map((f) => (
                      <button
                        key={f.friend_id}
                        onClick={() => setSelectedFriend(f.friend_id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-colors ${
                          selectedFriend === f.friend_id
                            ? 'bg-primary/10 border border-primary/30'
                            : 'bg-muted/50 hover:bg-muted'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                          <span className="text-xs font-bold text-primary">
                            {(f.friend_username || '?')[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {f.friend_username || 'Friend'}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {friends.length > 0 && (
                <div className="p-5 pt-3 border-t border-border/40 bg-background">
                  <button
                    onClick={startDuel}
                    disabled={!selectedFriend || sending}
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50"
                  >
                    {sending ? 'Starting…' : 'Start Duel'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
