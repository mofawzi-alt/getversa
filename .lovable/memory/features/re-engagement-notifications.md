---
name: Re-engagement Push Notifications (Absence Digest, Result Flip, Vote Mattered)
description: 48h absence digest with top 3 debated polls, hourly result flip alerts for losing voters, 3-hourly "your vote mattered" for minority-turned-majority
type: feature
---

## 48h Absence Digest
- Edge function: `supabase/functions/absence-digest/index.ts`
- Cron: daily at 12 PM UTC
- Targets users with last_vote_date between 2-14 days ago
- Sends top 3 most debated (closest to 50/50) polls from last 48h
- Notification type: `absence_digest`

## Result Flip Alerts
- Edge function: `supabase/functions/result-flip-alert/index.ts`
- Cron: every hour at :15
- Compares current results with 1-2h ago to detect leader changes
- Only fires on tight races (spread < 8%)
- Notifies users who voted for the now-losing option
- Notification type: `result_flip`

## "Your Vote Mattered"
- Edge function: `supabase/functions/vote-mattered-alert/index.ts`
- Cron: every 3 hours at :30
- Detects polls where winning choice was <45% in early votes but is now majority
- Notifies early voters who backed the winner when it was losing
- 24h dedup to prevent repeat notifications
- Notification type: `vote_mattered`
