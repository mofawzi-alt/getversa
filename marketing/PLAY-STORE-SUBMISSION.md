# Versa — Google Play Store Submission Pack

Everything you need to submit Versa to the Google Play Store. Copy/paste each
section directly into Google Play Console.

---

## 1. App Information

| Field | Value |
|---|---|
| **App name** (max 30 chars) | `Versa: Where Gen Z Decides` |
| **Short description** (max 80 chars) | `Vote on real polls about brands, trends & culture. See how Gen Z decides.` |
| **Package name** | `app.lovable.c889c415dd2249d6b1128e85df955085` |
| **Category** | Social |
| **Tags** | Social, Lifestyle, Entertainment |

## 2. Store Listing — Full Description (max 4000 chars)

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
```

## 3. Graphics Assets

| Asset | Spec |
|---|---|
| **App icon** | 512×512 PNG, 32-bit, no alpha/transparency |
| **Feature graphic** | 1024×500 PNG or JPEG (shown at top of store listing) |
| **Screenshots** | Min 2, max 8. Phone: 16:9 or 9:16, min 320px, max 3840px |
| **Tablet screenshots** | Optional but recommended. 7" and 10" |

Use screenshots from `marketing/app-store-screenshots/` — same assets work for both stores (crop/resize to 1080×1920 for phone).

## 4. Content Rating (IARC Questionnaire)

Answer the Google Play IARC questionnaire:
- Violence: **No**
- Sexual content: **No**  
- Language: **Mild** (user-generated content may include mild language)
- Controlled substance: **No**
- User interaction: **Yes** (users share content and interact)
- Users can share info: **Yes**
- Users can purchase digital content: **No**
- Unrestricted internet: **No**

→ Expected result: **Everyone 10+** or **Teen**

## 5. Privacy & Data Safety

### Data Safety form

**Data collected:**

| Data type | Collected | Shared | Purpose |
|---|---|---|---|
| Email address | Yes | No | Account management |
| User ID | Yes | No | App functionality |
| App interactions (votes) | Yes | No | App functionality, Analytics |
| Crash logs | Yes | No | App functionality |
| App performance | Yes | No | Analytics |
| City (approximate location) | Yes | No | Analytics |

**Security practices:**
- Data encrypted in transit: **Yes**
- Data can be deleted: **Yes** (Profile → Delete my account)
- Follows Google Families policy: **No** (not a kids app)

### URLs

| Field | Value |
|---|---|
| **Privacy Policy** | `https://getversa.app/privacy-policy` |
| **Terms of Service** | `https://getversa.app/terms` |

## 6. App Access (for review)

If the app requires login, provide test credentials:
- **Email**: `google-review@getversa.app`
- **Password**: (create a strong password)
- Pre-vote on ~20 polls so the reviewer doesn't see empty states

## 7. Target Audience

- **Target age group**: 18+ (not designed for children)
- This is NOT a teacher-approved app
- This is NOT designed for children under 13

## 8. Ads Declaration

- **Does your app contain ads?**: No

## 9. Build & Upload

### Prerequisites
- Google Play Developer account ($25 one-time fee)
- Android Studio installed

### Steps

```bash
# From your local machine
cd /path/to/getversa
npm install
npm run build

# Add Android platform (first time only)
npx cap add android

# Sync web assets to native
npx cap sync android

# Open in Android Studio
npx cap open android
```

In Android Studio:
1. **Build → Generate Signed Bundle / APK**
2. Choose **Android App Bundle (AAB)** — required by Google Play
3. Create or select a keystore (KEEP THIS SAFE — you need it for every update)
4. Build the release bundle
5. Upload the `.aab` file to Google Play Console → **Production** (or Internal Testing first)

### Recommended: Internal Testing First

1. Create an **Internal testing** track in Play Console
2. Upload your AAB there first
3. Add your email as a tester
4. Test the app via the Play Store internal link
5. Once satisfied, promote to **Production**

## 10. App Signing

Google Play manages app signing by default (Google Play App Signing).
- Upload your **upload key** when first submitting
- Google generates and manages the actual signing key
- This is the recommended approach — enables key rotation if compromised

## 11. Release Notes (first version)

```
🎉 Welcome to Versa!

• Vote on real polls about brands, trends, and culture
• See how your generation decides — broken down by city, age, and gender
• Discover your Taste Profile and personality archetype
• Compare compatibility with friends
• Ask Versa anything and get verdicts backed by real votes
• Daily Pulse — what your region is debating right now
```

## 12. Checklist Before Submission

- [ ] App icon 512×512 (no transparency)
- [ ] Feature graphic 1024×500
- [ ] At least 2 phone screenshots (1080×1920 recommended)
- [ ] Privacy policy URL active and accessible
- [ ] Terms of service URL active
- [ ] Test account created with pre-voted polls
- [ ] Data safety form completed
- [ ] Content rating questionnaire completed
- [ ] App signed with release keystore
- [ ] Account deletion works (Profile → Delete my account)
- [ ] Google Sign-In works
- [ ] Apple Sign-In works (also required on Android if offered)

Google review typically takes 1-3 days for new apps, sometimes up to 7 days.
