---
name: Poll Image Style
description: Topic-first cinematic prompts use question, category, and option with dynamic country/cultural context and no generic human defaults
type: design
---
Both AI image pipelines (`batch-create-polls` and `generate-calendar-image`) share the strict cinematic prompt:
"Cinematic lifestyle photograph, DSLR, candid, magazine-grade. NO logos, brands, text, UI, posters, graphics, illustrations."

Every active generation and regeneration path must explicitly include the poll question, fixed category, and relevant option. The question/category define the main setting, objects, and activity. People are optional and appear only when their action clarifies the topic; generic portraits and neutral human subjects are forbidden. Education polls must visibly prioritize universities, classrooms, libraries, books, or study environments.

Layered context (in this order, all stack):
1. **Country directive** (from `polls.target_countries[0]` / `poll_calendar.target_country`) — sets geography + cast. Mapping covers Egypt, UAE, Saudi Arabia, Kuwait, Jordan, Lebanon, Morocco, MENA, GCC, Global. Empty/unknown → MENA generic. Never falls back to Western/American/European.
2. **Cultural context** (from `cultural_context` column: Cairo street / Sahel beach / Egyptian home / Egyptian office / Egyptian café / Generic global) — appends a more specific scene directive on top of the country setting.
3. **Keyword boost** — if Arabic Unicode (U+0600–06FF) or Egyptian keywords (كشري شاورما فول طعمية كباب مشويات / Sahel Gouna Cairo Alexandria Zamalek Maadi New Cairo Ain Sokhna Hurghada / Vodafone Orange Etisalat Talabat Elmenus Noon Carrefour Juhayna Edita / Ramadan رمضان Eid عيد) are detected in the brief, an extra Egyptian-atmosphere reinforcement is appended (stacks with country + context).

Closing rule on every prompt: "Never default to Western, American, or European settings."

Calendar pipeline keeps its admin approval gate and 3× retry/fallback (pro → flash 3.1 → flash 2.5). Normal pipeline single-attempt with pro model only.
