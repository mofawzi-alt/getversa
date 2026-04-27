// Auto-generates editorial stories from real poll data.
// Routes: ?type=generation_gap | city_divide | brand_intel | trend_alert
// Or no param = run whichever generators are due today.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const MIN_REAL_VOTES_GLOBAL = 15;
const MIN_PER_AGE_GROUP = 20;
const MIN_PER_CITY = 15;
const MIN_BRAND_TOTAL = 50;
const MIN_TREND_PER_PERIOD = 30;

type PollRow = {
  id: string; question: string; option_a: string; option_b: string;
  image_a_url: string | null; image_b_url: string | null; category: string | null;
};

async function fetchActivePolls(daysBack: number): Promise<PollRow[]> {
  const since = new Date(Date.now() - daysBack * 86400000).toISOString();
  // Polls that received any votes in the window
  const { data: voteRows } = await sb
    .from('votes').select('poll_id').gte('created_at', since).limit(20000);
  const pollIds = Array.from(new Set((voteRows || []).map((v: any) => v.poll_id)));
  if (!pollIds.length) return [];
  const { data: polls } = await sb
    .from('polls')
    .select('id, question, option_a, option_b, image_a_url, image_b_url, category')
    .in('id', pollIds);
  return (polls || []) as PollRow[];
}

