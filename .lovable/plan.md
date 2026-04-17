

The user is asking conceptually how poll-based games can double as B2B data generators. This is a design/strategy answer, not yet an implementation request. But they're iterating on the Game Mode plan from earlier — so I'll frame this as a refined plan that ties game mechanics directly to B2B data outputs.

Key insight: every game vote = a real data point. The game just changes the *wrapper* (competition, social, fun) while the *payload* (preference data, demographics, decision speed) stays valuable for brands.

Let me lay out 4-5 concrete game formats and what B2B data each one uniquely produces.

# Poll Games That Generate B2B Data

The trick: every game format wraps voting in a different social/competitive mechanic, but each one **collects a different slice of B2B-valuable data**. Brands don't just want votes — they want *context*: who, with whom, how fast, under what pressure.

## 5 game formats × the B2B data they unlock

**1. Duels (1v1 Friend Challenge)**
- Mechanic: Challenge a friend → both vote on 5 polls → reveal match %
- B2B data: **Pair affinity** — do friends share brand preferences? Reveals whether brand loyalty is social-tribal or individual. Gold for influencer/word-of-mouth strategies.

**2. Squad Rooms (3–8 friends, live)**
- Mechanic: Host picks a "poll pack" → everyone votes in real-time → ranked scoreboard with badges (Trendsetter, Rebel, Twins)
- B2B data: **Group dynamics & peer pressure** — does Person A change votes when they see Person B's choice? Shows how purchase decisions form in friend groups.

**3. Predict the Crowd (solo speed game)**
- Mechanic: Don't vote your preference — vote what you think the *majority* will pick. Score = accuracy.
- B2B data: **Brand perception vs reality** — "everyone thinks Pepsi wins, but Coke actually does." Massive value for brands measuring perceived vs actual market share.

**4. Speed Round (timer mode)**
- Mechanic: 10 polls, 3 seconds each. Top score wins.
- B2B data: **Gut-instinct preference** (no deliberation = true brand recall + System 1 thinking). The holy grail for ad effectiveness measurement.

**5. Tournament Brackets (weekly)**
- Mechanic: 16 brands enter (e.g., "Best Burger Spot in Cairo") → users vote round-by-round → champion crowned Sunday
- B2B data: **Head-to-head competitive rankings** — brands see exactly who beats whom and by how much. Sellable as a "Battle Report" product.

## How the data feeds B2B (already built)

All game votes flow into the existing `votes` table → automatically powers:
- Brand Intel dashboard (admin)
- Industry Reports
- Brand Ranking Reports
- Insights Reports

**New B2B data layers games unlock:**
- `game_session_id` on votes → cluster votes by context (solo vs duel vs squad)
- `decision_time_ms` → already captured as `session_duration_ms` (gut vs deliberated)
- `social_context` (alone / with friend / in group) → measure peer influence on brand choice
- `prediction_vs_actual` → perception gap reports

## What to build first (recommended MVP)

Start with **Predict the Crowd + Duels** because:
- Both reuse existing polls (no new content needed)
- Both produce immediately sellable B2B reports (perception gap, social affinity)
- Low DB complexity — extend `poll_challenges` + add a `predictions` table
- Tournament Brackets and Squads can come in v2 once the loop is proven

## Build order (if approved)

1. Add `game_context` column to `votes` table (solo/duel/squad/predict/tournament)
2. **Predict the Crowd** mode — new `/play/predict` page + `predictions` table
3. **Duels** flow — extend `poll_challenges` with multi-poll support + inbox UI
4. New B2B report: **Perception Gap Report** in admin (predicted majority vs actual)
5. **Squads + Tournaments** in a later phase

