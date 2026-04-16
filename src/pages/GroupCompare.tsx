import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFriends, Friend } from '@/hooks/useFriends';
import {
  ArrowLeft, Users, Loader2, Trophy, Sparkles, Check,
  UserPlus, X, BarChart3, Swords, Share2,
} from 'lucide-react';
import { toast } from 'sonner';

type Mode = 'battle' | 'vibe';

interface VoteRow {
  user_id: string;
  poll_id: string;
  choice: string;
  category: string | null;
}

interface PollLite {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  category: string | null;
}

export default function GroupCompare() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { friends, loadingFriends } = useFriends();

  const [mode, setMode] = useState<Mode>('battle');
  const [groupA, setGroupA] = useState<string[]>([]);
  const [groupB, setGroupB] = useState<string[]>([]);
  const [vibeGroup, setVibeGroup] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);

  // Build friend lookup
  const friendMap = useMemo(() => {
    const m = new Map<string, Friend>();
    friends.forEach((f) => m.set(f.friend_id, f));
    return m;
  }, [friends]);

  const allUserIds = useMemo(() => {
    const set = new Set<string>();
    if (mode === 'battle') {
      groupA.forEach((id) => set.add(id));
      groupB.forEach((id) => set.add(id));
    } else {
      vibeGroup.forEach((id) => set.add(id));
    }
    return Array.from(set);
  }, [mode, groupA, groupB, vibeGroup]);

  // Fetch all votes for selected users (only when results are requested)
  const { data: voteData, isLoading: loadingVotes } = useQuery({
    queryKey: ['group-compare-votes', allUserIds.sort().join(',')],
    queryFn: async () => {
      if (allUserIds.length === 0) return { votes: [] as VoteRow[], polls: new Map<string, PollLite>() };
      const { data: votes, error } = await supabase
        .from('votes')
        .select('user_id, poll_id, choice, category')
        .in('user_id', allUserIds);
      if (error) throw error;

      const pollIds = Array.from(new Set((votes || []).map((v) => v.poll_id)));
      const pollMap = new Map<string, PollLite>();
      if (pollIds.length > 0) {
        const { data: polls } = await supabase
          .from('polls')
          .select('id, question, option_a, option_b, category')
          .in('id', pollIds);
        (polls || []).forEach((p) => pollMap.set(p.id, p as PollLite));
      }
      return { votes: (votes || []) as VoteRow[], polls: pollMap };
    },
    enabled: showResults && allUserIds.length > 0,
  });

  // ────── Math: alignment within a group + group vs group ──────
  const stats = useMemo(() => {
    if (!voteData) return null;
    const { votes, polls } = voteData;

    // Index votes by poll → userId → choice
    const byPoll = new Map<string, Map<string, string>>();
    votes.forEach((v) => {
      if (!byPoll.has(v.poll_id)) byPoll.set(v.poll_id, new Map());
      byPoll.get(v.poll_id)!.set(v.user_id, v.choice);
    });

    function groupAlignment(ids: string[]) {
      if (ids.length < 2) return { alignmentPct: 100, sharedPolls: 0 };
      let aligned = 0;
      let shared = 0;
      byPoll.forEach((userChoices) => {
        const choicesInGroup = ids
          .map((id) => userChoices.get(id))
          .filter(Boolean) as string[];
        if (choicesInGroup.length >= 2) {
          shared++;
          // % of group that picked the most-popular choice in this poll
          const counts: Record<string, number> = {};
          choicesInGroup.forEach((c) => (counts[c] = (counts[c] || 0) + 1));
          const top = Math.max(...Object.values(counts));
          if (top === choicesInGroup.length) aligned++;
        }
      });
      const pct = shared === 0 ? 0 : Math.round((aligned / shared) * 100);
      return { alignmentPct: pct, sharedPolls: shared };
    }

    function groupConsensusChoice(ids: string[], pollId: string): string | null {
      const userChoices = byPoll.get(pollId);
      if (!userChoices) return null;
      const choicesInGroup = ids
        .map((id) => userChoices.get(id))
        .filter(Boolean) as string[];
      if (choicesInGroup.length === 0) return null;
      const counts: Record<string, number> = {};
      choicesInGroup.forEach((c) => (counts[c] = (counts[c] || 0) + 1));
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      // Only return when majority is clear (> 50%)
      if (sorted[0][1] / choicesInGroup.length > 0.5) return sorted[0][0];
      return null;
    }

    if (mode === 'vibe') {
      const v = groupAlignment(vibeGroup);
      // Top categories where vibeGroup agrees
      const catAgreement: Record<string, { agreed: number; total: number }> = {};
      byPoll.forEach((userChoices, pollId) => {
        const poll = polls.get(pollId);
        const cat = poll?.category || 'Other';
        const choicesInGroup = vibeGroup
          .map((id) => userChoices.get(id))
          .filter(Boolean) as string[];
        if (choicesInGroup.length >= 2) {
          if (!catAgreement[cat]) catAgreement[cat] = { agreed: 0, total: 0 };
          catAgreement[cat].total++;
          const counts: Record<string, number> = {};
          choicesInGroup.forEach((c) => (counts[c] = (counts[c] || 0) + 1));
          if (Math.max(...Object.values(counts)) === choicesInGroup.length) {
            catAgreement[cat].agreed++;
          }
        }
      });
      const catList = Object.entries(catAgreement)
        .filter(([, d]) => d.total >= 2)
        .map(([cat, d]) => ({ cat, pct: Math.round((d.agreed / d.total) * 100), total: d.total }))
        .sort((a, b) => b.pct - a.pct);

      return { mode: 'vibe' as const, alignmentPct: v.alignmentPct, sharedPolls: v.sharedPolls, catList };
    }

    // BATTLE mode
    const a = groupAlignment(groupA);
    const b = groupAlignment(groupB);

    const agreements: { poll: PollLite; choice: string }[] = [];
    const disagreements: { poll: PollLite; aChoice: string; bChoice: string }[] = [];

    byPoll.forEach((_, pollId) => {
      const poll = polls.get(pollId);
      if (!poll) return;
      const aChoice = groupConsensusChoice(groupA, pollId);
      const bChoice = groupConsensusChoice(groupB, pollId);
      if (!aChoice || !bChoice) return;
      if (aChoice === bChoice) {
        agreements.push({ poll, choice: aChoice });
      } else {
        disagreements.push({ poll, aChoice, bChoice });
      }
    });

    // Cross-group alignment: % of shared polls where consensus matches
    const crossShared = agreements.length + disagreements.length;
    const crossAlign = crossShared === 0 ? 0 : Math.round((agreements.length / crossShared) * 100);

    return {
      mode: 'battle' as const,
      a,
      b,
      crossAlign,
      crossShared,
      agreements: agreements.slice(0, 5),
      disagreements: disagreements.slice(0, 5),
    };
  }, [voteData, mode, groupA, groupB, vibeGroup]);

  // ────── Helpers for picker UI ──────
  function toggleInGroup(id: string, group: 'A' | 'B' | 'vibe') {
    if (group === 'A') {
      setGroupA((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
      setGroupB((prev) => prev.filter((x) => x !== id));
    } else if (group === 'B') {
      setGroupB((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
      setGroupA((prev) => prev.filter((x) => x !== id));
    } else {
      setVibeGroup((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    }
  }

  function getGroupOf(id: string): 'A' | 'B' | 'vibe' | null {
    if (groupA.includes(id)) return 'A';
    if (groupB.includes(id)) return 'B';
    if (vibeGroup.includes(id)) return 'vibe';
    return null;
  }

  function canRunBattle() {
    return groupA.length >= 1 && groupB.length >= 1;
  }

  function canRunVibe() {
    return vibeGroup.length >= 2;
  }

  function handleRun() {
    if (mode === 'battle' && !canRunBattle()) {
      toast.error('Pick at least 1 friend in each group');
      return;
    }
    if (mode === 'vibe' && !canRunVibe()) {
      toast.error('Pick at least 2 friends for the crew vibe');
      return;
    }
    setShowResults(true);
  }

  function reset() {
    setShowResults(false);
    setGroupA([]);
    setGroupB([]);
    setVibeGroup([]);
  }

  // ────── Render ──────
  if (loadingFriends) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (friends.length < 2) {
    return (
      <AppLayout>
        <div className="p-4 space-y-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="glass rounded-3xl p-8 text-center space-y-3">
            <Users className="h-10 w-10 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-display font-bold">Add more friends first</h2>
            <p className="text-sm text-muted-foreground">
              You need at least 2 friends to compare crews.
            </p>
            <Button onClick={() => navigate('/friends')} className="rounded-full">
              Find friends
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 space-y-4 animate-slide-up pb-24">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-display font-bold truncate">Crew Compare</h1>
            <p className="text-xs text-muted-foreground">
              Compare two groups, or vibe-check one crew
            </p>
          </div>
        </div>

        {!showResults ? (
          <>
            {/* Mode tabs */}
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="battle" className="gap-1.5">
                  <Swords className="h-3.5 w-3.5" /> Group vs Group
                </TabsTrigger>
                <TabsTrigger value="vibe" className="gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Crew Vibe
                </TabsTrigger>
              </TabsList>

              {/* Battle picker */}
              <TabsContent value="battle" className="space-y-3 mt-4">
                <p className="text-xs text-muted-foreground">
                  Tap a friend to add them to <b>A</b>. Tap again to move to <b>B</b>. Third tap removes.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <GroupSummary label="Group A" color="primary" ids={groupA} friendMap={friendMap} />
                  <GroupSummary label="Group B" color="accent" ids={groupB} friendMap={friendMap} />
                </div>
                <FriendPickerList
                  friends={friends}
                  onTap={(id) => {
                    const cur = getGroupOf(id);
                    if (cur === null) toggleInGroup(id, 'A');
                    else if (cur === 'A') toggleInGroup(id, 'B');
                    else toggleInGroup(id, 'B'); // removes from B
                  }}
                  badgeFor={(id) => {
                    const g = getGroupOf(id);
                    if (g === 'A') return 'A';
                    if (g === 'B') return 'B';
                    return null;
                  }}
                />
              </TabsContent>

              {/* Vibe picker */}
              <TabsContent value="vibe" className="space-y-3 mt-4">
                <p className="text-xs text-muted-foreground">
                  Pick 2+ friends to see how aligned your crew really is.
                </p>
                <GroupSummary label="Your Crew" color="primary" ids={vibeGroup} friendMap={friendMap} />
                <FriendPickerList
                  friends={friends}
                  onTap={(id) => toggleInGroup(id, 'vibe')}
                  badgeFor={(id) => (vibeGroup.includes(id) ? '✓' : null)}
                />
              </TabsContent>
            </Tabs>

            {/* Run button */}
            <div className="fixed bottom-20 left-0 right-0 px-4 pointer-events-none">
              <Button
                onClick={handleRun}
                disabled={mode === 'battle' ? !canRunBattle() : !canRunVibe()}
                className="w-full rounded-full pointer-events-auto shadow-lg gap-2 h-12"
              >
                <BarChart3 className="h-4 w-4" />
                {mode === 'battle' ? 'Run battle' : 'Reveal crew vibe'}
              </Button>
            </div>
          </>
        ) : (
          <ResultsView
            stats={stats}
            loading={loadingVotes}
            onReset={reset}
            friendMap={friendMap}
            groupA={groupA}
            groupB={groupB}
            vibeGroup={vibeGroup}
          />
        )}
      </div>
    </AppLayout>
  );
}

// ────── Subcomponents ──────

function GroupSummary({
  label,
  color,
  ids,
  friendMap,
}: {
  label: string;
  color: 'primary' | 'accent';
  ids: string[];
  friendMap: Map<string, Friend>;
}) {
  const tone = color === 'primary' ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-accent/10 border-accent/30 text-accent-foreground';
  return (
    <div className={`rounded-2xl border p-3 ${tone}`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] font-bold uppercase tracking-wide">{label}</p>
        <span className="text-[11px] font-semibold">{ids.length}</span>
      </div>
      <p className="text-[11px] truncate text-foreground/80">
        {ids.length === 0
          ? 'No one yet'
          : ids
              .map((id) => friendMap.get(id)?.friend_username || '?')
              .join(', ')}
      </p>
    </div>
  );
}

function FriendPickerList({
  friends,
  onTap,
  badgeFor,
}: {
  friends: Friend[];
  onTap: (id: string) => void;
  badgeFor: (id: string) => string | null;
}) {
  return (
    <div className="space-y-1.5">
      {friends.map((f) => {
        const badge = badgeFor(f.friend_id);
        return (
          <button
            key={f.friend_id}
            onClick={() => onTap(f.friend_id)}
            className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all text-left ${
              badge ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'
            }`}
          >
            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
              {(f.friend_username || '?').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate text-sm">{f.friend_username || 'Unknown'}</p>
              <p className="text-[11px] text-muted-foreground">
                {f.compatibility_score ?? 0}% match with you
              </p>
            </div>
            {badge && (
              <span className="min-w-[28px] h-7 px-2 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ResultsView({
  stats,
  loading,
  onReset,
  friendMap,
  groupA,
  groupB,
  vibeGroup,
}: {
  stats: any;
  loading: boolean;
  onReset: () => void;
  friendMap: Map<string, Friend>;
  groupA: string[];
  groupB: string[];
  vibeGroup: string[];
}) {
  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const namesOf = (ids: string[]) =>
    ids.map((id) => friendMap.get(id)?.friend_username || '?').join(', ');

  if (stats.mode === 'vibe') {
    return (
      <div className="space-y-4">
        <button onClick={onReset} className="text-xs text-muted-foreground underline">
          ← Pick a different crew
        </button>

        <div className="glass rounded-3xl p-6 text-center space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Your Crew</p>
          <p className="text-sm font-semibold">{namesOf(vibeGroup)}</p>
          <div className="text-5xl font-display font-bold text-primary mt-2">
            {stats.alignmentPct}%
          </div>
          <p className="text-sm text-muted-foreground">
            aligned across {stats.sharedPolls} shared polls
          </p>
          <p className="text-xs text-foreground/70 italic mt-1">
            {stats.alignmentPct >= 70
              ? '🔥 Tight crew — you really get each other.'
              : stats.alignmentPct >= 40
              ? '⚖️ Mixed bag — you agree on some things, debate the rest.'
              : '🌪️ Chaos crew — wildly different tastes.'}
          </p>
        </div>

        {stats.catList.length > 0 && (
          <div className="glass rounded-3xl p-4 space-y-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-bold">
              Where you agree most
            </p>
            {stats.catList.slice(0, 6).map((c: any) => (
              <div key={c.cat} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium">{c.cat}</span>
                  <span className="text-muted-foreground">{c.pct}%</span>
                </div>
                <Progress value={c.pct} className="h-1.5" />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Battle mode
  const winner =
    stats.a.alignmentPct === stats.b.alignmentPct
      ? null
      : stats.a.alignmentPct > stats.b.alignmentPct
      ? 'A'
      : 'B';

  return (
    <div className="space-y-4">
      <button onClick={onReset} className="text-xs text-muted-foreground underline">
        ← Pick different groups
      </button>

      {/* Showdown */}
      <div className="glass rounded-3xl p-5 space-y-4">
        <div className="text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Cross-crew alignment</p>
          <div className="text-5xl font-display font-bold text-primary mt-1">
            {stats.crossAlign}%
          </div>
          <p className="text-xs text-muted-foreground">on {stats.crossShared} polls both crews voted on</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <CrewCard
            label="Group A"
            names={namesOf(groupA)}
            alignment={stats.a.alignmentPct}
            shared={stats.a.sharedPolls}
            isWinner={winner === 'A'}
          />
          <CrewCard
            label="Group B"
            names={namesOf(groupB)}
            alignment={stats.b.alignmentPct}
            shared={stats.b.sharedPolls}
            isWinner={winner === 'B'}
          />
        </div>
      </div>

      {/* Disagreements (more interesting first) */}
      {stats.disagreements.length > 0 && (
        <div className="glass rounded-3xl p-4 space-y-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-bold flex items-center gap-1">
            <Swords className="h-3 w-3" /> Where the crews split
          </p>
          {stats.disagreements.map((d: any) => (
            <div key={d.poll.id} className="border border-border rounded-2xl p-3 text-sm">
              <p className="font-semibold mb-1.5 line-clamp-2">{d.poll.question}</p>
              <div className="flex gap-2 text-xs">
                <span className="flex-1 px-2 py-1 rounded-full bg-primary/10 text-primary font-medium truncate">
                  A: {d.aChoice === 'A' ? d.poll.option_a : d.poll.option_b}
                </span>
                <span className="flex-1 px-2 py-1 rounded-full bg-accent/20 font-medium truncate">
                  B: {d.bChoice === 'A' ? d.poll.option_a : d.poll.option_b}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Agreements */}
      {stats.agreements.length > 0 && (
        <div className="glass rounded-3xl p-4 space-y-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-bold flex items-center gap-1">
            <Check className="h-3 w-3" /> Where both crews agree
          </p>
          {stats.agreements.map((a: any) => (
            <div key={a.poll.id} className="border border-border rounded-2xl p-3 text-sm">
              <p className="font-semibold mb-1 line-clamp-2">{a.poll.question}</p>
              <p className="text-xs text-primary font-medium">
                Both picked: {a.choice === 'A' ? a.poll.option_a : a.poll.option_b}
              </p>
            </div>
          ))}
        </div>
      )}

      {stats.crossShared === 0 && (
        <div className="glass rounded-3xl p-6 text-center text-sm text-muted-foreground">
          These two crews haven't voted on enough of the same polls yet. Keep voting!
        </div>
      )}
    </div>
  );
}

function CrewCard({
  label,
  names,
  alignment,
  shared,
  isWinner,
}: {
  label: string;
  names: string;
  alignment: number;
  shared: number;
  isWinner: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-3 border ${
        isWinner ? 'border-primary bg-primary/5' : 'border-border'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] font-bold uppercase tracking-wide">{label}</p>
        {isWinner && <Trophy className="h-3.5 w-3.5 text-primary" />}
      </div>
      <p className="text-[10px] text-muted-foreground truncate mb-2">{names}</p>
      <div className="text-2xl font-display font-bold">{alignment}%</div>
      <p className="text-[10px] text-muted-foreground">aligned · {shared} polls</p>
    </div>
  );
}
