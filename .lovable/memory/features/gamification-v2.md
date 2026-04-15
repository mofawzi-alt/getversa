---
name: Gamification V2 (Weekly Leaderboard, Category Badges, Prediction Accuracy, Poll Suggestions)
description: Weekly Monday reset leaderboard, auto-awarded category expert badges at 20 votes, prediction accuracy tracking, user poll suggestion form
type: feature
---

## Weekly Leaderboard Reset
- Table: `weekly_leaderboard` (user_id, week_start, weekly_points, rank)
- Edge function: `supabase/functions/weekly-leaderboard-reset/index.ts`
- Cron: Every Monday at 1 AM UTC
- Snapshots top 100 users, notifies top 3
- New default tab "Weekly" on Leaderboard page with countdown

## Category Badges
- Trigger: `trg_award_category_badges` on votes table
- Function: `award_category_badges()` checks vote count per category
- Awards "{Category} Expert" badge at 20+ votes in a category
- Auto-creates badge definition if missing, +15 points reward
- In-app notification on badge earn

## Prediction Accuracy
- Columns: `prediction_accuracy`, `prediction_total` on users table
- Trigger: `trg_update_prediction_accuracy` on votes table
- Tracks % of votes that align with majority (polls with 5+ votes)
- Recalculates on last 100 votes for performance
- Shown as "Majority Rate" stat on Profile page

## User-Suggested Polls
- Table: `poll_suggestions` (user_id, question, option_a, option_b, category, status)
- Component: `src/components/poll/PollSuggestionForm.tsx`
- Shown on Home page below Following Feed
- Users can submit ideas and see their submission status
- Admins manage via `poll_suggestions` table (pending/approved/rejected)
