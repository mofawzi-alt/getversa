// Scans active polls every 6 hours and inserts the most interesting demographic
// findings into `breakdown_findings` (status=pending). Admins moderate before
// findings are visible to users in the Pulse "Breakdown" circle.
//
// Findings:
// 1. gender_split  — biggest male/female disagreement (>=15pt)
// 2. age_gap       — 18-24 vs 35+ disagreement (>=15pt)
// 3. city_war      — Cairo vs Alexandria (>=15pt)
// 4. dominant_demo — any demo (gender/age/city) where one option got >=75%
// Min 20 votes per poll, 10 per demo segment, 8 per city (lowered for early-stage data).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MIN_POLL_VOTES = 20;
const MIN_DEMO_VOTES = 10;
const MIN_CITY_VOTES = 8;
const MIN_GAP_PCT = 15;
const DOMINANCE_PCT = 75;
const SCAN_LOOKBACK_DAYS = 14;

type VoteRow = {
  poll_id: string;
  choice: string;
  voter_gender: string | null;
  voter_age_range: string | null;
  voter_city: string | null;
};

type Poll = {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  image_a_url: string | null;
  image_b_url: string | null;
  category: string | null;
};

function pct(n: number, total: number) {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

function tally(votes: VoteRow[]) {
  let a = 0, b = 0;
  for (const v of votes) {
    if (v.choice === 'A') a++;
    else if (v.choice === 'B') b++;
  }
  return { a, b, total: a + b };
}

function genderHeadline(winner: 'women' | 'men', winnerOption: string, winPct: number, oppPct: number) {
  const opp = winner === 'women' ? 'men' : 'women';
  if (Math.abs(winPct - oppPct) >= 30) {
    return winner === 'women'
      ? `Women went hard for ${winnerOption} 👑`
      : `Men overwhelmingly chose ${winnerOption} 💪`;
  }
  return `The gender split on this one is wild 👀`;
}

function ageHeadline(youngWin: string, oldWin: string) {
  if (youngWin === oldWin) return `Gen Z and 35+ actually agree on this`;
  return `Gen Z disagrees with Egypt 🔥`;
}

function cityHeadline() {
  return `Cairo vs Alexandria — they disagree again 👀`;
}

function dominantHeadline(demo: string, label: string, winnerOption: string, p: number) {
  const lower = demo.toLowerCase();
  if (lower === 'gender') {
    return label === 'female' ? `Women have spoken — ${p}% chose ${winnerOption} 👑`
      : `Men are united — ${p}% chose ${winnerOption} 💪`;
  }
  if (lower === 'age') {
    if (label === '18-24') return `Gen Z made their choice — ${p}% picked ${winnerOption} 🔥`;
    return `${label} is unanimous — ${p}% chose ${winnerOption}`;
  }
  return `${label} is unanimous — ${p}% chose ${winnerOption}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const since = new Date(Date.now() - SCAN_LOOKBACK_DAYS * 86400 * 1000).toISOString();

    // 1) Pull all votes from active polls in lookback window
    const { data: rawVotes, error: vErr } = await supabase
      .from('votes')
      .select('poll_id, choice, voter_gender, voter_age_range, voter_city')
      .gte('created_at', since)
      .limit(50000);
    if (vErr) throw vErr;

    // Group by poll
    const byPoll = new Map<string, VoteRow[]>();
    for (const v of (rawVotes || []) as VoteRow[]) {
      const arr = byPoll.get(v.poll_id) || [];
      arr.push(v);
      byPoll.set(v.poll_id, arr);
    }

    // Filter to polls meeting min vote threshold
    const eligibleIds = [...byPoll.entries()]
      .filter(([, vs]) => vs.length >= MIN_POLL_VOTES)
      .map(([id]) => id);
    if (!eligibleIds.length) {
      return new Response(JSON.stringify({ ok: true, reason: 'no_eligible_polls', findings: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: polls } = await supabase
      .from('polls')
      .select('id, question, option_a, option_b, image_a_url, image_b_url, category')
      .in('id', eligibleIds)
      .eq('is_active', true);
    const pollMap = new Map<string, Poll>((polls || []).map((p: any) => [p.id, p]));

    // Compute candidate findings, score, then keep best per type.
    type Candidate = {
      finding_type: 'gender_split' | 'age_gap' | 'city_war' | 'dominant_demo';
      poll_id: string;
      headline: string;
      detail: any;
      total_votes: number;
      score: number; // higher = more interesting
    };
    const candidates: Candidate[] = [];

    for (const pollId of eligibleIds) {
      const poll = pollMap.get(pollId);
      if (!poll) continue;
      const votes = byPoll.get(pollId)!;
      const overall = tally(votes);
      const overallPctA = pct(overall.a, overall.total);

      // ── 1) Gender split
      const female = votes.filter(v => v.voter_gender === 'female');
      const male = votes.filter(v => v.voter_gender === 'male');
      if (female.length >= MIN_DEMO_VOTES && male.length >= MIN_DEMO_VOTES) {
        const f = tally(female);
        const m = tally(male);
        const fPctA = pct(f.a, f.total);
        const mPctA = pct(m.a, m.total);
        const gap = Math.abs(fPctA - mPctA);
        if (gap >= MIN_GAP_PCT) {
          // Identify which gender went against majority
          const womenAgainst = (overallPctA >= 50) !== (fPctA >= 50);
          const winner = womenAgainst ? 'women' : (mPctA >= 50) !== (overallPctA >= 50) ? 'men' : (fPctA >= mPctA ? 'women' : 'men');
          const winnerOption = winner === 'women'
            ? (fPctA >= 50 ? poll.option_a : poll.option_b)
            : (mPctA >= 50 ? poll.option_a : poll.option_b);
          const winnerPct = winner === 'women' ? Math.max(fPctA, 100 - fPctA) : Math.max(mPctA, 100 - mPctA);
          const oppPct = winner === 'women' ? Math.max(mPctA, 100 - mPctA) : Math.max(fPctA, 100 - fPctA);
          candidates.push({
            finding_type: 'gender_split',
            poll_id: pollId,
            headline: genderHeadline(winner as 'women' | 'men', winnerOption, winnerPct, oppPct),
            total_votes: overall.total,
            score: gap + Math.log10(overall.total),
            detail: {
              poll: {
                id: poll.id, question: poll.question, option_a: poll.option_a, option_b: poll.option_b,
                image_a_url: poll.image_a_url, image_b_url: poll.image_b_url,
              },
              overall: { pct_a: overallPctA, pct_b: 100 - overallPctA, total: overall.total },
              female: { pct_a: fPctA, pct_b: 100 - fPctA, total: f.total },
              male: { pct_a: mPctA, pct_b: 100 - mPctA, total: m.total },
              gap_pct: gap,
            },
          });
        }
      }

      // ── 2) Age gap (18-24 vs 35+)
      const young = votes.filter(v => v.voter_age_range === '18-24');
      const old = votes.filter(v => {
        const a = v.voter_age_range || '';
        return a === '35-44' || a === '45-54' || a === '55-64' || a === '65+';
      });
      if (young.length >= MIN_DEMO_VOTES && old.length >= MIN_DEMO_VOTES) {
        const y = tally(young);
        const o = tally(old);
        const yPctA = pct(y.a, y.total);
        const oPctA = pct(o.a, o.total);
        const gap = Math.abs(yPctA - oPctA);
        if (gap >= MIN_GAP_PCT) {
          const youngWin = yPctA >= 50 ? poll.option_a : poll.option_b;
          const oldWin = oPctA >= 50 ? poll.option_a : poll.option_b;
          candidates.push({
            finding_type: 'age_gap',
            poll_id: pollId,
            headline: ageHeadline(youngWin, oldWin),
            total_votes: overall.total,
            score: gap + Math.log10(overall.total),
            detail: {
              poll: {
                id: poll.id, question: poll.question, option_a: poll.option_a, option_b: poll.option_b,
                image_a_url: poll.image_a_url, image_b_url: poll.image_b_url,
              },
              young: { pct_a: yPctA, pct_b: 100 - yPctA, total: y.total, label: '18-24' },
              old: { pct_a: oPctA, pct_b: 100 - oPctA, total: o.total, label: '35+' },
              gap_pct: gap,
            },
          });
        }
      }

      // ── 3) City war (Cairo vs Alexandria — case-insensitive)
      const cityNorm = (c: string | null) => (c || '').trim().toLowerCase();
      const cairo = votes.filter(v => cityNorm(v.voter_city) === 'cairo');
      const alex = votes.filter(v => {
        const c = cityNorm(v.voter_city);
        return c === 'alexandria' || c === 'alex';
      });
      if (cairo.length >= MIN_CITY_VOTES && alex.length >= MIN_CITY_VOTES) {
        const c = tally(cairo);
        const a = tally(alex);
        const cPctA = pct(c.a, c.total);
        const aPctA = pct(a.a, a.total);
        const gap = Math.abs(cPctA - aPctA);
        if (gap >= MIN_GAP_PCT) {
          candidates.push({
            finding_type: 'city_war',
            poll_id: pollId,
            headline: cityHeadline(),
            total_votes: overall.total,
            score: gap + Math.log10(overall.total),
            detail: {
              poll: {
                id: poll.id, question: poll.question, option_a: poll.option_a, option_b: poll.option_b,
                image_a_url: poll.image_a_url, image_b_url: poll.image_b_url,
              },
              cairo: { pct_a: cPctA, pct_b: 100 - cPctA, total: c.total },
              alexandria: { pct_a: aPctA, pct_b: 100 - aPctA, total: a.total },
              gap_pct: gap,
            },
          });
        }
      }

      // ── 4) Dominant demographic (>=75% in any segment)
      const segments: Array<{ demo: string; label: string; subset: VoteRow[]; min: number }> = [
        { demo: 'gender', label: 'female', subset: female, min: MIN_DEMO_VOTES },
        { demo: 'gender', label: 'male', subset: male, min: MIN_DEMO_VOTES },
        { demo: 'age', label: '18-24', subset: young, min: MIN_DEMO_VOTES },
        { demo: 'age', label: '35+', subset: old, min: MIN_DEMO_VOTES },
        { demo: 'city', label: 'Cairo', subset: cairo, min: MIN_CITY_VOTES },
        { demo: 'city', label: 'Alexandria', subset: alex, min: MIN_CITY_VOTES },
      ];
      for (const s of segments) {
        if (s.subset.length < s.min) continue;
        const t = tally(s.subset);
        const pa = pct(t.a, t.total);
        const winnerPct = Math.max(pa, 100 - pa);
        if (winnerPct >= DOMINANCE_PCT) {
          const winnerOption = pa >= 50 ? poll.option_a : poll.option_b;
          candidates.push({
            finding_type: 'dominant_demo',
            poll_id: pollId,
            headline: dominantHeadline(s.demo, s.label, winnerOption, winnerPct),
            total_votes: overall.total,
            score: winnerPct + Math.log10(overall.total),
            detail: {
              poll: {
                id: poll.id, question: poll.question, option_a: poll.option_a, option_b: poll.option_b,
                image_a_url: poll.image_a_url, image_b_url: poll.image_b_url,
              },
              demo_type: s.demo,
              demo_label: s.label,
              segment: { pct_a: pa, pct_b: 100 - pa, total: t.total, winner_pct: winnerPct, winner_option: winnerOption },
              overall: { pct_a: overallPctA, pct_b: 100 - overallPctA, total: overall.total },
            },
          });
        }
      }
    }

    // Pick best candidate per type (1 each = up to 4 findings per scan)
    const bestByType = new Map<string, Candidate>();
    for (const c of candidates) {
      const cur = bestByType.get(c.finding_type);
      if (!cur || c.score > cur.score) bestByType.set(c.finding_type, c);
    }
    const winners = [...bestByType.values()];

    if (!winners.length) {
      return new Response(JSON.stringify({ ok: true, reason: 'no_findings', candidates: candidates.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert as pending
    const scanRunId = crypto.randomUUID();
    const rows = winners.map(w => ({
      scan_run_id: scanRunId,
      finding_type: w.finding_type,
      poll_id: w.poll_id,
      headline: w.headline,
      detail: w.detail,
      total_votes: w.total_votes,
      status: 'pending' as const,
    }));
    const { error: insErr } = await supabase.from('breakdown_findings').insert(rows);
    if (insErr) throw insErr;

    // Notify all admins so they can approve before findings go stale
    try {
      const { data: admins } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');
      const adminIds = (admins || []).map((a: any) => a.user_id);
      if (adminIds.length > 0) {
        await supabase.functions.invoke('send-push-notification', {
          body: {
            title: '📊 Breakdown findings ready',
            body: `${rows.length} new demographic finding${rows.length === 1 ? '' : 's'} need${rows.length === 1 ? 's' : ''} review`,
            url: '/admin?tab=pulse',
            user_ids: adminIds,
            notification_type: 'admin_breakdown_review',
          },
        });
      }
    } catch (notifyErr) {
      console.error('admin notify failed (non-fatal)', notifyErr);
    }

    return new Response(
      JSON.stringify({ ok: true, scan_run_id: scanRunId, findings: rows.length, candidates: candidates.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    console.error('scan-breakdown failed', e);
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'unknown' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
