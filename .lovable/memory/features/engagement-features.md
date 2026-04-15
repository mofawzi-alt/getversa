---
name: Engagement Features (Streak Gating, Drip, Hot Take, Streak Rescue)
description: Progressive insight unlocks, 3-batch drip scheduling, daily Hot Take poll, 8 PM streak rescue push
type: feature
---

## Progressive Unlocks (Streak-Gated Insights)
- Day 3+ streak: City split insight on results
- Day 7+ streak: Age split insight on results
- Day 14+ streak: Full taste profile unlocked message
- Logic in `src/lib/streakGating.ts`, UI in `src/components/poll/StreakInsightTeaser.tsx`
- Shown in both Flash and Cinematic results overlays

## Poll Drip Scheduling
- Daily queue releases polls in 3 batches based on Cairo time:
  - 9 AM: ~40% of daily limit
  - 2 PM: ~70% of daily limit
  - 7 PM: 100% of daily limit
- Implemented in `generate_daily_queue` DB function
- Queue expands automatically when user refreshes after batch times

## Daily Surprise "Hot Take" Poll
- `is_hot_take` boolean column on polls table
- Hot Take polls are always prioritized first in daily queue
- Visual: orange-gradient badge with flame icon on hero card
- Component: `src/components/home/HotTakeBadge.tsx`
- Admin sets is_hot_take=true on one poll per day

## Streak Rescue Push Notification
- Edge function: `supabase/functions/streak-rescue-push/index.ts`
- Cron: fires at 6 PM UTC (8 PM Cairo) daily
- Targets users with streak >= 3 who haven't voted today
- Message: "🚨 Your X-day streak is about to break!"
- Also stores in-app notification with type `streak_rescue`
