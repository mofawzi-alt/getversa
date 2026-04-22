

# App Store Assets: Icon + Splash for Versa

You need a polished app icon and splash screen before Apple or Google will approve Versa. Here's the plan to generate everything from a single master design, plus update the in-app splash to match.

## What the stores require

- **Apple**: 1024×1024 master icon (no transparency, no rounded corners — iOS rounds automatically), plus auto-generated sizes (60, 76, 120, 152, 167, 180 px)
- **Google Play**: 512×512 store listing icon, plus 432×432 adaptive icons (foreground + background layers)
- **Splash screens**: iOS launch images (1242×2688, 1125×2436, 828×1792) and Android 12+ splash (centered logo on white)

## Design direction

White background, signature red `#E8392A` mark, no text overlay, edge-to-edge fill. Three options — pick one:

- **A — Monogram "V"**: Bold red "V" letterform on white. Strongest brand tie.
- **B — Red dot**: Single red circle (the vote dot) on white. Minimal, scales beautifully at small sizes.
- **C — Split square**: Diagonal half-white / half-red. Represents binary choice. Most conceptual.

## What I'll build

1. Generate master `app-icon-1024.png` (1024×1024) in chosen direction
2. Generate master `splash-2732.png` (2732×2732, centered logo on white)
3. Generate adaptive Android icon layers (`icon-foreground.png`, `icon-background.png`)
4. Replace `public/favicon.png`, `public/apple-touch-icon.png`, `public/icon-192.png`, `public/icon-512.png` so web/PWA icons match the new app icon
5. Update `index.html` `<link>` tags and PWA `manifest.json` references
6. Tweak `SplashScreen.tsx` to ensure the in-app splash matches the native launch screen (so handoff feels seamless)
7. Drop all assets into a `resources/` folder ready for `@capacitor/assets` CLI to consume

## Files created/modified

```text
public/
  app-icon-1024.png          (NEW — master)
  splash-2732.png            (NEW — master)
  favicon.png                (replaced)
  apple-touch-icon.png       (replaced)
  icon-192.png               (replaced)
  icon-512.png               (replaced)
  manifest.json              (updated icon refs)
resources/
  icon-only.png              (NEW — for capacitor-assets)
  icon-foreground.png        (NEW — Android adaptive)
  icon-background.png        (NEW — Android adaptive)
  splash.png                 (NEW)
index.html                   (updated favicon links)
src/components/SplashScreen.tsx  (minor polish for native parity)
```

## What you do later (on your Mac, after Capacitor is added)

```text
npm install @capacitor/assets --save-dev
npx capacitor-assets generate
```

This auto-generates all 30+ platform-specific sizes from the masters and drops them into `ios/App/App/Assets.xcassets/` and `android/app/src/main/res/`.

## Decision needed

Reply with **A**, **B**, or **C** (or describe a different direction) and I'll switch to build mode and execute steps 1–7 in one go.

