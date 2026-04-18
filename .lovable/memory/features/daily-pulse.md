---
name: Daily Pulse system
description: Morning Pulse, Evening Verdict, and Versa Daily stories row — cached daily aggregates, admin-controlled, with 9pm push trigger
type: feature
---

The Daily Pulse system delivers three connected daily content moments:

- **Morning Pulse** (auto-opens 6–11am local time, once/day): full-screen story sequence with The Big Result, Closest Battle, Surprise (Predict the Crowd gap), Your Standing (signed-in), and Today's First Battle.
- **Evening Verdict** (auto-opens 8pm–midnight local, once/day; also push-triggered at 9pm Cairo): single recap screen with The Winner / Battle / Surprise / Your Day.
- **Pulse Stories Row** (always on Home, above Hero card): IG-style circles for Egypt Today (with admin pin support), Cairo, user's top 4 categories (DEFAULT_CATEGORIES for new users), Updates (real per-poll diff: flagged when user is losing by ≥10pts or majority flipped, min 20 votes), and Friends (with friend names).

Cache: `daily_pulse` table, one row per `(slot, pulse_date)` (UNIQUE). Built by `build-daily-pulse` edge function on cron at 6am and 8pm Cairo. Production thresholds: ranked ≥20 votes, closest battle ≥100, surprise predictions ≥50 actual + ≥10 predict + ≥15% gap.

Admin pin: `daily_pulse.pinned_poll_id` overrides Egypt Today's first card on next rebuild. Set via Admin → Pulse tab.

Settings table: `pulse_settings` (single row). Toggles: `stories_row_enabled`, `morning_pulse_enabled`, `evening_verdict_enabled`, `egypt_today_enabled`, `cairo_enabled`. Managed via Admin → Pulse tab.

Push: `evening-verdict-push` edge function runs daily at 18:00 UTC (21:00 Cairo) via cron, sends "🔥 The day's verdict is in" to all subscribers (skips if `evening_verdict_enabled = false`).

Local-time gating + shared content: each user sees Pulse during their own 6–11am / 8pm–midnight window, but content is the global cached row (most recent). Tracked per-user per-day via localStorage key `pulse:seen:{topic}:{date}`.

Analytics: `story_views` table tracks `cards_viewed`, `vote_taps`, `share_taps`, `completed` per user/topic/date.
