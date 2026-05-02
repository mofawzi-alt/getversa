// Data hooks for the new Pulse Stories circles.
// Each hook returns the raw data needed by PulseStoriesRow to assemble StoryCardData[].
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { localDateKey } from '@/lib/pulseTime';

const LAST_VISIT_KEY = 'versa_last_pulse_visit';

/** Returns ISO timestamp of the user's previous visit (before this session). */
export function useLastVisit() {
  const [lastVisit, setLastVisit] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prev = localStorage.getItem(LAST_VISIT_KEY);
    setLastVisit(prev);
    // Update for next time, on a delay so this session's queries can read the old value
    const t = setTimeout(() => {
      try { localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString()); } catch {}
    }, 2000);
    return () => clearTimeout(t);
  }, []);
  return lastVisit;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) Battle of the Day — auto-pick poll with highest vote velocity in last 24h
// ─────────────────────────────────────────────────────────────────────────────
export function useBattleOfTheDay() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['pulse-battle-of-day', localDateKey()],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data: votes } = await supabase
        .from('votes')
        .select('poll_id, choice')
        .gte('created_at', since)
        .limit(5000);
      if (!votes?.length) return null;
      const tally = new Map<string, { a: number; b: number; total: number }>();
      for (const v of votes as any[]) {
        const t = tally.get(v.poll_id) || { a: 0, b: 0, total: 0 };
        if (v.choice === 'A') t.a++;
        else if (v.choice === 'B') t.b++;
        else continue;
        t.total++;
        tally.set(v.poll_id, t);
      }
      const top = [...tally.entries()].sort((a, b) => b[1].total - a[1].total)[0];
      if (!top || top[1].total < 5) return null;
      const [pollId, t] = top;
      const { data: poll } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, image_a_url, image_b_url, category')
        .eq('id', pollId)
        .eq('is_active', true)
        .maybeSingle();
      if (!poll) return null;

      // Has the current user voted on this?
      let userVoted = false;
      if (user) {
        const { data: myVote } = await supabase
          .from('votes')
          .select('id')
          .eq('user_id', user.id)
          .eq('poll_id', pollId)
          .maybeSingle();
        userVoted = !!myVote;
      }
      return { poll, tally: t, userVoted };
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) Friends Activity — votes by friends in last 24h, grouped per friend
// ─────────────────────────────────────────────────────────────────────────────
export function useFriendsActivity() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['pulse-friends-activity', user?.id, localDateKey()],
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
      if (!friendIds.length) return [];
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data: votes } = await supabase
        .from('votes')
        .select('user_id, poll_id, choice, created_at')
        .in('user_id', friendIds)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(40);
      if (!votes?.length) return [];

      const userIds = Array.from(new Set(votes.map((v: any) => v.user_id)));
      const pollIds = Array.from(new Set(votes.map((v: any) => v.poll_id)));
      const [{ data: profiles }, { data: polls }] = await Promise.all([
        supabase.from('users').select('id, name, avatar_url').in('id', userIds),
        supabase
          .from('polls')
          .select('id, question, option_a, option_b, image_a_url, image_b_url, category')
          .in('id', pollIds),
      ]);
      const nameMap = new Map((profiles || []).map((p: any) => [p.id, p.name || 'Friend']));
      const pollMap = new Map((polls || []).map((p: any) => [p.id, p]));
      // One card per friend (their most recent vote)
      const seen = new Set<string>();
      const cards: any[] = [];
      for (const v of votes as any[]) {
        if (seen.has(v.user_id)) continue;
        const poll = pollMap.get(v.poll_id);
        if (!poll) continue;
        seen.add(v.user_id);
        cards.push({
          friendName: nameMap.get(v.user_id) || 'Friend',
          choice: v.choice,
          poll,
        });
      }
      return cards.slice(0, 8);
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) Your Categories — top 2 user categories, today's most-voted poll in each
// ─────────────────────────────────────────────────────────────────────────────
const FALLBACK_CATEGORIES = ['Brands', 'Food & Drinks', 'Entertainment', 'Fintech & Money'];

