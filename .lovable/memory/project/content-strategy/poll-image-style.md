---
name: Poll Image Style
description: Unified cinematic prompt with dynamic country→geo/cast directive, optional cultural_context scene override, and Egyptian keyword boost
type: design
---
Both AI image pipelines (`batch-create-polls` and `generate-calendar-image`) share the strict cinematic prompt:
"Cinematic lifestyle photograph, DSLR, candid, magazine-grade. NO logos, brands, text, UI, posters, graphics, illustrations."

Layered context (in this order, all stack):
1. **Country directive** (from `polls.target_countries[0]` / `poll_calendar.target_country`) — sets geography + cast. Mapping covers Egypt, UAE, Saudi Arabia, Kuwait, Jordan, Lebanon, Morocco, MENA, GCC, Global. Empty/unknown → MENA generic. Never falls back to Western/American/European.
2. **Cultural context** (from `cultural_context` column: Cairo street / Sahel beach / Egyptian home / Egyptian office / Egyptian café / Generic global) — appends a more specific scene directive on top of the country setting.
3. **Keyword boost** — if Arabic Unicode (U+0600–06FF) or Egyptian keywords (كشري شاورما فول طعمية كباب مشويات / Sahel Gouna Cairo Alexandria Zamalek Maadi New Cairo Ain Sokhna Hurghada / Vodafone Orange Etisalat Talabat Elmenus Noon Carrefour Juhayna Edita / Ramadan رمضان Eid عيد) are detected in the brief, an extra Egyptian-atmosphere reinforcement is appended (stacks with country + context).

Closing rule on every prompt: "Never default to Western, American, or European settings."

Calendar pipeline keeps its admin approval gate and 3× retry/fallback (pro → flash 3.1 → flash 2.5). Normal pipeline single-attempt with pro model only.
