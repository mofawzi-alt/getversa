import { useMemo, useState, useEffect } from 'react';
import { useDailyPulse, usePulseSettings, type PulseCard } from '@/hooks/useDailyPulse';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import StoryViewer, { type StoryCardData } from './StoryViewer';
import { hasSeenLocally, localDateKey } from '@/lib/pulseTime';
import { trackStoryEvent } from '@/lib/storyAnalytics';
import { Pin } from 'lucide-react';

type CircleSpec = {
  topic: string;
  label: string;
  emoji: string;
  cards: StoryCardData[];
  hasUpdate?: boolean;
};

const DEFAULT_CATEGORIES = ['brands', 'food & drinks', 'entertainment', 'fintech & money'];
const CATEGORY_EMOJI: Record<string, string> = {
  'brands': '🏷️', 'food & drinks': '🍔', 'entertainment': '🎬',
  'fintech & money': '💸', 'sports': '⚽', 'beauty': '💄',
  'lifestyle': '✨', 'wellness & habits': '🧠', 'telecom': '📱',
  'style & design': '👗', 'business & startups': '🚀', 'relationships': '💕',
  'personality': '🧬', 'the pulse': '🔥',
};

function emojiFor(cat: string) { return CATEGORY_EMOJI[cat.toLowerCase()] || '🔥'; }

function pulseCardToStory(c: PulseCard, label: string, emoji?: string): StoryCardData {
  return {
    backgroundImage: c.winning_image || c.image_a_url || c.image_b_url,
    label,
    categoryEmoji: emoji,
    headline: c.question,
    primaryText: `${c.winning_option} wins ${c.winning_pct}%`,
    secondaryText: `${c.total_votes.toLocaleString()} votes`,
    splitA: { label: c.option_a, pct: c.pct_a },
    splitB: { label: c.option_b, pct: c.pct_b },
    votePollId: c.poll_id,
    shareable: true,
  };
}

