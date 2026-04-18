---
name: Campaign visibility modes
description: poll_campaigns.visibility_mode controls whether campaign polls appear in Hero queue, Brand Pack banner, or both
type: feature
---

`poll_campaigns.visibility_mode` (text, default `'mixed'`, CHECK constraint) controls how campaign polls surface to end users:

- **`mixed`** (default) — polls flow into the Hero daily queue AND the BrandPackBanner appears on Home. Maximum reach.
- **`bundle_only`** — polls are EXCLUDED from `generate_daily_queue`. Only accessible via the BrandPackBanner → `/brand-campaign/:id` mini-feed. Curated lean-in experience.
- **`hero_only`** — polls flow into the Hero queue, but the BrandPackBanner is hidden (`useActiveBrandCampaign` filters via `.neq('visibility_mode', 'hero_only')`). Native/stealth campaigns.

Admins set this per-campaign in `BrandCampaignBuilder` via a Select dropdown on each existing campaign row. New campaigns default to `mixed`; `launchCampaign()` accepts an optional `visibilityMode` param.

Implementation:
- DB: column on `poll_campaigns` + CHECK constraint
- Queue filter: `generate_daily_queue` LEFT JOINs `poll_campaigns` and excludes `visibility_mode = 'bundle_only'`
- Banner filter: `useActiveBrandCampaign` excludes `hero_only` campaigns
- Direct link `/brand-campaign/:id` always works regardless of mode (admins can share it)
