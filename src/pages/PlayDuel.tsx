import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Swords, Trophy, Sparkles, Home as HomeIcon, BarChart3 } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import PollOptionImage from '@/components/poll/PollOptionImage';
import HomeResultsModal from '@/components/home/HomeResultsModal';
import ShareDuelResultCard from '@/components/poll/ShareDuelResultCard';
import ShareToStoryButton from '@/components/stories/ShareToStoryButton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Poll {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  image_a_url: string | null;
  image_b_url: string | null;
  category: string | null;
}

interface Duel {
  id: string;
  challenger_id: string;
  challenged_id: string;
  status: string;
  poll_id: string;
  poll_ids: string[] | null;
  taunt_message: string | null;
  challenger_choice: string | null;
  challenged_choice: string | null;
  challenger_score: number | null;
  challenged_score: number | null;
  match_rate: number | null;
}

function parseChoices(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export default function PlayDuel() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [duel, setDuel] = useState<Duel | null>(null);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [otherName, setOtherName] = useState<string>('Friend');
  const [step, setStep] = useState(0);
  const [myChoices, setMyChoices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [results, setResults] = useState<Record<string, { percentA: number; percentB: number; totalVotes: number }>>({});
  const [openResultPollId, setOpenResultPollId] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('users')
        .select('country')
        .eq('id', user.id)
        .maybeSingle();
      setCountry(data?.country ?? null);
    })();
  }, [user]);

  const seeHowLabel = country ? `See how ${country} voted` : 'See how everyone voted';

  useEffect(() => {
    if (!user || !id) return;
    load();
  }, [user, id]);

  // Auto-accept the duel as soon as the challenged user opens it.
  // Opening the challenge IS the acceptance — no separate gate.
  useEffect(() => {
    if (!user || !duel) return;
    if (duel.status !== 'pending') return;
    if (duel.challenged_id !== user.id) return;
    acceptChallenge();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, duel?.id, duel?.status]);

  // Realtime: live-update when the other player submits a vote / completes the duel
  useEffect(() => {
    if (!user || !id) return;
    const channel = supabase
      .channel(`duel-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'poll_challenges', filter: `id=eq.${id}` },
        (payload) => {
          const next = payload.new as Duel;
          setDuel((prev) => {
            // Detect the other side just completed
            const isChallenger = next.challenger_id === user.id;
            const prevOther = prev
              ? parseChoices(isChallenger ? prev.challenged_choice : prev.challenger_choice)
              : [];
            const newOther = parseChoices(
              isChallenger ? next.challenged_choice : next.challenger_choice
            );
            if (
              polls.length > 0 &&
              prevOther.length < polls.length &&
              newOther.length === polls.length
            ) {
              toast.success(`${otherName} just finished — results are in! 🏆`);
            }
            return next;
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, id, polls.length, otherName]);

  // Fetch national results once the user has finished — for the "see how Egypt voted" payoff
  useEffect(() => {
    const done = polls.length > 0 && myChoices.length === polls.length;
    if (!done || Object.keys(results).length === polls.length) return;
    (async () => {
      const ids = polls.map((p) => p.id);
      const { data } = await supabase.rpc('get_poll_results', { poll_ids: ids });
      if (data) {
        const map: Record<string, { percentA: number; percentB: number; totalVotes: number }> = {};
        (data as any[]).forEach((r: any) => {
          map[r.poll_id] = {
            percentA: r.percent_a ?? 0,
            percentB: r.percent_b ?? 0,
            totalVotes: r.total_votes ?? 0,
          };
        });
        setResults(map);
      }
    })();
  }, [polls, myChoices, results]);

  const load = async () => {
    setLoading(true);
    const { data: d, error } = await supabase
      .from('poll_challenges')
      .select('*')
      .eq('id', id!)
      .maybeSingle();

    if (error || !d) {
      toast.error('Duel not found');
      navigate('/play/duels');
      return;
    }
    const duelData = d as Duel;
    setDuel(duelData);

    const isChallenger = duelData.challenger_id === user!.id;
    const otherId = isChallenger ? duelData.challenged_id : duelData.challenger_id;
    const myRaw = isChallenger ? duelData.challenger_choice : duelData.challenged_choice;
    const existing = parseChoices(myRaw);
    setMyChoices(existing);
    setStep(existing.length);

    const ids = duelData.poll_ids || [];
    if (ids.length) {
      const { data: pollData } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, image_a_url, image_b_url, category')
        .in('id', ids);
      const ordered = ids
        .map((pid) => (pollData || []).find((p) => p.id === pid))
        .filter(Boolean) as Poll[];
      setPolls(ordered);
    }

    const { data: prof } = await supabase.rpc('get_public_profiles', { user_ids: [otherId] });
    if (prof && prof[0]) setOtherName(prof[0].username || 'Friend');

    setLoading(false);
  };

  const submitChoice = async (choice: 'A' | 'B') => {
    if (!duel || submitting) return;
    setSubmitting(true);
    const poll = polls[step];
    const next = [...myChoices, choice];
    const isChallenger = duel.challenger_id === user!.id;

    try {
      await supabase.from('votes').insert({
        user_id: user!.id,
        poll_id: poll.id,
        choice,
        category: poll.category,
        game_context: 'duel',
      } as any);

      const updates: Record<string, any> = isChallenger
        ? { challenger_choice: JSON.stringify(next) }
        : { challenged_choice: JSON.stringify(next) };

      const isLast = next.length === polls.length;
      if (isLast) {
        const otherRaw = isChallenger ? duel.challenged_choice : duel.challenger_choice;
        const otherChoices = parseChoices(otherRaw);
        if (otherChoices.length === polls.length) {
          let matches = 0;
          for (let i = 0; i < polls.length; i++) {
            if (otherChoices[i] === next[i]) matches++;
          }
          const rate = Math.round((matches / polls.length) * 100);
          updates.match_rate = rate;
          updates.status = 'completed';
          updates.completed_at = new Date().toISOString();
          if (isChallenger) updates.challenger_score = matches;
          else updates.challenged_score = matches;

          const otherId = isChallenger ? duel.challenged_id : duel.challenger_id;
          const meName =
            (await supabase.from('users').select('username').eq('id', user!.id).maybeSingle()).data
              ?.username || 'Your friend';
          const title = `🏆 Duel results: ${rate}% match`;
          const body = `${meName} finished. You matched ${matches}/${polls.length}.`;
          await supabase.from('notifications').insert({
            user_id: otherId,
            title,
            body,
            type: 'poll_challenge',
            data: { tab: 'history', duel_id: duel.id },
          });
          await supabase.functions.invoke('send-push-notification', {
            body: {
              title,
              body,
              url: `/play/duels/${duel.id}`,
              user_ids: [otherId],
              skip_in_app: true,
            },
          });
        } else {
          if (isChallenger) updates.challenger_score = next.length;
          else updates.challenged_score = next.length;

          // Notify the other player: I finished, your turn to finish
          const otherId = isChallenger ? duel.challenged_id : duel.challenger_id;
          const otherProgress = otherChoices.length;
          const meName =
            (await supabase.from('users').select('username').eq('id', user!.id).maybeSingle()).data
              ?.username || 'Your friend';
          const title =
            otherProgress === 0
              ? `⚔️ ${meName} finished the duel`
              : `⚔️ ${meName} finished — you're ${otherProgress}/${polls.length}`;
          const body =
            otherProgress === 0
              ? `They're waiting for you. Tap to start the ${polls.length}-poll duel.`
              : `Pick up where you left off and see your match rate.`;
          await supabase.from('notifications').insert({
            user_id: otherId,
            title,
            body,
            type: 'poll_challenge',
            data: { tab: 'duels', duel_id: duel.id, url: `/play/duels/${duel.id}` },
          });
          await supabase.functions.invoke('send-push-notification', {
            body: {
              title,
              body,
              url: `/play/duels/${duel.id}`,
              user_ids: [otherId],
              skip_in_app: true,
            },
          });
        }
      }

      const { error } = await supabase
        .from('poll_challenges')
        .update(updates)
        .eq('id', duel.id);
      if (error) throw error;

      setMyChoices(next);
      setStep(next.length);
      if (isLast) {
        const { data: refreshed } = await supabase
          .from('poll_challenges')
          .select('*')
          .eq('id', duel.id)
          .maybeSingle();
        if (refreshed) setDuel(refreshed as Duel);
      }
    } catch (e) {
      toast.error('Could not save vote');
    } finally {
      setSubmitting(false);
    }
  };

  const acceptChallenge = async () => {
    if (!duel || accepting) return;
    setAccepting(true);
    try {
      const { error } = await supabase
        .from('poll_challenges')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', duel.id)
        .eq('challenged_id', user!.id)
        .eq('status', 'pending');
      if (error) throw error;

      const { data: meData } = await supabase
        .from('users').select('username').eq('id', user!.id).maybeSingle();
      const myName = meData?.username || 'Your friend';
      const title = `🔥 ${myName} accepted your duel!`;
      const body = 'Game on — they\'re playing now.';
      await supabase.from('notifications').insert({
        user_id: duel.challenger_id,
        title,
        body,
        type: 'poll_challenge',
        data: { tab: 'duels', duel_id: duel.id, url: `/play/duels/${duel.id}` },
      });
      await supabase.functions.invoke('send-push-notification', {
        body: {
          title,
          body,
          url: `/play/duels/${duel.id}`,
          user_ids: [duel.challenger_id],
          skip_in_app: true,
        },
      });

      setDuel({ ...duel, status: 'accepted' });
      toast.success('Challenge accepted! 🔥');
    } catch {
      toast.error('Could not accept');
    } finally {
      setAccepting(false);
    }
  };

  const declineChallenge = async () => {
    if (!duel || accepting) return;
    setAccepting(true);
    try {
      await supabase
        .from('poll_challenges')
        .update({
          status: 'declined',
          responded_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        })
        .eq('id', duel.id)
        .eq('challenged_id', user!.id)
        .eq('status', 'pending');

      const { data: meData } = await supabase
        .from('users').select('username').eq('id', user!.id).maybeSingle();
      const myName = meData?.username || 'Your friend';
      const title = `😬 ${myName} declined your duel`;
      const body = 'Maybe next time.';
      await supabase.from('notifications').insert({
        user_id: duel.challenger_id,
        title,
        body,
        type: 'poll_challenge',
        data: { tab: 'duels', duel_id: duel.id },
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

      toast.success('Challenge declined');
      navigate('/play/duels');
    } catch {
      toast.error('Could not decline');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-20">
          <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!duel || polls.length === 0) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">Duel unavailable.</p>
        </div>
      </AppLayout>
    );
  }

  // Pending challenge for the challenged user — auto-accept is in flight.
  // Show a tiny loader so they don't see an "Accept gate".
  if (duel.status === 'pending' && duel.challenged_id === user!.id) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Opening duel from {otherName}…</p>
        </div>
      </AppLayout>
    );
  }

  const isChallenger = duel.challenger_id === user!.id;
  const myDone = myChoices.length === polls.length;
  const otherChoices = parseChoices(
    isChallenger ? duel.challenged_choice : duel.challenger_choice
  );
  const otherDone = otherChoices.length === polls.length;

  if (myDone) {
    const matches = otherDone
      ? polls.reduce((acc, _, i) => (myChoices[i] === otherChoices[i] ? acc + 1 : acc), 0)
      : null;
    const rate = matches !== null ? Math.round((matches / polls.length) * 100) : null;

    return (
      <AppLayout>
        <div className="max-w-lg mx-auto px-4 py-6">
          <button
            onClick={() => navigate('/play/duels')}
            className="flex items-center gap-1 text-sm text-muted-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Duels
          </button>

          <div className="text-center py-8">
            <div className="inline-flex w-16 h-16 rounded-full bg-primary/10 items-center justify-center mb-4">
              <Trophy className="h-8 w-8 text-primary" />
            </div>
            {rate !== null ? (
              <>
                <h1 className="text-3xl font-bold text-foreground mb-1">{rate}% Match</h1>
                <p className="text-sm text-muted-foreground">
                  You matched {matches}/{polls.length} with {otherName}
                </p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-foreground mb-1">Waiting for {otherName}…</h1>
                <p className="text-sm text-muted-foreground">
                  You finished. We'll notify you when {otherName} plays.
                </p>
              </>
            )}
          </div>

          <div className="space-y-2 mt-2">
            {polls.map((p, i) => {
              const mine = myChoices[i];
              const theirs = otherChoices[i];
              const matched = theirs && mine === theirs;
              const r = results[p.id];
              return (
                <button
                  key={p.id}
                  onClick={() => setOpenResultPollId(p.id)}
                  className="w-full p-3 rounded-2xl bg-card border border-border/40 flex items-center gap-3 text-left hover:border-primary/40 active:scale-[0.99] transition-all"
                >
                  <span className="text-[10px] font-bold text-muted-foreground w-5">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground line-clamp-1">
                      {p.question}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      You: <span className="font-bold text-foreground">{mine === 'A' ? p.option_a : p.option_b}</span>
                      {theirs && (
                        <>
                          {' '}· {otherName}:{' '}
                          <span className="font-bold text-foreground">
                            {theirs === 'A' ? p.option_a : p.option_b}
                          </span>
                        </>
                      )}
                    </p>
                    {r && (
                      <p className="text-[10px] text-primary mt-0.5 font-semibold flex items-center gap-1">
                        <BarChart3 className="h-2.5 w-2.5" />
                        {seeHowLabel} · {r.percentA}% / {r.percentB}%
                      </p>
                    )}
                  </div>
                  {theirs && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        matched
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {matched ? 'Match' : 'Diff'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Bridge CTAs — funnel back into solo voting (B2B data) + game loop */}
          <div className="mt-6 space-y-2">
            {rate !== null && otherDone && (
              <>
                <ShareToStoryButton
                  storyType="duel_result"
                  content={{
                    opponent: otherName,
                    won: rate >= 70,
                    tied: rate >= 40 && rate < 70,
                    score: `${matches}/${polls.length} matched · ${rate}% match`,
                    match_rate: rate,
                  }}
                  variant="default"
                  className="w-full"
                />
                <ShareDuelResultCard
                  duelId={duel.id}
                  myName={profile?.username || 'You'}
                  otherName={otherName}
                  myChoices={myChoices}
                  otherChoices={otherChoices}
                  polls={polls.map((p) => ({
                    id: p.id,
                    question: p.question,
                    option_a: p.option_a,
                    option_b: p.option_b,
                  }))}
                  matchRate={rate}
                  matches={matches!}
                />
              </>
            )}
            <button
              onClick={() => navigate('/home')}
              className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
            >
              <HomeIcon className="h-4 w-4" />
              Continue voting
            </button>
            <button
              onClick={() => navigate('/play/duels')}
              className="w-full py-3 rounded-2xl bg-muted text-foreground font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
            >
              <Swords className="h-4 w-4" />
              Challenge another friend
            </button>
            <p className="text-center text-[10px] text-muted-foreground mt-2">
              Tap any poll above to {seeHowLabel.toLowerCase()}.
            </p>
          </div>
        </div>

        <HomeResultsModal
          open={!!openResultPollId}
          onOpenChange={(o) => !o && setOpenResultPollId(null)}
          headerLabel={seeHowLabel}
          poll={(() => {
            const p = polls.find((x) => x.id === openResultPollId);
            const r = openResultPollId ? results[openResultPollId] : null;
            if (!p) return null;
            return {
              id: p.id,
              question: p.question,
              option_a: p.option_a,
              option_b: p.option_b,
              image_a_url: p.image_a_url,
              image_b_url: p.image_b_url,
              percentA: r?.percentA ?? 0,
              percentB: r?.percentB ?? 0,
              totalVotes: r?.totalVotes ?? 0,
              category: p.category,
            };
          })()}
          imageA=""
          imageB=""
        />
      </AppLayout>
    );
  }

  const current = polls[step];
  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6">
        <button
          onClick={() => navigate('/play/duels')}
          className="flex items-center gap-1 text-sm text-muted-foreground mb-3"
        >
          <ArrowLeft className="h-4 w-4" /> Exit duel
        </button>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Swords className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
              Duel vs {otherName}
            </span>
          </div>
          <span className="text-[11px] font-bold text-muted-foreground">
            {step + 1} / {polls.length}
          </span>
        </div>

        <div className="flex gap-1 mb-5">
          {polls.map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-1 rounded-full ${
                i < step ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        <h2 className="text-xl font-bold text-foreground mb-4 leading-tight">
          {current.question}
        </h2>

        <div className="grid grid-cols-2 gap-3">
          {(['A', 'B'] as const).map((side) => {
            const label = side === 'A' ? current.option_a : current.option_b;
            const img = side === 'A' ? current.image_a_url : current.image_b_url;
            return (
              <button
                key={side}
                onClick={() => submitChoice(side)}
                disabled={submitting}
                className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-muted disabled:opacity-60 active:scale-[0.98] transition-transform"
              >
                <PollOptionImage
                  imageUrl={img}
                  option={label}
                  question={current.question}
                  side={side}
                  variant="hero"
                  className="w-full h-full"
                />
                <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
                  <p className="text-white text-sm font-bold leading-tight">{label}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <Sparkles className="h-3 w-3" />
          Your votes still count toward the public results.
        </div>
      </div>
    </AppLayout>
  );
}
