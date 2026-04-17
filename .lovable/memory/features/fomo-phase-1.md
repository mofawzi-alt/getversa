---
name: FOMO Phase 1 (visual urgency on home)
description: Live countdowns (red <1h, pulse <10m), live voter count strip, auto Trending badge (>100 votes/2h), Closing Soon horizontal scroll (<6h), First Voter badge (first 10 voters)
type: feature
---

## Components
- `src/components/poll/CountdownTimer.tsx` — live ticker. Red <1h, pulses <10m. Tick rate adapts (1s/30s/60s).
- `src/components/poll/TrendingBadge.tsx` — orange→red gradient flame chip. Auto-shown when poll qualifies.
- `src/components/poll/FirstVoterBadge.tsx` — amber→yellow chip for first 10 voters.
- `src/components/home/LiveVoterCount.tsx` — "X people voted in the last hour" below hero. Hidden when count < 5.
- `src/components/home/ClosingSoonStrip.tsx` — horizontal scroll, 180px cards, soonest expiry first.

## Hooks
- `src/hooks/useTrendingPolls.ts` — returns Set of poll IDs with ≥100 votes in last 2h. Refetch every 2 min.
- `src/hooks/useLiveVoterCount.ts` — total votes in last hour. Refetch every 60s.
- `src/hooks/useFirstVoterStatus.ts` — single + bulk variants for first-10-voter detection.

## Wiring (Home.tsx)
- `closingSoonPolls` computed in same memo as `livePolls` (filtered to live polls with ends_at <6h, sorted soonest, capped 12).
- `useTrendingPolls(livePollIds)` runs once and result is passed as `isTrending` prop into each `HomeLiveDebateCard`.
- `<LiveVoterCount />` renders directly under the HeroVoteCard.
- `<ClosingSoonStrip />` renders between Live activity strip and Live Debates section. Filters out already-voted polls.
- `HomeLiveDebateCard` static `getTimeLeft()` text replaced with live `<CountdownTimer>`.

## HeroVoteCard
- HeroPoll interface gained `ends_at?: string | null`.
- Countdown rendered next to "X battles left today" pill above the card.

## Cinematic Results
- `useFirstVoterStatus` called when overlay visible; badge revealed at step >= 6 alongside pattern line.
