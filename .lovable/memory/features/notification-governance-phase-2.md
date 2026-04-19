---
name: Notification governance (Phase 2)
description: 3/day cap, prefs table, priority queue, quiet hours 11pm–8am Cairo, governed notification edge function. Daily poll batch fires once at 7am Cairo only.
type: feature
---
Phase 2 retention infrastructure built on top of Phase 1 visual FOMO.

**Tables**
- `user_notification_preferences` — per-user toggles for 11 notification types (daily_poll_batch, streak_reminder, friend_activity, challenge_waiting, controversial_poll, compatibility_change, weekly_taste_report, new_category, missed_poll, predict_reveal, last_chance_poll). All default ON. Auto-created via trigger on `users` insert.
- `notification_log` — every governed send recorded (user_id, notification_type, priority, sent_at, opened, channel, data). Powers the 3/day cap and admin analytics.

**Governance functions**
- `can_send_notification(user_id, type, priority)` returns `{allowed, reason, sent_today, displaced_id}`. Checks: pref column → quiet hours (Cairo 23–08, challenge_waiting allowed until midnight) → 3/day cap. Priority 1 (streak_reminder) bypasses cap by displacing the lowest-priority log row from today.
- `log_notification_sent(user_id, type, priority, channel, data)` records a successful send.
- `get_notification_analytics(days)` admin-only: total today, total period, users_disabled_all (now includes daily_poll_batch), by_type stats, daily_volume.

**Edge function — single entry point**
`send-governed-notification` is the canonical sender. Body: `{user_id, notification_type, priority, title, body, url?, data?, send_push?}`. It calls `can_send_notification`, inserts the in-app notification, relays to `send-push-notification` (with `skip_in_app=true`), then calls `log_notification_sent`. Skipping ungated insert into `notifications` keeps the cap honest.

**Daily poll batch (the one-per-day rule)**
- `batch-release-notify` edge function sends ONE governed push per user per day at 7:00 AM Cairo. Type `daily_poll_batch` (priority 3).
- Cron `batch-release-notify-daily-7am` runs `0 5 * * *` UTC (= 7am Cairo year-round, no DST in Egypt).
- The old per-poll trigger `on_new_poll_notify` on `polls` was DROPPED — admins can create polls without blasting users. The 12k/month `new_poll` flood is gone.
- The old morning/afternoon/evening 3-batch schedule is gone. Only the 7am send remains.

**Refactored to use governance** (high-volume only)
- `batch-release-notify` → priority 3, type `daily_poll_batch` (1/day at 7am)
- `friend-voted-push` → priority 4, type `friend_activity`
- `personalized-poll-push` → priority 7, type `new_category`
- `social-proof-nudge` → priority 4, type `friend_activity`

NOT yet refactored (low-volume): weekly-recap-push, daily-streak-reminder, streak-rescue-push, friend-activity-digest, friend-disagreement-push, vote-mattered-alert, absence-digest. These still bypass the cap.

**Priority order (10 levels)**
1 streak_reminder · 2 challenge_waiting · 3 last_chance_poll / daily_poll_batch · 4 friend_activity · 5 controversial_poll · 6 weekly_taste_report · 7 new_category · 8 compatibility_change · 9 missed_poll · 10 predict_reveal.

**UI surfaces**
- `src/components/profile/NotificationPreferences.tsx` — 11 toggles (daily_poll_batch is first), rendered inside `/profile/notifications` above the legacy automation switches.
- `src/components/admin/NotificationAnalytics.tsx` — 3 stat cards (sent today, top driver, disabled all), per-type open-rate bars, 30-day daily volume chart. Mounted inside the existing admin "Notify" tab above the broadcast tools.

**Email** intentionally skipped in this phase — user opted for in-app only.
