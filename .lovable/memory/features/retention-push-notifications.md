---
name: Retention Push Notifications (Friend Voted, Personalized, Weekly Recap, Social Proof)
description: Real-time friend-voted push, category-matched poll push every 4h, Sunday weekly recap, daily 3PM social proof nudge
type: feature
---

## Friend Voted Push
- Edge function: `supabase/functions/friend-voted-push/index.ts`
- Triggered by: `notify_friends_on_vote` DB trigger via pg_net
- Sends real push to friends who haven't voted on the same poll
- Message: "{username} just voted! 👀 — See if you agree"

## Personalized Poll Push
- Edge function: `supabase/functions/personalized-poll-push/index.ts`
- Cron: every 4 hours
- Matches polls created in last 4h against user `category_interests`
- Message: "🎯 A poll you'd love just dropped!"
- Notification type: `personalized_poll`

## Weekly Recap Push
- Edge function: `supabase/functions/weekly-recap-push/index.ts`
- Cron: Sundays at 4 PM UTC (6 PM Cairo)
- Sends personalized vote count + streak info
- Message: "📊 You voted X times this week! 🔥 Y-day streak!"
- Notification type: `weekly_recap`

## Social Proof Nudge
- Edge function: `supabase/functions/social-proof-nudge/index.ts`
- Cron: daily at 1 PM UTC (3 PM Cairo)
- Targets users who haven't voted today but have friends who did
- Message: "👥 X friends voted today! Don't miss out"
- Notification type: `social_proof_nudge`
