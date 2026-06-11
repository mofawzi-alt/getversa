#!/bin/bash
set -e

cd "$(dirname "$0")"
clear

echo "Versa Apple Upload Prep"
echo "This does NOT delete anything."
echo "This does NOT use Git."
echo "Use this from a freshly opened ZIP folder, not the old ~/Desktop/versa folder."
echo ""

if ! command -v npm >/dev/null 2>&1; then
  echo "STOP: npm/Node is not installed on this Mac."
  read -n 1 -s -r -p "Press any key to close."
  exit 1
fi

if [ ! -x "node_modules/.bin/vite" ] || [ ! -x "node_modules/.bin/cap" ]; then
  echo "Installing clean app files. This can take a few minutes."
  npm ci --no-audit --no-fund
fi

node scripts/ios-sync-verbose.mjs --no-install --copy-only --open

echo ""
echo "DONE: Xcode is opening with the fixed iOS project."
echo "In Xcode, use Product > Archive to upload the new build to Apple."
read -n 1 -s -r -p "Press any key to close."