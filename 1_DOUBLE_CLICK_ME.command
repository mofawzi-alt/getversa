#!/bin/bash
set -e

cd "$(dirname "$0")"
clear

echo "Versa Apple Upload Prep"
echo "This does NOT delete anything."
echo "This does NOT use Git."
echo ""

if ! command -v npm >/dev/null 2>&1; then
  echo "STOP: npm/Node is not installed on this Mac."
  read -n 1 -s -r -p "Press any key to close."
  exit 1
fi

npm install

if [ ! -d "ios/App" ]; then
  npx cap add ios
fi

npm run build
npx cap sync ios
node scripts/capacitor-ios-post-sync.mjs
node scripts/apple-release-ready.mjs
npx cap open ios

echo ""
echo "DONE: Xcode is opening with the fixed iOS project."
echo "In Xcode, use Product > Archive to upload the new build to Apple."
read -n 1 -s -r -p "Press any key to close."