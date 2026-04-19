---
name: User-Suggested Polls (Ask Versa loop)
description: Users can suggest polls from Ask Versa guardrails or Profile; admin approves and links to a published poll, auto-awarding +5 Ask credits + notification.
type: feature
---
When Ask Versa hits a guardrail (low/no data) or a user opens "Suggest a poll" from Profile, the question is inserted into `poll_suggestions` with `source` ('ask_versa' | 'profile') and optional `ask_query_id` link. Admin Dashboard "Suggestions" tab lists pending items; approving requires pasting a published poll ID. The `award_suggestion_on_publish` BEFORE UPDATE trigger detects the transition to status='approved' with `published_poll_id` set, calls `earn_ask_credits(user_id, 5)`, sets `awarded_credits=5` and `published_at=now()`, and inserts a `notifications` row (type='suggestion_published', data.poll_id). option_a/option_b are nullable. Reward is idempotent (only fires when awarded_credits=0).