export function useYourCategories() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['pulse-your-categories', user?.id, localDateKey()],
    enabled: !!user,
    queryFn: async () => {
      // Get user's top 2 categories
      const { data: myVotes } = await supabase
        .from('votes')
        .select('category')
        .eq('user_id', user!.id)
        .not('category', 'is', null)
        .order('created_at', { ascending: false })
        .limit(150);
      const counts: Record<string, number> = {};
      (myVotes || []).forEach((v: any) => {
        const c = v.category;
        if (c) counts[c] = (counts[c] || 0) + 1;
      });
      const topCats = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([c]) => c);
      const cats = topCats.length > 0 ? topCats : FALLBACK_CATEGORIES.slice(0, 2);

      // For each cat, get today's most-voted poll
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const cards: any[] = [];
      for (const cat of cats) {
        const { data: polls } = await supabase
          .from('polls')
          .select('id, question, option_a, option_b, image_a_url, image_b_url, category')
          .eq('is_active', true)
          .ilike('category', cat)
          .limit(20);
        if (!polls?.length) continue;
        const ids = polls.map((p: any) => p.id);
        const { data: votes } = await supabase
          .from('votes')
          .select('poll_id, choice')
          .in('poll_id', ids)
          .gte('created_at', since);
        const tally = new Map<string, { a: number; b: number; total: number }>();
        for (const v of (votes || []) as any[]) {
          const t = tally.get(v.poll_id) || { a: 0, b: 0, total: 0 };
          if (v.choice === 'A') t.a++;
          else if (v.choice === 'B') t.b++;
          else continue;
          t.total++;
          tally.set(v.poll_id, t);
        }
        const ranked = polls
          .map((p: any) => ({ poll: p, t: tally.get(p.id) || { a: 0, b: 0, total: 0 } }))
          .filter((x: any) => x.t.total > 0)
          .sort((a: any, b: any) => b.t.total - a.t.total);
        // Only include categories that have polls with actual votes today
        if (ranked.length === 0) continue;
        const pick = ranked[0];
        cards.push({ category: cat, poll: pick.poll, tally: pick.t });
      }
      return cards;
    },
    staleTime: 10 * 60 * 1000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) Your Polls Updated — user's votes where result shifted >10% or flipped
// ─────────────────────────────────────────────────────────────────────────────
export function useYourPollsUpdated() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['pulse-polls-updated', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
      const { data: myVotes } = await supabase
        .from('votes')
        .select('poll_id, choice, created_at')
        .eq('user_id', user!.id)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!myVotes?.length) return [];
      const pollIds = Array.from(new Set(myVotes.map((v: any) => v.poll_id)));
      const [{ data: polls }, { data: allVotes }] = await Promise.all([
        supabase
          .from('polls')
          .select('id, question, option_a, option_b, image_a_url, image_b_url')
          .in('id', pollIds),
        supabase.from('votes').select('poll_id, choice, created_at').in('poll_id', pollIds),
      ]);
      const pollMap = new Map((polls || []).map((p: any) => [p.id, p]));
      const out: any[] = [];
      for (const mv of myVotes as any[]) {
        const poll = pollMap.get(mv.poll_id);
        if (!poll) continue;
        // current tally
        let curA = 0, curB = 0;
        // tally at user's vote time
        let pastA = 0, pastB = 0;
        for (const v of (allVotes || []) as any[]) {
          if (v.poll_id !== mv.poll_id) continue;
          if (v.choice === 'A') curA++;
          else if (v.choice === 'B') curB++;
          if (new Date(v.created_at) <= new Date(mv.created_at)) {
            if (v.choice === 'A') pastA++;
            else if (v.choice === 'B') pastB++;
          }
        }
        const curTotal = curA + curB;
        const pastTotal = pastA + pastB;
        if (curTotal < 20 || pastTotal < 1) continue;
        const curPctA = Math.round((curA / curTotal) * 100);
        const pastPctA = Math.round((pastA / pastTotal) * 100);
        const userPctNow = mv.choice === 'A' ? curPctA : 100 - curPctA;
        const userPctThen = mv.choice === 'A' ? pastPctA : 100 - pastPctA;
        const delta = userPctNow - userPctThen; // can be negative
        const flipped =
          (mv.choice === 'A' && pastPctA >= 50 && curPctA < 50) ||
          (mv.choice === 'B' && pastPctA < 50 && curPctA >= 50);
        if (Math.abs(delta) < 10 && !flipped) continue;
        out.push({
          poll,
          user_choice: mv.choice,
          user_pct_now: userPctNow,
          delta,
          flipped,
          total: curTotal,
        });
        if (out.length >= 5) break;
      }
      return out;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) Predict Results — user's accuracy on Predict polls in last 7 days
// ─────────────────────────────────────────────────────────────────────────────
export function usePredictRecap() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['pulse-predict-recap', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const { data: preds } = await supabase
        .from('predictions')
        .select('poll_id, predicted_choice, is_correct, actual_majority, created_at')
        .eq('user_id', user!.id)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!preds?.length) return null;
      const total = preds.length;
      const correct = preds.filter((p: any) => p.is_correct === true).length;
      const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
      // Sample up to 3 most recent predictions for cards
      const sampleIds = preds.slice(0, 3).map((p: any) => p.poll_id);
      const { data: polls } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, image_a_url, image_b_url')
        .in('id', sampleIds);
      const pollMap = new Map((polls || []).map((p: any) => [p.id, p]));
      const samples = preds.slice(0, 3).map((p: any) => ({
        poll: pollMap.get(p.poll_id),
        predicted: p.predicted_choice,
        actual: p.actual_majority,
        correct: p.is_correct,
      })).filter((s: any) => s.poll);
      return { accuracy, correct, total, samples };
    },
    staleTime: 10 * 60 * 1000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 6) Closing Soon — unvoted polls expiring in next 6 hours
