---
name: Personality Type System
description: 16 hybrid personality archetypes (custom Versa names only — MBTI codes hidden) with 3-line data-driven summaries from voting traits
type: feature
---
The personality system maps voting trait tags to 4 binary axes producing 16 archetypes (e.g. 'The Maverick', 'The Architect').
**MBTI four-letter codes are hidden everywhere in the UI — only the archetype name + emoji are shown.**
The descriptive text under each archetype is generated dynamically by `getDataDrivenSummary(traits, voteCount)` in `src/lib/personalityType.ts`.
Requires 30 votes minimum. Rendered on the Profile page (primary), public UserProfile, and Taste Profile.

**Axis calibration rule:** every tag must appear on EXACTLY ONE axis. Double-counting (e.g. `growth`/`experience` on both N/S and J/P) caused 80% of users to collapse to ENFP "The Spark". J pole was previously starved (only 5 brand-loyalty tags); it now also pulls from `traditional`/`safe_asset`/`structured`/`authentic`. `practical`/`convenience` moved from S→T to balance the high-volume `health`+`indulgent` F tags. `health` moved to S (lifestyle-grounded). Verify distribution with the simulation query in tag-distribution audits — no single type should exceed ~25% of users.
