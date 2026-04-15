---
name: Personality Type System
description: 16 hybrid personality types (custom Versa names + MBTI codes) derived from 4 voting axes, requiring 30 votes minimum
type: feature
---
The personality type system maps voting trait tags to 4 binary axes (E/I, S/N, T/F, J/P) producing 16 types.
Each type has a custom Versa name (e.g. 'The Maverick'), emoji, MBTI code (e.g. ENTP), description, and strengths.
Requires 30 votes minimum. Displayed on own Profile, public UserProfile, and Taste Profile pages.
The PersonalityTypeCard component is expandable to show axis bars and reasoning.
The ShareableTasteCard includes personality code + name when available.
Engine lives in src/lib/personalityType.ts, component in src/components/profile/PersonalityTypeCard.tsx.
Type changes dynamically as user votes more.
