# Campaigns Redesign Plan

## Goals
Fix the 3 pain points you flagged:
1. **Builder UI** — too clunky / too many fields
3. **Brand-client portal** — feels weak/empty
4. **Analytics output** — not telling you enough (vs the rich Poll Analytics + Insights views)

Concept of grouping polls into campaigns stays. No DB schema changes — reuses `poll_campaigns`, `campaign_polls`, `campaign_clients`.

---

## Part 1 — New Campaign Builder (3 modes, tabbed)

### Mode A — Quick Launch (default)
Minimal fields: campaign name, brand name, polls (question + A + B). Logo, description, dates, images, category hidden behind an "Advanced" toggle.

### Mode B — Templates (5 presets)
1. **Brand Battle** — Brand A vs Brand B head-to-head across 5 dimensions (taste, price, packaging, ads, loyalty)
2. **Product Intelligence** — Single brand, product feature trade-offs
3. **Market Pulse** — Category-wide sentiment across multiple players
4. **Perception Gap** — Identity / values polls
5. **Brand Health Pulse** — Recurring tracker (recommend, modern, trustworthy)

Each template seeds 3-5 question stubs the user just edits.

### Mode C — AI Draft
- Inputs: brand + topic/goal + # of polls
- Edge function `generate-campaign-polls` (Lovable AI Gateway, `google/gemini-2.5-flash`)
- User reviews/edits drafts before launch

---

## Part 2 — Unified Campaign Analytics

New `CampaignDetailView.tsx` with 4 tabs, used by BOTH admin dialog AND brand-client portal.

- **Overview** — KPI cards (total votes, unique voters, completion %, engagement), trend chart, top-line winner per poll.
- **Polls** — Each poll's vote split + winner; click to expand into the existing rich `PollAnalytics` view inline.
- **Demographics** — Gender / age / city / country splits across the campaign + per-poll toggle. Reuses existing chart components.
- **AI Narrative** — Edge function `generate-campaign-insights` writes: what the campaign revealed, strongest signal, demographic insight, recommended next move. Cached + manual refresh.

### PDF Export
- "Export Report" on Overview, Versa-branded only
- Available to BOTH admin and brand clients (clients self-serve)
- Uses existing `jspdf` + `html2canvas`
- Pages: Cover → Overview KPIs → Per-poll results → Demographics → AI Narrative

---

## Part 3 — Brand Client Portal Upgrade

Replace `BrandClientPortal`'s main panel with the same `CampaignDetailView`. Same quality view as admin + self-serve PDF.

---

## File changes

**New**
- `src/components/admin/campaigns/CampaignDetailView.tsx`
- `src/components/admin/campaigns/QuickLaunchForm.tsx`
- `src/components/admin/campaigns/TemplatesForm.tsx`
- `src/components/admin/campaigns/AIDraftForm.tsx`
- `src/lib/campaignTemplates.ts`
- `src/lib/campaignPdf.ts`
- `supabase/functions/generate-campaign-polls/index.ts`
- `supabase/functions/generate-campaign-insights/index.ts`

**Refactored**
- `BrandCampaignBuilder.tsx` → shell with 3-mode tabs
- `CampaignAnalyticsDialog.tsx` → thin wrapper around `CampaignDetailView`
- `BrandClientPortal.tsx` → embeds `CampaignDetailView`

**Untouched**
- DB schema (no migrations)
- How campaign polls appear in Home / Browse feed
- All other admin tabs
- Existing live campaigns keep working

---

## Order of work (each step shippable on its own)
1. `CampaignDetailView` tabs 1-3 + wire into admin dialog
2. PDF export
3. Wire same view into Brand Client Portal
4. Builder: Quick Launch mode
5. Builder: Templates mode
6. `generate-campaign-insights` edge function (Tab 4)
7. `generate-campaign-polls` edge function (AI Draft mode)
