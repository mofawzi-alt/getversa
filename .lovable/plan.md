
# Versa Lens — Phase 0 Plan

Goal: validate the *intent* behind Versa Lens (looking up demographic sentiment about a thing) using a **text search bar** — no camera, no barcode, no vision yet. Ship as a new mode inside Ask Versa.

---

## 1. Where it lives in the app

No new tab in BottomNav. Reuse existing surface.

```
AppHeader (Sparkles icon → /ask)
   └── Ask page
        ├── [existing] Ask Versa (chat / questions)
        └── [NEW] "Lens" mode toggle at top
              ├── Search input: "Look up a brand, place, or product…"
              ├── Suggestion chips (recent + trending entities)
              └── Result card stack
```

Entry points to Lens:
- New segmented toggle at top of `/ask`: **Ask | Lens**
- Optional: long-press the Search icon in `AppHeader` → opens Lens directly (cheap, no new icon)
- Empty-state of `GlobalPollSearch` gets a "Try Lens →" CTA when query has 0 matches

No changes to Home, Browse, Explore, or BottomNav. Keeps the experiment isolated and killable.

---

## 2. User flow (Phase 0)

1. User types "Vodafone" / "Sahel" / "Cilantro" / "iPhone"
2. App resolves the string to an **entity** (fuzzy match against `lens_entities` table, or creates a pending one)
3. Shows a result card:
   - Entity name + category
   - **Top 3 related polls** (semantic + keyword match against `polls.question/option_a/option_b`)
   - Per-poll: vote split + 1 demographic cut (age OR gender, whichever has strongest signal)
   - Aggregated "Sentiment snapshot" line ("Gen Z leans 64% toward X")
4. If 0 polls match → CTA: **"No one's voted on this yet — start a poll"**
   - Calls existing user-suggested-polls flow (already built) prefilled with the entity
   - Does NOT auto-publish. Goes through normal admin approval.

Hard limit Phase 0: text only, MENA entity seed list (~500 brands/places curated), no vision, no auto-publish.

---

## 3. Schema changes

Three new tables. No changes to `polls` or `votes`.

### `lens_entities`
Canonical "things" users can look up.

| field | purpose |
|---|---|
| name | display name ("Vodafone Egypt") |
| slug | url-safe id |
| aliases | text[] — fuzzy match ("vodafone", "vf", "فودافون") |
| category | brand / place / product / experience / person |
| country | EG / AE / SA / null |
| status | approved / pending / rejected |
| created_by | user_id (nullable — seed entities have null) |

RLS: public read for `approved`. Insert allowed for authenticated users (creates `pending`). Only admins update status.

### `lens_entity_polls`
Many-to-many link between an entity and the polls that talk about it. Curated + AI-suggested, admin-approved.

| field | purpose |
|---|---|
| entity_id | fk |
| poll_id | fk |
| relevance | float (0–1) — for ranking |
| source | manual / ai / keyword |

RLS: public read. Admin write only (Phase 0 — keeps quality high).

### `lens_lookups`
Telemetry. Validates whether anyone actually uses this.

| field | purpose |
|---|---|
| user_id | nullable (guests count) |
| query | raw string typed |
| matched_entity_id | nullable |
| polls_returned | int |
| converted_to_suggestion | bool — did they hit "start a poll" |

RLS: insert open to all, read admin-only.

### Optional helper
A Postgres function `search_lens_entities(q text)` that does trigram fuzzy match on `name + aliases` and returns top 5. Cheap, no embeddings yet.

---

## 4. Admin surface

Add one tab in `AdminDashboard`: **Lens**.
- Pending entities queue (approve / reject / merge duplicates)
- Entity → polls linker (search polls, attach with relevance score)
- Lookups feed (see what people are searching for → guides which polls to generate)

---

## 5. What we explicitly do NOT build in Phase 0

- Camera / photo recognition
- Barcode scanner
- Auto-poll-generation on lookup (use existing suggestion flow + admin gate instead)
- Embeddings / semantic search (keyword + trigram is enough to validate)
- New BottomNav slot
- Brand-facing Lens dashboard

---

## 6. Success metric to decide Phase 1

After 2 weeks, look at `lens_lookups`:
- **>15% of weekly actives do at least one lookup** → validate, invest in vision
- **>30% of lookups return 0 polls AND >10% of those convert to a suggestion** → demand for new content, justify auto-generation
- Below either → kill or pivot. Don't build the camera.

---

## 7. Conflicts with existing model — resolved

- **Poll image rule** (cinematic lifestyle, no logos/products) stays intact. Lens shows the *entity name* in the result card header, not on the poll image itself. The poll image keeps Versa's visual language.
- **No alcohol imagery** rule unaffected — entity lookups for alcohol brands return polls only if any exist; we don't generate visuals from the entity.
- **Demographics privacy** — Lens uses the same admin/brand gating; public users see only aggregated splits already exposed in regular results.
- **Guest 3-vote limit** — Lens lookups are free for guests (read-only); starting a poll still requires signup.

---

## 8. Build order (when approved)

1. Migration: 3 tables + RLS + trigram index + `search_lens_entities` function
2. Seed ~500 MENA entities (script, admin-run)
3. Admin Lens tab (pending queue + entity↔poll linker)
4. `/ask` page: Ask | Lens toggle + search UI + result card
5. Wire "start a poll" CTA into existing user-suggested-polls flow
6. Telemetry write on every lookup

Ship behind a feature flag (`lens_enabled` in profile or env) so we can dark-launch to admins first.
