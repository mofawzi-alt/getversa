# Versa iOS local recovery

Do **not** delete the whole project.

Do **not** delete these:

- `src`
- `public`
- `package.json`
- `capacitor.config.ts`
- `supabase`
- `scripts`

Safe order:

1. Use the `getversa-fresh` folder.
2. Update it from GitHub.
3. Run the safe preflight check.
4. Only if preflight passes, run the iOS update.

The iOS update now refuses to continue if:

- the folder is not Versa
- the native app identity is wrong
- the Apple camera/photo permission fixes are missing
- the app icon source is missing

The Apple permission keys that must be present are:

- `NSCameraUsageDescription`
- `NSPhotoLibraryUsageDescription`
- `NSPhotoLibraryAddUsageDescription`
- `NSFaceIDUsageDescription`
