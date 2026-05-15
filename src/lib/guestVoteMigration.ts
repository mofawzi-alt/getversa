// Migrates anonymous "guest" votes captured in localStorage into the real
// `votes` table the first time a user authenticates. This prevents the feed
// from re-serving the same polls that were already answered while signed out.

import { supabase } from '@/integrations/supabase/client';

const GUEST_VOTE_DATA_KEY = 'versa_guest_votes_data'; // [{ pollId, choice, category? }]
const GUEST_VOTED_IDS_KEY = 'versa_guest_voted_polls'; // string[] (legacy + dedup)
const GUEST_VOTE_COUNT_KEY = 'versa_guest_votes';
const MIGRATION_DONE_KEY = 'versa_guest_votes_migrated';

export type GuestVoteRecord = {
  pollId: string;
  choice: 'A' | 'B';
  category?: string | null;
};

export function recordGuestVote(rec: GuestVoteRecord) {
  try {
    const raw = localStorage.getItem(GUEST_VOTE_DATA_KEY);
    const list: GuestVoteRecord[] = raw ? JSON.parse(raw) : [];
    if (!list.some(v => v.pollId === rec.pollId)) {
      list.push(rec);
      localStorage.setItem(GUEST_VOTE_DATA_KEY, JSON.stringify(list));
    }
  } catch {}
}

export async function migrateGuestVotesToUser(
  userId: string,
  profile?: {
    gender?: string | null;
    age_range?: string | null;
    country?: string | null;
    city?: string | null;
  } | null
): Promise<number> {
  try {
    if (localStorage.getItem(MIGRATION_DONE_KEY) === '1') return 0;

    let records: GuestVoteRecord[] = [];
    try {
      const raw = localStorage.getItem(GUEST_VOTE_DATA_KEY);
      if (raw) records = JSON.parse(raw);
    } catch {}

    // Backfill from legacy id-only list so those polls are at least filtered out.
    let legacyIds: string[] = [];
    try {
      const raw = localStorage.getItem(GUEST_VOTED_IDS_KEY);
      if (raw) legacyIds = JSON.parse(raw);
    } catch {}

    if (records.length === 0 && legacyIds.length === 0) {
      localStorage.setItem(MIGRATION_DONE_KEY, '1');
      return 0;
    }

    // Skip polls the user already voted on (e.g. signed in on another device).
    const { data: existing } = await supabase
      .from('votes')
      .select('poll_id')
      .eq('user_id', userId);
    const existingIds = new Set((existing || []).map(v => v.poll_id));

    const payloads = records
      .filter(r => !existingIds.has(r.pollId))
      .map(r => ({
        poll_id: r.pollId,
        user_id: userId,
        choice: r.choice,
        ...(r.category ? { category: r.category } : {}),
        ...(profile?.gender ? { voter_gender: profile.gender } : {}),
        ...(profile?.age_range ? { voter_age_range: profile.age_range } : {}),
        ...(profile?.country ? { voter_country: profile.country } : {}),
        ...(profile?.city ? { voter_city: profile.city } : {}),
      }));

    let inserted = 0;
    if (payloads.length > 0) {
      // Insert one-by-one so a single bad row doesn't drop the whole batch
      // (e.g. poll deactivated, RLS edge case). Ignore unique-conflict (23505).
      for (const p of payloads) {
        const { error } = await supabase.from('votes').insert(p as any);
        if (!error || error.code === '23505') inserted += 1;
      }
    }

    localStorage.setItem(MIGRATION_DONE_KEY, '1');
    try { localStorage.removeItem(GUEST_VOTE_DATA_KEY); } catch {}
    try { localStorage.removeItem(GUEST_VOTED_IDS_KEY); } catch {}
    try { localStorage.removeItem(GUEST_VOTE_COUNT_KEY); } catch {}
    return inserted;
  } catch {
    return 0;
  }
}
