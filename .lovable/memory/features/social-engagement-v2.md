---
name: Social Engagement V2 (Following Feed, Cliffhangers, Taste Evolution, Weekly Report)
description: Following Feed on Home, Cliffhanger poll series with "Part 2 drops tomorrow", Taste Evolution timeline, Weekly Sunday taste push
type: feature
---

## Following Feed
- Component: `src/components/home/FollowingFeedSection.tsx`
- Shows last 48h votes from followed users as horizontal scroll cards
- Positioned on Home between Live Debates and Weekly Top Results
- Deduplicates by poll (shows latest voter per poll)

## Weekly Taste Report
- Edge function: `supabase/functions/weekly-taste-notification/index.ts`
- Cron: Every Sunday at 10 AM UTC (`0 10 * * 0`)
- Calculates majority%, adventure score, brand loyalty per user
- Saves snapshot to `taste_snapshots` table for timeline
- Sends push + in-app notification with personalized stats

## Taste Evolution Timeline
- Component: `src/components/taste/TasteEvolutionTimeline.tsx`
- Shows on Taste Profile page under "Your Evolution"
- Requires 2+ weekly snapshots to render
- Displays majority alignment delta, adventure score delta, visual journey bars

## Cliffhanger Poll Series
- Polls table has `series_id`, `series_order`, `series_title` columns
- Component: `src/components/poll/CliffhangerSeries.tsx`
- Shows on ResultsOverlay when current poll belongs to a series
- Progress dots, "Part X drops tomorrow" teaser for inactive next parts
- Admin sets series_id (shared UUID) across sequential polls
