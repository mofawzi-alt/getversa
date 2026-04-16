

## Plan: Add Decision Helper & Personality Snapshot to Home

### What we're adding

**1. "Help Me Decide" Section** — A card below the Weekly Summary that invites users to browse real poll results for purchase/service decisions. It links to Browse/Explore with a consumer-decision framing (e.g. "Not sure what to pick? See what others chose").

**2. Personality Type Snapshot** — A compact widget on the Home screen showing the user's personality type emoji + name (if unlocked) or a progress teaser (if not yet unlocked). Tapping navigates to the full Taste Profile page.

### Where on the Home page

The order after the "What People Are Choosing Right Now" rankings:

1. **Personality Snapshot** — small card with emoji, type name, and "See full profile →"
2. **Help Me Decide** — CTA card with icon, copy about making smarter choices, linking to `/browse`

### Technical details

**New component: `src/components/home/PersonalitySnapshot.tsx`**
- Reuses the same queries as `PersonalityTypeCard` (vote count + traits via `get_user_voting_traits` RPC)
- If ready: shows emoji + type name + code in a compact horizontal card
- If not ready: shows progress bar with "X more votes to unlock your type"
- Only renders for logged-in users
- `onClick` → `navigate('/profile/taste')`

**New component: `src/components/home/DecisionHelper.tsx`**
- Static CTA card with `ShoppingBag` or `HelpCircle` icon
- Copy: "Not sure what to pick?" / "See real votes from people like you before you decide"
- Button: "Explore Results →" → navigates to `/browse`
- Accessible to all users (guests included)

**Modified: `src/pages/Home.tsx`**
- Import both new components
- Place them after the "What People Are Choosing Right Now" section (before `HomeResultsModal`)
- Personality Snapshot wrapped in `{user && ...}` conditional

No database changes needed.

