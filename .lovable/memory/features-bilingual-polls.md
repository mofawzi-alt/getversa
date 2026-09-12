---
name: Bilingual polls (English/Arabic)
description: Polls are bilingual EN/AR with per-user language preference, RTL, and AI translation backfill
type: feature
---

Versa polls are bilingual:
- `polls` and `poll_calendar` have nullable `question_ar`, `option_a_ar`, `option_b_ar`, `subtitle_ar`. English is always present; Arabic falls back to English.
- `users.preferred_language` ('en'|'ar', default 'en'). LanguageContext (src/contexts/LanguageContext.tsx) detects browser/localStorage, syncs to profile, sets document dir=rtl for Arabic.
- Display via `pollText(poll, lang)` in src/lib/pollText.ts + `categoryLabel()` with Arabic names for the 8 categories. Used in HeroVoteCard, Shorts, SharedPoll, BrowseCard, LiveDebateStoryCard, PollHistory.
- Admin CSV template + PollCreationForm/PollEditDialog/PollCalendarPanel have optional Arabic fields. generate-poll produces Arabic automatically; release-daily-calendar auto-translates missing Arabic on release.
- `translate-polls` edge function: admin-gated, {userId, limit<=25}, translates polls missing question_ar, oldest first.
- One poll = one shared vote/result regardless of language.
