# Bilingual polls (English + Arabic)

Short answer to your question: yes, the calendar template gets extra Arabic columns, but they stay **optional** — if you leave them empty, Arabic is filled in automatically by AI.

## What users get

- A language choice: Arabic or English (first launch follows the phone language, and it can be changed in Profile).
- The whole poll shows in the chosen language: question, the two options, and the small subtitle line.
- Images, votes, and results stay exactly the same — one poll, two languages, one shared result.
- If an Arabic version is missing for a poll, that poll falls back to English instead of breaking.

## Poll calendar template

The CSV/template gains 4 optional columns next to the existing ones:

- `question_ar`
- `option_a_ar`
- `option_b_ar`
- `subtitle_ar`

Rules:
- Leave them blank and the system auto-writes the Arabic when the poll is released.
- Fill them in and your wording is kept as-is (nothing is overwritten).
- The admin poll form and the edit dialog get the same Arabic fields, shown in a collapsible "Arabic version" section so the form doesn't feel crowded.

## New polls

AI-generated polls are written in both languages in the same step, so nothing extra to do there.

## Existing polls

A one-time pass translates the live polls into Arabic in batches, reviewable in admin before it goes out.

## Technical notes

- Add nullable columns to `polls` and `poll_calendar`: `question_ar`, `option_a_ar`, `option_b_ar`, `subtitle_ar`. Nullable = zero risk to current data.
- Language state in a small `LanguageProvider` (context + localStorage, plus `preferred_language` on the user record so it follows the account); RTL handled with `dir="rtl"` on the app shell and Tailwind logical spacing where needed.
- One helper, e.g. `pollText(poll, lang)`, used by every card (Home hero, Shorts, Browse, History, share pages) so display logic lives in one place.
- `generate-poll` prompt returns both languages in its JSON; category stays one of the 8 English keys internally, with Arabic labels only for display.
- `release-daily-calendar` fills any missing Arabic via the AI gateway before publishing.
- New edge function `translate-polls` for the one-time backfill of existing polls, run in batches from the admin panel.
- `calendarCsv.ts`: add the 4 headers, template examples, and parsing — all optional so old CSV files still import.

## Order of work

1. Database columns + CSV/template/admin form fields.
2. Language switch + RTL + display helper across poll surfaces.
3. AI generates both languages for new polls.
4. Backfill translation for existing polls.
