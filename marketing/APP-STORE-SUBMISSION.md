# Versa — App Store Submission Pack

Everything you need to submit Versa to the Apple App Store. Copy/paste each
section directly into App Store Connect.

---

## 1. App Information

| Field | Value |
|---|---|
| **App name** (max 30 chars) | `Versa: Where Gen Z Decides` |
| **Subtitle** (max 30 chars) | `Vote. Compare. Discover.` |
| **Bundle ID** | `app.lovable.c889c415dd2249d6b1128e85df955085` (or `com.fawzy.versa` if you change it in Xcode) |
| **Primary category** | Social Networking |
| **Secondary category** | Lifestyle |
| **Content rights** | You own all rights / no third-party content |

## 2. Pricing & Availability

- **Price**: Free
- **Availability**: All countries (or start with Egypt + GCC if you want a soft launch)

## 3. Age Rating

Answer Apple's questionnaire as follows:
- Cartoon or Fantasy Violence: **None**
- Realistic Violence: **None**
- Sexual Content or Nudity: **None**
- Profanity or Crude Humor: **Infrequent/Mild** (user-generated content may include mild language)
- Alcohol, Tobacco, or Drug Use or References: **Infrequent/Mild**
- Mature/Suggestive Themes: **None**
- Horror/Fear Themes: **None**
- Medical/Treatment Information: **None**
- Gambling and Contests: **None**
- Unrestricted Web Access: **No**
- Gambling: **No**
- Contests: **No**
- User Generated Content: **Yes** (poll suggestions)

→ Result: **Rated 12+**

## 4. App Description (max 4000 chars)

```
Versa is where Gen Z decides. Vote on real polls about brands, trends, and culture — see how your taste compares to thousands of others, in real time.

EVERY POLL IS A QUICK CHOICE
Tap left or right. That's it. Coke vs Pepsi. Going out vs staying in. iPhone vs Samsung. See instantly how the rest of your generation voted, broken down by city, age, and gender.

YOUR TASTE PROFILE
The more you vote, the smarter Versa gets. Discover your personality archetype — The Dreamer, The Realist, The Trendsetter — and see exactly what makes your taste unique.

COMPARE WITH FRIENDS
Add friends and see your compatibility instantly. Find out who shares your style on food, music, fashion, and lifestyle. Battle your friends in head-to-head poll duels.

ASK VERSA
Stuck choosing between two things? Ask Versa anything ("Should I get the new iPhone or wait?") and get a verdict backed by real votes from people like you.

DAILY PULSE
Wake up to the morning pulse — what Egypt and the region are debating right now. Bite-sized, addictive, never boring.

POWERED BY REAL PEOPLE
No bots. No fake votes. Every result is built from real choices made by real Gen Z users across the Middle East.

Made for the generation that votes with their thumbs.

— Privacy Policy: https://getversa.app/privacy-policy
— Terms of Service: https://getversa.app/terms
— Support: support@getversa.app
```

## 5. Keywords (max 100 chars, comma-separated, NO spaces after commas)

```
poll,vote,gen z,this or that,compare,trending,brand,quiz,personality,debate,trends,egypt,arab,mena
```

## 6. URLs

| Field | Value |
|---|---|
| **Support URL** | `https://getversa.app/support` (create a simple support page or use `/privacy-policy` temporarily) |
| **Marketing URL** (optional) | `https://getversa.app` |
| **Privacy Policy URL** (REQUIRED) | `https://getversa.app/privacy-policy` |

## 7. App Privacy ("Nutrition Label")

Apple will ask: "Does your app collect data?" → **Yes**

Declare these data types as **Linked to user identity**:
- **Contact Info**: Email Address (used for app functionality, account auth)
- **User Content**: Other user content — votes, poll suggestions (used for app functionality, analytics)
- **Identifiers**: User ID (used for app functionality)
- **Usage Data**: Product Interaction (used for app functionality, analytics)
- **Diagnostics**: Crash Data, Performance Data (used for app functionality)

Declare as **Not linked** if you want to be conservative:
- Approximate Location (city only, used for analytics)

Tracking: **No** (Versa does not track users across other apps/websites)

## 8. Sign in with Apple

- ✅ Implemented (required by Guideline 4.8 since you offer Google Sign-In)
- The "Sign in with Apple" button appears on `/auth` next to Google

## 9. Account Deletion

- ✅ Implemented at **Profile → Delete my account** (required by Guideline 5.1.1(v))
- User types "DELETE" to confirm; backend removes auth user + all linked data

## 10. Demo Account for Apple Reviewer

App Store Connect will ask for a test account. Create one in your Versa app:
- **Email**: `apple-review@getversa.app`
- **Password**: pick a strong one
- Pre-vote on ~20 polls so the reviewer doesn't see empty states

Add a note to the reviewer:
```
Versa is a binary polling app. To test:
1. Sign in with the demo credentials above (or use any social provider)
2. Vote on the polls in the Home feed (swipe or tap)
3. Visit Profile to see Taste Profile, vote history, and friend comparison
4. Visit Ask to query Versa about decisions

Sign in with Apple is supported. Account deletion is in Profile.

If you need anything: support@getversa.app
```

## 11. Screenshots Required

iPhone 6.7" (1290 × 2796) — at least 3, max 10. Use the marketing
screenshots in `marketing/app-store-screenshots/` (generated separately).

Recommended order:
1. Hero poll card with VERSA logo + tagline overlay
2. Vote results / cinematic results screen
3. Taste Profile / personality reveal
4. Friend compatibility comparison
5. Daily Pulse / morning insights

## 12. Build Upload

After enrolling in Apple Developer Program ($99/yr) and waiting 24-48h:

```bash
cd /Users/mohamedfawzy/Desktop/getversa
npm run build
npx cap sync ios
open ios/App/App.xcworkspace
```

In Xcode:
1. Select **Any iOS Device (arm64)** (top toolbar, NOT a simulator)
2. **Product → Archive** → wait ~5 min
3. Window opens → **Distribute App** → **App Store Connect** → **Upload**
4. Wait ~30 min for Apple to process the binary
5. Go to App Store Connect → your app → **+ Version** → fill metadata + select build → **Submit for Review**

Apple review typically takes 24-48h. If rejected, fix and resubmit (no penalty).
