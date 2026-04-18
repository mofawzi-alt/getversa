// Builds the daily_pulse cache row for a given slot (morning|evening).
// Triggered by cron at 6am Cairo (morning) and 8pm Cairo (evening),
// or by an admin POST { slot: 'morning' } to rebuild on demand.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function cairoDateString(d = new Date()): string {
  // YYYY-MM-DD in Africa/Cairo (no DST since 2014)
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return fmt.format(d);
}

type PollLite = {
  id: string; question: string; option_a: string; option_b: string;
  image_a_url: string | null; image_b_url: string | null;
  category: string | null; poll_type: string;
};

type VoteLite = { poll_id: string; choice: string; voter_city: string | null };

async function fetchActivePolls(supabase: any): Promise<Map<string, PollLite>> {
  const { data } = await supabase
    .from('polls')
    .select('id, question, option_a, option_b, image_a_url, image_b_url, category, poll_type')
    .eq('is_active', true);
  const map = new Map<string, PollLite>();
  (data || []).forEach((p: PollLite) => map.set(p.id, p));
  return map;
}

async function fetchRecentVotes(supabase: any, sinceISO: string): Promise<VoteLite[]> {
  // Page through votes since cutoff (limit 1000 default)
  const all: VoteLite[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('votes')
      .select('poll_id, choice, voter_city')
      .gte('created_at', sinceISO)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as VoteLite[]));
    if (data.length < PAGE) break;
    from += PAGE;
    if (from > 50000) break; // safety
  }
  return all;
}

type Tally = { a: number; b: number; total: number; cairo_a: number; cairo_b: number; cairo_total: number };

function tallyVotes(votes: VoteLite[]): Map<string, Tally> {
  const m = new Map<string, Tally>();
  for (const v of votes) {
    const t = m.get(v.poll_id) || { a: 0, b: 0, total: 0, cairo_a: 0, cairo_b: 0, cairo_total: 0 };
    if (v.choice === 'A') t.a++; else if (v.choice === 'B') t.b++; else continue;
    t.total++;
    const isCairo = (v.voter_city || '').toLowerCase().includes('cairo');
    if (isCairo) {
      if (v.choice === 'A') t.cairo_a++; else t.cairo_b++;
      t.cairo_total++;
    }
    m.set(v.poll_id, t);
  }
  return m;
}

function pollCard(poll: PollLite, t: Tally) {
  const pctA = t.total ? Math.round((t.a / t.total) * 100) : 0;
  const pctB = 100 - pctA;
  const winner = pctA >= pctB ? 'A' : 'B';
  return {
    poll_id: poll.id,
    question: poll.question,
    option_a: poll.option_a,
    option_b: poll.option_b,
    image_a_url: poll.image_a_url,
    image_b_url: poll.image_b_url,
    category: poll.category,
    pct_a: pctA,
    pct_b: pctB,
    total_votes: t.total,
    winner,
    winning_option: winner === 'A' ? poll.option_a : poll.option_b,
    winning_pct: Math.max(pctA, pctB),
    winning_image: winner === 'A' ? poll.image_a_url : poll.image_b_url,
  };
}

async function fetchSurprise(supabase: any, sinceISO: string, polls: Map<string, PollLite>, tallies: Map<string, Tally>) {
  // Predict the Crowd surprise: compare predictions vs actual majority for poll_type = 'predict'
  const { data: preds } = await supabase
    .from('predictions')
    .select('poll_id, predicted_choice')
    .gte('created_at', sinceISO);
  if (!preds || preds.length === 0) return null;

  const predTally = new Map<string, { a: number; b: number; total: number }>();
  for (const p of preds as any[]) {
    const t = predTally.get(p.poll_id) || { a: 0, b: 0, total: 0 };
    if (p.predicted_choice === 'A') t.a++; else if (p.predicted_choice === 'B') t.b++; else continue;
    t.total++;
    predTally.set(p.poll_id, t);
  }

  let best: { poll: PollLite; t: Tally; predA: number; actualA: number; gap: number } | null = null;
  for (const [pid, pt] of predTally) {
    const poll = polls.get(pid);
    const at = tallies.get(pid);
    if (!poll || !at || at.total < 50 || pt.total < 10) continue;
    const predA = Math.round((pt.a / pt.total) * 100);
    const actualA = Math.round((at.a / at.total) * 100);
    const gap = Math.abs(predA - actualA);
    if (!best || gap > best.gap) best = { poll, t: at, predA, actualA, gap };
  }
  if (!best || best.gap < 15) return null;
  const card = pollCard(best.poll, best.t);
  return { ...card, predicted_a: best.predA, predicted_b: 100 - best.predA, gap: best.gap };
}