async function fetchVotesForPolls(pollIds: string[], daysBack: number) {
  const since = new Date(Date.now() - daysBack * 86400000).toISOString();
  const all: any[] = [];
  // Page through to handle 1000-row limit
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await sb
      .from('votes')
      .select('poll_id, choice, voter_age_range, voter_city, created_at')
      .in('poll_id', pollIds)
      .gte('created_at', since)
      .range(from, from + PAGE - 1);
    if (error) break;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

function isYoung(age: string | null) { return age === '18-24'; }
function isOld(age: string | null) {
  return age === '35-44' || age === '45-54' || age === '55+' || age === '35+';
}
function pct(part: number, total: number) { return total > 0 ? Math.round((part / total) * 100) : 0; }

// ─── Generation Gap ───
async function generateGenerationGap() {
  const polls = await fetchActivePolls(7);
  if (!polls.length) return { skipped: 'no_polls' };
  const votes = await fetchVotesForPolls(polls.map(p => p.id), 7);

  type Stat = { youngA: number; youngB: number; oldA: number; oldB: number; total: number };
  const stats = new Map<string, Stat>();
  for (const v of votes) {
    const s = stats.get(v.poll_id) || { youngA: 0, youngB: 0, oldA: 0, oldB: 0, total: 0 };
    s.total++;
    if (isYoung(v.voter_age_range)) v.choice === 'A' ? s.youngA++ : s.youngB++;
    else if (isOld(v.voter_age_range)) v.choice === 'A' ? s.oldA++ : s.oldB++;
    stats.set(v.poll_id, s);
  }

  let best: { poll: PollRow; gap: number; youngPctA: number; oldPctA: number; total: number } | null = null;
  for (const p of polls) {
    const s = stats.get(p.id);
    if (!s) continue;
    const youngTotal = s.youngA + s.youngB;
    const oldTotal = s.oldA + s.oldB;
    if (youngTotal < MIN_PER_AGE_GROUP || oldTotal < MIN_PER_AGE_GROUP) continue;
    if (s.total < MIN_REAL_VOTES_GLOBAL) continue;
    const youngPctA = pct(s.youngA, youngTotal);
    const oldPctA = pct(s.oldA, oldTotal);
    const gap = Math.abs(youngPctA - oldPctA);
    if (!best || gap > best.gap) best = { poll: p, gap, youngPctA, oldPctA, total: s.total };
  }

  if (!best) return { skipped: 'threshold_not_met' };

  const youngWinner = best.youngPctA >= 50 ? best.poll.option_a : best.poll.option_b;
  const oldWinner = best.oldPctA >= 50 ? best.poll.option_a : best.poll.option_b;
  const youngPct = Math.max(best.youngPctA, 100 - best.youngPctA);
  const oldPct = Math.max(best.oldPctA, 100 - best.oldPctA);
  const aTotal = Math.round((best.total * (best.youngPctA + best.oldPctA)) / 200);
  const aGlobalPct = pct(aTotal, best.total);

  const cards = {
    hook: {
      headline: `${best.poll.option_a} or ${best.poll.option_b}? Egypt's generations disagree.`,
      bigStat: `${best.gap}%`,
      subtext: 'separates Gen Z from 35+ on this',
    },
    data: {
      question: best.poll.question,
      option_a: best.poll.option_a, option_b: best.poll.option_b,
      pct_a: aGlobalPct, pct_b: 100 - aGlobalPct,
      total_votes: best.total,
      image_a_url: best.poll.image_a_url, image_b_url: best.poll.image_b_url,
      demographic_split: {
        label: `${best.poll.option_a} preference by age`,
        a_value: 'Gen Z 18-24', a_pct: best.youngPctA,
        b_value: '35 and older', b_pct: best.oldPctA,
      },
    },
    insight: {
      emoji: '⚡',
      text: `Egyptian Gen Z chose ${youngWinner} at ${youngPct}% while Egyptians over 35 went ${oldWinner} at ${oldPct}%. A ${best.gap}% divide that reflects how differently these two generations see ${best.poll.category || 'this'}.`,
      basedOnVotes: best.total,
    },
    connection: {
      text: `This generation gap on ${best.poll.category || 'similar questions'} keeps showing up in Egyptian Versa data — younger voters consistently lean ${youngWinner}.`,
      sourceName: null, sourceUrl: null, trend: null,
    },
    action: { ctaLabel: 'Vote now' },
  };

  await upsert('generation_gap', cards.hook.headline, cards, best.poll.id, best.poll.id, best.total, hoursFromNow(24));
  return { ok: true, gap: best.gap };
}

// ─── City Divide ───
async function generateCityDivide() {
  const polls = await fetchActivePolls(7);
  if (!polls.length) return { skipped: 'no_polls' };
  const votes = await fetchVotesForPolls(polls.map(p => p.id), 7);

  type Stat = { cairoA: number; cairoB: number; alexA: number; alexB: number; otherA: number; otherB: number; total: number };
  const stats = new Map<string, Stat>();
  for (const v of votes) {
    const s = stats.get(v.poll_id) || { cairoA: 0, cairoB: 0, alexA: 0, alexB: 0, otherA: 0, otherB: 0, total: 0 };
    s.total++;
    const c = (v.voter_city || '').toLowerCase();
    if (c === 'cairo') v.choice === 'A' ? s.cairoA++ : s.cairoB++;
    else if (c === 'alexandria') v.choice === 'A' ? s.alexA++ : s.alexB++;
    else if (c) v.choice === 'A' ? s.otherA++ : s.otherB++;
    stats.set(v.poll_id, s);
  }

  let best: { poll: PollRow; gap: number; cairoPctA: number; alexPctA: number; total: number } | null = null;
  for (const p of polls) {
    const s = stats.get(p.id);
    if (!s) continue;
    const cT = s.cairoA + s.cairoB, aT = s.alexA + s.alexB;
    if (cT < MIN_PER_CITY || aT < MIN_PER_CITY) continue;
    if (s.total < MIN_REAL_VOTES_GLOBAL) continue;
    const cairoPctA = pct(s.cairoA, cT);
    const alexPctA = pct(s.alexA, aT);
    const gap = Math.abs(cairoPctA - alexPctA);
    if (!best || gap > best.gap) best = { poll: p, gap, cairoPctA, alexPctA, total: s.total };
  }
  if (!best) return { skipped: 'threshold_not_met' };

  const cairoChoice = best.cairoPctA >= 50 ? best.poll.option_a : best.poll.option_b;
  const alexChoice = best.alexPctA >= 50 ? best.poll.option_a : best.poll.option_b;
  const cairoPct = Math.max(best.cairoPctA, 100 - best.cairoPctA);
  const alexPct = Math.max(best.alexPctA, 100 - best.alexPctA);

  const cards = {
    hook: {
      headline: 'Cairo and Alexandria chose differently.',
      bigStat: `${best.gap}%`,
      subtext: "separates Egypt's two biggest cities on this",
    },
    data: {
      question: best.poll.question,
      option_a: best.poll.option_a, option_b: best.poll.option_b,
      pct_a: best.cairoPctA, pct_b: 100 - best.cairoPctA,
      total_votes: best.total,
      image_a_url: best.poll.image_a_url, image_b_url: best.poll.image_b_url,
      demographic_split: {
        label: `${best.poll.option_a} preference by city`,
        a_value: 'Cairo', a_pct: best.cairoPctA,
        b_value: 'Alexandria', b_pct: best.alexPctA,
      },
    },
    insight: {
      emoji: '🏙',
      text: `Cairo went ${cairoChoice} at ${cairoPct}% while Alexandria chose ${alexChoice} at ${alexPct}%. A ${best.gap}% gap between Egypt's two biggest cities on ${best.poll.category || 'this question'}.`,
      basedOnVotes: best.total,
    },
    connection: {
      text: `Cairo and Alexandria continue to vote with distinct preferences on ${best.poll.category || 'major questions'} — the geographic divide is real.`,
      sourceName: null, sourceUrl: null, trend: null,
    },
    action: { ctaLabel: 'Vote now' },
  };

  await upsert('city_divide', cards.hook.headline, cards, best.poll.id, best.poll.id, best.total, hoursFromNow(24));
  return { ok: true, gap: best.gap };
}

// ─── Brand Intel (weekly Mondays) ───
async function generateBrandIntel() {
  const polls = await fetchActivePolls(7);
  // Restrict to brand-tagged polls
  const brandPolls = polls.filter(p => (p.category || '').toLowerCase().includes('brand'));
  if (!brandPolls.length) return { skipped: 'no_brand_polls' };
  const votes = await fetchVotesForPolls(brandPolls.map(p => p.id), 7);
  const counts = new Map<string, number>();
  for (const v of votes) counts.set(v.poll_id, (counts.get(v.poll_id) || 0) + 1);
  const top = brandPolls
    .map(p => ({ poll: p, total: counts.get(p.id) || 0 }))
    .filter(x => x.total >= MIN_BRAND_TOTAL)
    .sort((a, b) => b.total - a.total)[0];
  if (!top) return { skipped: 'threshold_not_met' };

  const pollVotes = votes.filter(v => v.poll_id === top.poll.id);
  let aCount = 0;
  for (const v of pollVotes) if (v.choice === 'A') aCount++;
  const pctA = pct(aCount, pollVotes.length);
  const winner = pctA >= 50 ? top.poll.option_a : top.poll.option_b;

  // Best demographic split: pick city with strongest tilt
  const cityStats = new Map<string, { a: number; total: number }>();
  for (const v of pollVotes) {
    const c = v.voter_city || 'unknown';
    const s = cityStats.get(c) || { a: 0, total: 0 };
    s.total++; if (v.choice === 'A') s.a++;
    cityStats.set(c, s);
  }
  const cityArr = [...cityStats.entries()]
    .filter(([c, s]) => c !== 'unknown' && s.total >= 10)
    .map(([c, s]) => ({ city: c, pctA: pct(s.a, s.total), total: s.total }))
    .sort((a, b) => Math.abs(b.pctA - pctA) - Math.abs(a.pctA - pctA));
  const topCity = cityArr[0];

  const cards = {
    hook: {
      headline: `${top.poll.option_a} vs ${top.poll.option_b}: Egypt picked.`,
      bigStat: `${Math.max(pctA, 100 - pctA)}%`,
      subtext: `chose ${winner} this week`,
    },
    data: {
      question: top.poll.question,
      option_a: top.poll.option_a, option_b: top.poll.option_b,
      pct_a: pctA, pct_b: 100 - pctA,
      total_votes: top.total,
      image_a_url: top.poll.image_a_url, image_b_url: top.poll.image_b_url,
      demographic_split: topCity ? {
        label: `${top.poll.option_a} preference by city`,
        a_value: topCity.city, a_pct: topCity.pctA,
        b_value: 'National', b_pct: pctA,
      } : undefined,
    },
    insight: {
      emoji: '📊',
      text: `${winner} took the week with ${Math.max(pctA, 100 - pctA)}% of ${top.total.toLocaleString()} votes${topCity ? `. The biggest local outlier was ${topCity.city} at ${topCity.pctA}% for ${top.poll.option_a}.` : '.'} A clear commercial signal for ${top.poll.category || 'the brand category'}.`,
      basedOnVotes: top.total,
    },
    connection: {
      text: `Versa's brand battles are now drawing ${top.total.toLocaleString()}+ weekly votes per matchup — a real-time read on Egyptian consumer preference.`,
      sourceName: null, sourceUrl: null, trend: null,
    },
    action: { ctaLabel: 'Vote now' },
  };

  await upsert('brand_intel', cards.hook.headline, cards, top.poll.id, top.poll.id, top.total, hoursFromNow(7 * 24));
  return { ok: true, total: top.total };
}

// ─── Trend Alert (monthly) ───
async function generateTrendAlert() {
  // Compare last 30d vs prior 30d
  const polls = await fetchActivePolls(60);
  if (!polls.length) return { skipped: 'no_polls' };
  const votes = await fetchVotesForPolls(polls.map(p => p.id), 60);
  const cutoff = new Date(Date.now() - 30 * 86400000).getTime();

  type Stat = { recentA: number; recentTotal: number; oldA: number; oldTotal: number };
  const stats = new Map<string, Stat>();
  for (const v of votes) {
    const s = stats.get(v.poll_id) || { recentA: 0, recentTotal: 0, oldA: 0, oldTotal: 0 };
    const t = new Date(v.created_at).getTime();
    if (t >= cutoff) { s.recentTotal++; if (v.choice === 'A') s.recentA++; }
    else { s.oldTotal++; if (v.choice === 'A') s.oldA++; }
    stats.set(v.poll_id, s);
  }

  let best: { poll: PollRow; oldPct: number; newPct: number; shift: number; total: number } | null = null;
  for (const p of polls) {
    const s = stats.get(p.id);
    if (!s) continue;
    if (s.recentTotal < MIN_TREND_PER_PERIOD || s.oldTotal < MIN_TREND_PER_PERIOD) continue;
    const oldPct = pct(s.oldA, s.oldTotal);
    const newPct = pct(s.recentA, s.recentTotal);
    const shift = Math.abs(newPct - oldPct);
    if (!best || shift > best.shift) best = { poll: p, oldPct, newPct, shift, total: s.recentTotal + s.oldTotal };
  }
  if (!best) return { skipped: 'threshold_not_met' };

  const direction = best.newPct > best.oldPct ? 'up' : 'down';
  const winnerNow = best.newPct >= 50 ? best.poll.option_a : best.poll.option_b;

  const cards = {
    hook: {
      headline: 'Egypt changed its mind.',
      bigStat: `${best.shift}%`,
      subtext: `shift on ${best.poll.option_a} in 30 days`,
    },
    data: {
      question: best.poll.question,
      option_a: best.poll.option_a, option_b: best.poll.option_b,
      pct_a: best.newPct, pct_b: 100 - best.newPct,
      total_votes: best.total,
      image_a_url: best.poll.image_a_url, image_b_url: best.poll.image_b_url,
      demographic_split: {
        label: `${best.poll.option_a} preference over time`,
        a_value: '30 days ago', a_pct: best.oldPct,
        b_value: 'Today', b_pct: best.newPct,
      },
    },
    insight: {
      emoji: '📈',
      text: `${best.oldPct}% of Egyptians chose ${best.poll.option_a} last month. Today that number is ${best.newPct}%. A ${direction === 'up' ? 'rise' : 'drop'} of ${best.shift}% in 30 days. Right now ${winnerNow} leads.`,
      basedOnVotes: best.total,
    },
    connection: {
      text: `Egyptian preferences on ${best.poll.category || 'this question'} are shifting fast — a ${best.shift}% swing in just 30 days.`,
      sourceName: null, sourceUrl: null,
      trend: { from_pct: best.oldPct, to_pct: best.newPct, label: `${best.poll.option_a} preference, 30d → today` },
    },
    action: { ctaLabel: 'Vote now' },
  };

  await upsert('trend_alert', cards.hook.headline, cards, best.poll.id, best.poll.id, best.total, hoursFromNow(7 * 24));
  return { ok: true, shift: best.shift };
}

async function upsert(
  storyType: string, headline: string, cards: any,
  pollId: string, ctaPollId: string, totalVotes: number, expiresAt: string,
) {
  // Expire any existing active auto story of this type first
  await sb.from('editorial_stories')
    .update({ status: 'expired' })
    .eq('story_type', storyType).eq('source', 'auto').eq('status', 'published');

  await sb.rpc('upsert_auto_editorial_story', {
    p_story_type: storyType,
    p_headline: headline,
    p_cards: cards,
    p_poll_id: pollId,
    p_cta_poll_id: ctaPollId,
    p_total_real_votes: totalVotes,
    p_expires_at: expiresAt,
  });
}

function hoursFromNow(h: number) {
  return new Date(Date.now() + h * 3600 * 1000).toISOString();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get('type');
    const cairoNow = new Date(Date.now() + 2 * 3600 * 1000); // ~Cairo (UTC+2/3)
    const day = cairoNow.getUTCDay(); // 0 Sun .. 6 Sat
    const date = cairoNow.getUTCDate();

    const results: Record<string, any> = {};

    if (!type || type === 'generation_gap') results.generation_gap = await generateGenerationGap();
    if (!type || type === 'city_divide') results.city_divide = await generateCityDivide();
    if (type === 'brand_intel' || (!type && day === 1)) results.brand_intel = await generateBrandIntel();
    if (type === 'trend_alert' || (!type && date === 1)) results.trend_alert = await generateTrendAlert();

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('generate-editorial-stories error', e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