export default function PulseStoriesRow() {
  const { user } = useAuth();
  const { data: pulse } = useDailyPulse();
  const { data: settings } = usePulseSettings();
  const [openTopic, setOpenTopic] = useState<string | null>(null);
  const [bump, setBump] = useState(0); // re-render after seen

  // User's top categories from their voting history
  const { data: userTopCats } = useQuery({
    queryKey: ['user-top-categories', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('votes')
        .select('category')
        .eq('user_id', user!.id)
        .not('category', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200);
      const counts: Record<string, number> = {};
      (data || []).forEach((v: any) => {
        const c = (v.category || '').toLowerCase();
        if (c) counts[c] = (counts[c] || 0) + 1;
      });
      return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c]) => c);
    },
    staleTime: 10 * 60 * 1000,
  });

  // Friends activity today (count of votes today by accepted friends)
  const { data: friendsActivity } = useQuery({
    queryKey: ['friends-today', user?.id, localDateKey()],
    enabled: !!user,
    queryFn: async () => {
      const { data: friendships } = await supabase
        .from('friendships')
        .select('requester_id, recipient_id')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${user!.id},recipient_id.eq.${user!.id}`);
      const friendIds = (friendships || []).map((f: any) =>
        f.requester_id === user!.id ? f.recipient_id : f.requester_id
      );
      if (friendIds.length === 0) return [];
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const { data: votes } = await supabase
        .from('votes')
        .select('user_id, poll_id, choice, created_at')
        .in('user_id', friendIds)
        .gte('created_at', startOfDay.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);
      return votes || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Updates: polls user voted on in last 14 days where current result has shifted >5%
  // since they voted (or flipped majority). We compare the user's vote choice/timing
  // vs the latest tally on that poll.
  const { data: updates } = useQuery({
    queryKey: ['user-pulse-updates', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
      const { data: myVotes } = await supabase
        .from('votes')
        .select('poll_id, choice, created_at')
        .eq('user_id', user!.id)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(40);
      if (!myVotes || myVotes.length === 0) return [];
      const pollIds = Array.from(new Set(myVotes.map((v: any) => v.poll_id)));
      const [{ data: polls }, { data: allVotes }] = await Promise.all([
        supabase.from('polls').select('id, question, option_a, option_b, image_a_url, image_b_url').in('id', pollIds),
        supabase.from('votes').select('poll_id, choice').in('poll_id', pollIds),
      ]);
      const tallies = new Map<string, { a: number; b: number; total: number }>();
      for (const v of (allVotes || []) as any[]) {
        const t = tallies.get(v.poll_id) || { a: 0, b: 0, total: 0 };
        if (v.choice === 'A') t.a++; else if (v.choice === 'B') t.b++; else continue;
        t.total++;
        tallies.set(v.poll_id, t);
      }
      const pollMap = new Map((polls || []).map((p: any) => [p.id, p]));
      // For each user vote, compute their snapshot at vote time vs now
      const snapshotByPoll = new Map<string, { a: number; b: number; total: number }>();
      const sortedAll = [...((allVotes || []) as any[])];
      // (Without created_at on the second query, approximate snapshot as 'now' minus this user's vote.)
      // We instead approximate with a simpler heuristic: shift = |currentPctA - 50|; flag if user is on losing side and total >= 20
      const out: any[] = [];
      for (const mv of myVotes as any[]) {
        const t = tallies.get(mv.poll_id);
        const p = pollMap.get(mv.poll_id);
        if (!t || !p || t.total < 20) continue;
        const pctA = Math.round((t.a / t.total) * 100);
        const pctB = 100 - pctA;
        const userPct = mv.choice === 'A' ? pctA : pctB;
        const otherPct = 100 - userPct;
        // Flag if user is losing by >10pts OR result is now closer than 55/45
        const losingByLot = otherPct - userPct >= 10;
        const flipped = (mv.choice === 'A' && pctA < 50) || (mv.choice === 'B' && pctB < 50);
        if (losingByLot || flipped) {
          out.push({
            poll_id: mv.poll_id,
            question: p.question,
            option_a: p.option_a,
            option_b: p.option_b,
            image: mv.choice === 'A' ? p.image_a_url : p.image_b_url,
            user_choice: mv.choice,
            user_pct: userPct,
            other_pct: otherPct,
            total: t.total,
            flipped,
          });
        }
        if (out.length >= 5) break;
      }
      return out;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Friends activity with friend display names
  const { data: friendsActivityNamed } = useQuery({
    queryKey: ['friends-today-named', user?.id, localDateKey()],
    enabled: !!friendsActivity && (friendsActivity?.length || 0) > 0,
    queryFn: async () => {
      const userIds = Array.from(new Set((friendsActivity || []).map((v: any) => v.user_id)));
      if (userIds.length === 0) return [];
      const { data: profiles } = await supabase
        .from('users')
        .select('id, name, avatar_url')
        .in('id', userIds);
      const nameMap = new Map((profiles || []).map((p: any) => [p.id, p.name || 'Friend']));
      // Group by friend
      const grouped = new Map<string, { name: string; count: number; latestPollId: string }>();
      for (const v of (friendsActivity || []) as any[]) {
        const key = v.user_id;
        const existing = grouped.get(key);
        if (existing) {
          existing.count++;
        } else {
          grouped.set(key, { name: nameMap.get(key) || 'Friend', count: 1, latestPollId: v.poll_id });
        }
      }
      return Array.from(grouped.values()).sort((a, b) => b.count - a.count).slice(0, 5);
    },
  });

  const circles: CircleSpec[] = useMemo(() => {
    if (!pulse) return [];
    const list: CircleSpec[] = [];

    // 1 — Egypt Today
    if (settings?.egypt_today_enabled !== false && (pulse.egypt_today?.length || 0) > 0) {
      list.push({
        topic: 'egypt_today',
        label: 'Egypt Today',
        emoji: '🇪🇬',
        cards: pulse.egypt_today.map((c, i) =>
          pulseCardToStory(c, i === 0 ? 'Egypt Today' : 'Today in Egypt', emojiFor(c.category || ''))
        ),
      });
    }

    // 2 — Cairo
    if (settings?.cairo_enabled !== false && (pulse.cairo?.length || 0) > 0) {
      list.push({
        topic: 'cairo',
        label: 'Cairo',
        emoji: '🌆',
        cards: (pulse.cairo || []).map((c) =>
          pulseCardToStory(c, 'Cairo voted', emojiFor(c.category || ''))
        ),
      });
    }

    // 3-6 — User top categories (or defaults for guests/new users)
    const cats = (userTopCats?.length ? userTopCats : DEFAULT_CATEGORIES).slice(0, 4);
    for (const cat of cats) {
      const c = pulse.by_category?.[cat];
      if (!c) continue;
      list.push({
        topic: `category:${cat}`,
        label: cat.split(' ')[0].replace(/^\w/, (s) => s.toUpperCase()),
        emoji: emojiFor(cat),
        cards: [pulseCardToStory(c, cat.toUpperCase(), emojiFor(cat))],
      });
    }

    // 7 — Updates
    if (user && hasUpdates) {
      list.push({
        topic: 'updates',
        label: 'Updates',
        emoji: '🔔',
        hasUpdate: true,
        cards: [{
          headline: 'Results have shifted on polls you voted on',
          primaryText: 'Tap to see what changed',
          label: 'Updates',
          cta: { label: 'See updates', onClick: () => { window.location.href = '/history'; } },
        }],
      });
    }

    // 8 — Friends
    if (user && (friendsActivity?.length || 0) > 0) {
      list.push({
        topic: 'friends',
        label: 'Friends',
        emoji: '👥',
        hasUpdate: true,
        cards: [{
          headline: `${friendsActivity!.length} friend votes today`,
          primaryText: 'See what they chose',
          label: 'Friends',
          cta: { label: 'Open Friends', onClick: () => { window.location.href = '/friends'; } },
        }],
      });
    }

    return list;
  }, [pulse, settings, userTopCats, friendsActivity, hasUpdates, user, bump]);

  if (settings?.stories_row_enabled === false) return null;
  if (!pulse || circles.length === 0) return null;

  const activeCircle = circles.find((c) => c.topic === openTopic);

  return (
    <>
      <div className="w-full overflow-x-auto no-scrollbar -mx-4 px-4 py-3 border-b border-border/40 bg-background">
        <div className="flex gap-3 min-w-max">
          {circles.map((circle) => {
            const seen = hasSeenLocally(circle.topic);
            const showRing = !seen || circle.hasUpdate;
            return (
              <button
                key={circle.topic}
                type="button"
                onClick={() => {
                  setOpenTopic(circle.topic);
                  trackStoryEvent(circle.topic);
                }}
                className="flex flex-col items-center gap-1 w-16 active:scale-95 transition-transform"
              >
                <div
                  className={`w-16 h-16 rounded-full p-[2px] ${
                    showRing
                      ? 'bg-gradient-to-tr from-primary via-fuchsia-500 to-amber-400'
                      : 'bg-muted'
                  }`}
                >
                  <div className={`w-full h-full rounded-full bg-background flex items-center justify-center text-2xl relative ${seen && !circle.hasUpdate ? 'opacity-60' : ''}`}>
                    {circle.topic === 'egypt_today' && pulse.pinned_poll_id && (
                      <Pin className="absolute top-1 right-1 w-3 h-3 text-primary fill-primary" />
                    )}
                    {circle.emoji}
                    {circle.hasUpdate && (
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-background" />
                    )}
                  </div>
                </div>
                <span className="text-[10px] font-medium text-foreground/80 truncate w-full text-center">
                  {circle.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <StoryViewer
        open={!!openTopic && !!activeCircle}
        onClose={() => { setOpenTopic(null); setBump((b) => b + 1); }}
        topic={openTopic || ''}
        cards={activeCircle?.cards || []}
      />
    </>
  );
}
