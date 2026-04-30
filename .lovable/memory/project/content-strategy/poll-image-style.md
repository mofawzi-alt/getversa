---
name: Poll Image Style
description: Unified cinematic lifestyle prompt with MENA cultural context, keyword detection, and per-poll cultural_context override
type: design
---
Both AI image pipelines (`batch-create-polls` and `generate-calendar-image`) share the strict cinematic prompt:
"Cinematic lifestyle photograph, DSLR, candid, magazine-grade. NO logos, brands, text, UI, posters, graphics, illustrations."

Default MENA suffix on every prompt:
"Setting: contemporary Egypt / MENA region. Cast: Middle Eastern / North African Gen Z. No Western-coded environments unless the subject explicitly requires it."

Cultural context layering (priority order):
1. Explicit `cultural_context` column on `polls` / `poll_calendar` (allowed: Cairo street, Sahel beach, Egyptian home, Egyptian office, Egyptian café, Generic global). Each maps to a scene directive injected into the prompt.
2. If `cultural_context` is null and target country is Egypt → defaults to "Cairo street".
3. If still no explicit context, keyword detector scans question/option/category for Arabic Unicode (U+0600–06FF) or Egyptian keywords (كشري شاورما فول طعمية كباب مشويات / Sahel Gouna Cairo Alexandria Zamalek Maadi New Cairo Ain Sokhna Hurghada / Vodafone Orange Etisalat Talabat Elmenus Noon Carrefour Juhayna Edita / Ramadan رمضان Eid عيد) → injects "Scene is specifically set in Egypt — Cairo streets, Egyptian faces, Arabic signage, local atmosphere."

`Generic global` explicitly disables all Egypt directives.

Calendar pipeline keeps its admin approval gate and 3× retry/fallback (pro → flash 3.1 → flash 2.5). Normal pipeline single-attempt with pro model only.
