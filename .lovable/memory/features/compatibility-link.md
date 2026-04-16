---
name: Shareable Compatibility Link & QR Code
description: Users can generate a unique /compare/u/:userId link + QR code. Blended compatibility score combines vote match (40%), dimension alignment (35%), and personality type (25%).
type: feature
---

## Shareable Compatibility System

### Route
- `/compare/u/:userId` — public route (no auth required to view, but login required to see scores)

### Components
- `BlendedCompatibility` — combines 3 scores: vote match (get_compatibility_score), dimension alignment (get_dimension_compatibility), personality type (computeTypeCompatibility)
- `ShareCompatibilityCard` — on Profile page, generates link + QR code + native share
- `CompareUser` page — landing page for comparison links

### Score Blending
- Vote Match: 40% weight — raw agreement on shared polls
- Dimension Alignment: 35% weight — cosine-like comparison of user_dimension_scores
- Personality Type: 25% weight — MBTI-based compatibility matrix
- Weights normalize when a score is unavailable

### Database
- `get_dimension_compatibility(user_a, user_b)` RPC — compares dimension scores, returns per-dimension alignment %
