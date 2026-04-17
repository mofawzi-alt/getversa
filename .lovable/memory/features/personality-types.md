---
name: Personality Type System
description: 16 hybrid personality archetypes (custom Versa names only — MBTI codes hidden) with 3-line data-driven summaries from voting traits
type: feature
---
The personality system maps voting trait tags to 4 binary axes producing 16 archetypes (e.g. 'The Maverick', 'The Architect').
**MBTI four-letter codes are hidden everywhere in the UI — only the archetype name + emoji are shown.**
The descriptive text under each archetype is now generated dynamically by `getDataDrivenSummary(traits, voteCount)` in `src/lib/personalityType.ts` — three sentences referencing the user's actual top traits, percentages, and total vote count.
Requires 30 votes minimum. Rendered on the Profile page (primary), public UserProfile, and Taste Profile.
The PersonalityTypeCard component is expandable to show axis bars + reasoning. Engine in `src/lib/personalityType.ts`, card in `src/components/profile/PersonalityTypeCard.tsx`.
The Home screen no longer shows PersonalitySnapshot or PersonalWeeklySummary — both moved to Profile.