// ─────────────────────────────────────────────────────────────────────────────
export function useClosingSoon() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['pulse-closing-soon', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const now = new Date();
      const in6h = new Date(now.getTime() + 6 * 3600 * 1000);
      const { data: polls } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, image_a_url, image_b_url, category, ends_at')
        .eq('is_active', true)
        .not('ends_at', 'is', null)
        .gt('ends_at', now.toISOString())
        .lte('ends_at', in6h.toISOString())
        .order('ends_at', { ascending: true })
        .limit(15);
      if (!polls?.length) return [];
      const ids = polls.map((p: any) => p.id);
      const { data: myVotes } = await supabase
        .from('votes')
        .select('poll_id')
        .eq('user_id', user!.id)
        .in('poll_id', ids);
      const voted = new Set((myVotes || []).map((v: any) => v.poll_id));
      const unvoted = polls.filter((p: any) => !voted.has(p.id));
      if (!unvoted.length) return [];
      // Count votes for each
      const { data: voteCounts } = await supabase
        .from('votes')
        .select('poll_id')
        .in('poll_id', unvoted.map((p: any) => p.id));
      const counts = new Map<string, number>();
      (voteCounts || []).forEach((v: any) => counts.set(v.poll_id, (counts.get(v.poll_id) || 0) + 1));
      return unvoted.slice(0, 5).map((p: any) => ({
        poll: p,
        ends_at: p.ends_at,
        total: counts.get(p.id) || 0,
      }));
    },
    staleTime: 60 * 1000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 7) Weekly Verdict — Sundays only
// ─────────────────────────────────────────────────────────────────────────────
export function useWeeklyVerdict() {
  const isSunday = new Date().getDay() === 0;
  return useQuery({
    queryKey: ['pulse-weekly-verdict', localDateKey()],
    enabled: isSunday,
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const { data: votes } = await supabase
        .from('votes')
        .select('poll_id, choice')
        .gte('created_at', since)
        .limit(10000);
      if (!votes?.length) return null;
      const tally = new Map<string, { a: number; b: number; total: number }>();
      for (const v of votes as any[]) {
        const t = tally.get(v.poll_id) || { a: 0, b: 0, total: 0 };
        if (v.choice === 'A') t.a++;
        else if (v.choice === 'B') t.b++;
        else continue;
        t.total++;
        tally.set(v.poll_id, t);
      }
      const ranked = [...tally.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 10);
      const ids = ranked.map(([id]) => id);
      const { data: polls } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, image_a_url, image_b_url, category')
        .in('id', ids);
      const pollMap = new Map((polls || []).map((p: any) => [p.id, p]));

      const top5 = ranked.slice(0, 5).map(([id, t]) => {
        const poll = pollMap.get(id);
        if (!poll) return null;
        const pctA = Math.round((t.a / t.total) * 100);
        return { poll, pctA, pctB: 100 - pctA, total: t.total };
      }).filter(Boolean) as any[];

      // Most controversial: closest to 50/50 with high volume
      const controversial = ranked
        .map(([id, t]) => ({ id, t, dist: Math.abs(t.a / t.total - 0.5) }))
        .filter((x) => x.t.total >= 20)
        .sort((a, b) => a.dist - b.dist)[0];
      const controversialCard = controversial
        ? (() => {
            const poll = pollMap.get(controversial.id);
            if (!poll) return null;
            const pctA = Math.round((controversial.t.a / controversial.t.total) * 100);
            return { poll, pctA, pctB: 100 - pctA, total: controversial.t.total };
          })()
        : null;
      return { top5, controversial: controversialCard };
    },
    staleTime: 30 * 60 * 1000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 8) New This Week — polls created since user's last visit (≥5)
// ─────────────────────────────────────────────────────────────────────────────
export function useNewThisWeek(lastVisitISO: string | null) {
  return useQuery({
    queryKey: ['pulse-new-this-week', lastVisitISO],
    enabled: !!lastVisitISO,
    queryFn: async () => {
      const cutoff = lastVisitISO!;
      const { data: polls } = await supabase
        .from('polls')
        .select('id, question, option_a, option_b, image_a_url, image_b_url, category, created_at')
        .eq('is_active', true)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(20);
      return polls || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}
