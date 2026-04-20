---
name: Poll Calendar System
description: Admin calendar for scheduling daily polls with CSV import, AI image preview, approval gate, and 7 AM Cairo auto-release
type: feature
---
Admin → Calendar tab manages a `poll_calendar` table with status flow: draft → image_pending → approved → published.
- CSV upload (template via downloadCsvTemplate) or manual edit.
- AI images via `generate-calendar-image` edge function (Gemini 2.5 flash image), stored in `poll-calendar-images` bucket as preview — admin must approve before saving as image_a/b_url.
- Both images + admin approval required before status can become `approved`.
- `release-daily-calendar` cron runs 5 AM UTC (7 AM Cairo, configurable via `daily_poll_settings.release_hour_cairo`) → publishes today's approved rows as real polls (poll_type=core_index, evergreen) → triggers existing `batch-release-notify` push.
- Empty day → no-op; daily queue naturally pulls random unvoted polls per user.
- `calendar-pre-release-check` cron runs hourly → notifies admins (in `notifications` table) at releaseHour-1 if today has unapproved rows, and at 8 PM Cairo if tomorrow has zero approved.
