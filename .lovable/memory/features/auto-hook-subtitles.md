---
name: Auto-Hook Subtitles
description: Automatic provocative subtitle generation for polls based on category tone
type: feature
---
Every poll gets an auto-generated hook subtitle at creation time via `generateHook()`.

**Pipelines injected:**
- `generate-poll/index.ts` — AI-generated polls
- `release-daily-calendar/index.ts` — calendar polls (respects manual subtitle if set)

**Category-to-tone mapping:**
- Food/Dining → playful ("Your taste says everything", "This is personal")
- Lifestyle/Fashion → identity-based ("This says a lot about you", "Your choice defines your vibe")
- Celebrities/Entertainment → provocative ("Nobody's neutral on this", "This will start arguments")
- Media/Streaming → conflict ("The ultimate struggle", "Stop arguing — just vote")
- Brands/Tech/Products → taste/loyalty ("Loyalty check", "Brand wars — pick your side")
- Social/Opinion/Culture → high-conflict ("Egypt is divided on this", "Which side of history?")
- Daily/Morning → casual-curiosity ("Quick — don't overthink it", "A or B?")
- Fallback → general identity hooks ("Be honest…", "Pick your side")

**Rules:**
- Hooks are ≤8 words
- Never overwrite an existing manual subtitle
- Displayed ABOVE the question on PollCard as italic uppercase primary-colored text
- Falls back to `_default` pool if no category match
