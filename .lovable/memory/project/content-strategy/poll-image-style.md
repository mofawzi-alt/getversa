---
name: Poll Image Style
description: Unified cinematic lifestyle prompt with MENA cultural context for both batch-create-polls and generate-calendar-image
type: design
---
Both AI image pipelines (`batch-create-polls` and `generate-calendar-image`) use the same strict cinematic prompt:
"Cinematic lifestyle photograph, DSLR, candid, magazine-grade. NO logos, brands, text, UI, posters, graphics, illustrations."

Cultural context appended to both:
"Setting: contemporary Egypt / MENA region. Cast: Middle Eastern / North African Gen Z. No Western-coded environments unless the subject explicitly requires it."

Calendar pipeline keeps its admin approval gate and 3× retry/fallback (pro → flash 3.1 → flash 2.5). Normal pipeline single-attempt with pro model only.