async function buildSlot(supabase: any, slot: 'morning' | 'evening') {
  const pulseDate = cairoDateString();
  const sinceISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const polls = await fetchActivePolls(supabase);
  const votes = await fetchRecentVotes(supabase, sinceISO);
  const tallies = tallyVotes(votes);

  // Filter to polls with meaningful volume
  const ranked = Array.from(tallies.entries())
    .filter(([pid, t]) => polls.has(pid) && t.total >= 3)
    .map(([pid, t]) => ({ poll: polls.get(pid)!, t }))
    .filter((x) => x.poll.poll_type !== 'predict'); // surprise handled separately

  // Big Result: most votes overall
  const bigSorted = [...ranked].sort((a, b) => b.t.total - a.t.total);
  const bigResult = bigSorted[0] ? pollCard(bigSorted[0].poll, bigSorted[0].t) : null;

  // Closest Battle: closest to 50/50, min 100 votes
  const closeRanked = ranked
    .filter((x) => x.t.total >= 100)
    .map((x) => ({ ...x, dist: Math.abs((x.t.a / x.t.total) - 0.5) }))
    .sort((a, b) => a.dist - b.dist);
  const closestBattle = closeRanked[0] ? pollCard(closeRanked[0].poll, closeRanked[0].t) : null;

  // Surprise from predict polls
  const surprise = await fetchSurprise(supabase, sinceISO, polls, tallies);

  // Today's First Battle: next active poll the user can vote on (just pick most recent active)
  const { data: nextPoll } = await supabase
    .from('polls')
    .select('id, question, option_a, option_b, image_a_url, image_b_url, category, poll_type')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1);
  const todayFirst = nextPoll?.[0] || null;

  // Egypt Today: top 3 by total votes (different polls). If admin pinned a poll, place it first.
  let egyptToday = bigSorted.slice(0, 3).map(({ poll, t }) => pollCard(poll, t));

  // Cairo: top 3 filtered to Cairo voters
  const cairoSorted = ranked
    .filter((x) => x.t.cairo_total >= 10)
    .map((x) => ({ poll: x.poll, t: { ...x.t, a: x.t.cairo_a, b: x.t.cairo_b, total: x.t.cairo_total } }))
    .sort((a, b) => b.t.total - a.t.total)
    .slice(0, 3);
  const cairo = cairoSorted.map(({ poll, t }) => pollCard(poll, t));

  // By category: top result per category
  const byCategory: Record<string, any> = {};
  for (const { poll, t } of bigSorted) {
    const cat = (poll.category || '').toLowerCase();
    if (!cat) continue;
    if (!byCategory[cat]) byCategory[cat] = pollCard(poll, t);
  }

  // Preserve existing pinned_poll_id if present
  const { data: existing } = await supabase
    .from('daily_pulse')
    .select('pinned_poll_id')
    .eq('slot', slot)
    .eq('pulse_date', pulseDate)
    .maybeSingle();

  // If admin pinned a poll, prepend it (or fetch its data if missing from rankings)
  const pinnedId = existing?.pinned_poll_id;
  if (pinnedId) {
    const pinnedPoll = polls.get(pinnedId);
    const pinnedTally = tallies.get(pinnedId) || { a: 0, b: 0, total: 0, cairo_a: 0, cairo_b: 0, cairo_total: 0 };
    if (pinnedPoll) {
      const pinnedCard = pollCard(pinnedPoll, pinnedTally);
      egyptToday = [pinnedCard, ...egyptToday.filter((c) => c.poll_id !== pinnedId)].slice(0, 3);
    }
  }

  const cards = {
    big_result: bigResult,
    closest_battle: closestBattle,
    surprise,
    today_first: todayFirst,
  };

  const { error } = await supabase
    .from('daily_pulse')
    .upsert(
      {
        slot,
        pulse_date: pulseDate,
        cards,
        egypt_today: egyptToday,
        cairo,
        by_category: byCategory,
        pinned_poll_id: existing?.pinned_poll_id || null,
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'slot,pulse_date' }
    );
  if (error) throw error;

  return { slot, pulseDate, counts: { polls: polls.size, votes: votes.length, ranked: ranked.length } };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    let slot: 'morning' | 'evening' = 'morning';

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body?.slot === 'evening') slot = 'evening';
      } catch (_) { /* default morning */ }
    } else {
      // GET: infer from Cairo hour
      const cairoHour = parseInt(
        new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', hour: '2-digit', hour12: false }).format(new Date()),
        10
      );
      slot = cairoHour >= 18 ? 'evening' : 'morning';
    }

    const result = await buildSlot(supabase, slot);
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('build-daily-pulse error', e);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
