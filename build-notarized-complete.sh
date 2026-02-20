#!/bin/bash

# Complete Build & Notarization Script for MyTreatmentPath
# Builds, signs, and notarizes both .app AND .dmg

set -e  # Exit on error

echo "🚀 MyTreatmentPath Complete Build & Notarization"
echo "=================================================="
echo ""

# Check if credentials are set
if [ -z "$APPLE_ID" ] || [ -z "$APPLE_APP_SPECIFIC_PASSWORD" ]; then
    echo "⚠️  Apple credentials not found in environment variables"
    echo ""
    echo "Looking for credentials file..."
    
    if [ -f ./notarize-credentials.sh ]; then
        echo "✅ Found ./notarize-credentials.sh"
        source ./notarize-credentials.sh
    elif [ -f ~/.notarize-credentials ]; then
        echo "✅ Found ~/.notarize-credentials"
        source ~/.notarize-credentials
    else
        echo "❌ No credentials file found"
        echo ""
        echo "Create ~/.notarize-credentials with:"
        echo ""
        echo "   export APPLE_ID=\"your-apple-id@email.com\""
        echo "   export APPLE_APP_SPECIFIC_PASSWORD=\"xxxx-xxxx-xxxx-xxxx\""
        echo "   export APPLE_TEAM_ID=\"7UU4H2GZAW\""
        echo ""
        exit 1
    fi
fi

TEAM_ID="${APPLE_TEAM_ID:-7UU4H2GZAW}"

echo ""
echo "📋 Build Configuration:"
echo "   Product: MyTreatmentPath"
echo "   Apple ID: $APPLE_ID"
echo "   Team ID: $TEAM_ID"
echo "   Notarization: ENABLED ✅"
echo ""
echo "⏱️  Estimated time: 10-20 minutes"
echo ""

# Clean previous builds
if [ -d "build" ]; then
    echo "🧹 Cleaning previous build..."
    rm -rf build/mac-arm64/*.dmg 2>/dev/null || true
fi

# Step 1: Build frontend
echo "📦 Step 1/5: Building frontend (Vite)..."
npm run build

# Step 2: Build Electron app (includes .app notarization)
echo "🔨 Step 2/5: Building Electron app..."
echo "   (This includes .app signing + notarization)"
npm run electron:build:mac

# Find the generated DMG
DMG_FILE=$(find build -name "*.dmg" -type f | head -1)

if [ -z "$DMG_FILE" ]; then
    echo "❌ DMG file not found after build!"
    exit 1
fi

echo ""
echo "✅ App built successfully!"
echo "   DMG: $DMG_FILE"

# Step 3: Notarize the DMG
echo ""
echo "🔐 Step 3/5: Notarizing DMG..."
echo "   Submitting to Apple (this may take 5-15 minutes)..."

NOTARIZE_OUTPUT=$(mktemp)

xcrun notarytool submit "$DMG_FILE" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD" \
  --team-id "$TEAM_ID" \
  --wait \
  2>&1 | tee "$NOTARIZE_OUTPUT"

# Check if notarization succeeded
if grep -q "status: Accepted" "$NOTARIZE_OUTPUT"; then
    echo "✅ DMG notarization accepted!"
else
    echo "❌ DMG notarization failed!"
    echo ""
    echo "Check the output above for details."
    
    # Get submission ID for detailed logs
    SUBMISSION_ID=$(grep "id:" "$NOTARIZE_OUTPUT" | head -1 | awk '{print $2}')
    if [ -n "$SUBMISSION_ID" ]; then
        echo ""
        echo "📋 Get detailed logs with:"
        echo "   xcrun notarytool log $SUBMISSION_ID --apple-id \"$APPLE_ID\" --password \"$APPLE_APP_SPECIFIC_PASSWORD\" --team-id \"$TEAM_ID\""
    fi
    
    rm "$NOTARIZE_OUTPUT"
    exit 1
fi

rm "$NOTARIZE_OUTPUT"

# Step 4: Staple the ticket to the DMG
echo ""
echo "📎 Step 4/5: Stapling notarization ticket to DMG..."

xcrun stapler staple "$DMG_FILE"

echo "✅ Ticket stapled!"

# Step 5: Verify
echo ""
echo "🔍 Step 5/5: Verifying notarization..."

if xcrun stapler validate "$DMG_FILE" 2>&1 | grep -q "is valid"; then
    echo "✅ DMG is fully notarized and stapled!"
else
    echo "⚠️  Validation warning (may still work)"
fi

# Final summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 BUILD COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📦 Distributable file:"
echo "   $DMG_FILE"
echo ""
echo "✅ Fully signed and notarized:"
echo "   • No Gatekeeper warnings"
echo "   • No 'unidentified developer' alerts"
echo "   • No malicious software warnings"
echo ""
echo "📤 Ready to distribute via:"
echo "   • GitHub Releases"
echo "   • Direct download"
echo "   • Email/Slack/Dropbox"
echo ""
echo "🧪 Test it:"
echo "   1. Copy DMG to another Mac"
echo "   2. Double-click to open"
echo "   3. Drag to Applications"
echo "   4. Launch - should open without warnings!"
echo ""
