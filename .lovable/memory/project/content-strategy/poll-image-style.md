---
name: Poll Image Style
description: Unified cinematic prompt with dynamic country→geo/cast directive, optional cultural_context scene override, Egyptian keyword boost, pair balance rule, and 1-second clarity rule across all 4 pipelines
type: design
---
All 4 AI image pipelines (`generate-poll`, `batch-create-polls`, `generate-calendar-image`, `regen-poll-images`) now share the **Versa Image Pipeline v3** standard:

**Base prompt**: "Cinematic lifestyle photograph, DSLR, candid, magazine-grade. NO logos, brands, text, UI, posters, graphics, illustrations."

**Layered context** (all stack in order):
1. **Country directive** — sets geography + cast. Covers Egypt, UAE, Saudi Arabia, Kuwait, Jordan, Lebanon, Morocco, MENA, GCC, Global.
2. **Cultural context** — 12 options: Cairo street, Sahel beach, Egyptian home, Egyptian office, Egyptian café, Egyptian university campus, Egyptian mall or shopping center, Egyptian gym or outdoor public space, Nile view or Cairo waterfront, Egyptian wedding venue or celebration, New Cairo compound or premium residential, Generic global.
3. **Keyword boost** — Arabic Unicode or Egyptian keywords trigger extra Egyptian atmosphere reinforcement.
4. **Pair balance rule** — images must match brightness, complementary color temps, balanced compositional weight.
5. **1-second clarity rule** — option meaning must be obvious in under 1 second; no symbolic or loosely related scenes.

**visual_direction** (generate-poll only): Step 1 text generation outputs `visual_direction` JSON with `option_a_scene`, `option_b_scene`, `contrast_type`, `emotion_a`, `emotion_b`, `pair_relationship`. Step 2 uses these as primary image briefs.

**Retry**: All pipelines use 3-attempt retry with model fallback (pro → flash 3.1 → flash 2.5). Failed polls flagged `needs_manual_image`.

**Admin approval checklist** (calendar): 7-point checklist required before approval. 3 rejections → needs_manual_image flag.
