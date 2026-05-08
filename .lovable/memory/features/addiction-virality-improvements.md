---
name: Addiction & Virality Improvements
description: Phase 1-5 stickiness upgrades — skeletons, social buzz, ego cards, infinite feed, emotional AI prompts
type: feature
---
## Phase 1: Kill Dead Moments
- `PollCardSkeleton` component replaces loading spinners in Home and SwipeFeed
- Shimmer animation mirrors exact PollCard layout (aspect ratio, text blocks)

## Phase 2: Live Social Overlays
- `LiveSocialBuzz` component shows contextual social energy on poll cards after voting
- Lines: "Egypt is completely split", "this one's exploding", "Trending in Egypt", "X voting right now"
- Thresholds: 500+ = exploding, 100+ = hot/trending, gap ≤5 = split

## Phase 3: Ego-Based Sharing
- `EgoShareCard` component + `getEgoStatement()` function
- ResultsOverlay now shows identity statements: "Only 8% agree with me", "My taste is controversial"
- Minority badge upgraded with gradient styling and 🔥 emoji
- Share text uses ego statement instead of generic "My take today"

## Phase 4: Never-Ending Feed
- Caught-up screen now has primary CTA "Keep Exploring — People Are Still Debating" → Browse
- End-of-queue message changed from "You're all caught up! 🎉" to "Queue cleared 🔥" with "Keep swiping →" link

## Phase 5: Emotional AI Prompts
- `generate-poll` system prompt updated to require provocative, judgment-oriented questions
- Format guidance: "Which one gives rich energy?" not just "X vs Y?"
