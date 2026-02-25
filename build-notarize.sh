#!/bin/bash
# Notarized build for MyTreatmentPath
# Credentials are sourced from ~/.zshenv (APPLE_ID, APPLE_TEAM_ID, APPLE_APP_SPECIFIC_PASSWORD)
# Run simply: ./build-notarize.sh

source ~/.zshenv 2>/dev/null

if [ -z "$APPLE_APP_SPECIFIC_PASSWORD" ]; then
  echo "❌ APPLE_APP_SPECIFIC_PASSWORD not set. Check ~/.zshenv"
  exit 1
fi

echo "✅ Apple credentials loaded"
echo "  APPLE_ID: $APPLE_ID"
echo "  APPLE_TEAM_ID: $APPLE_TEAM_ID"
echo "  APPLE_APP_SPECIFIC_PASSWORD: set"
echo ""
echo "Building + notarizing..."

npm run electron:build:mac
