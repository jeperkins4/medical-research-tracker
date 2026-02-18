#!/bin/bash

# Build & Notarize Script for MyTreatmentPath
# This script builds a signed and notarized macOS app

set -e  # Exit on error

echo "🚀 MyTreatmentPath Build & Notarization Script"
echo "================================================"
echo ""

# Check if credentials are set
if [ -z "$APPLE_ID" ] || [ -z "$APPLE_APP_SPECIFIC_PASSWORD" ]; then
    echo "⚠️  Apple credentials not found in environment variables"
    echo ""
    echo "Looking for credentials file..."
    
    if [ -f ~/.notarize-credentials ]; then
        echo "✅ Found ~/.notarize-credentials"
        echo "   Loading credentials..."
        source ~/.notarize-credentials
    else
        echo "❌ No credentials file found at ~/.notarize-credentials"
        echo ""
        echo "To set up notarization:"
        echo "1. Create app-specific password at https://appleid.apple.com/"
        echo "2. Create ~/.notarize-credentials with:"
        echo ""
        echo "   export APPLE_ID=\"your-apple-id@email.com\""
        echo "   export APPLE_APP_SPECIFIC_PASSWORD=\"xxxx-xxxx-xxxx-xxxx\""
        echo "   export APPLE_TEAM_ID=\"7UU4H2GZAW\""
        echo ""
        echo "3. Re-run this script"
        echo ""
        read -p "Continue without notarization? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
        echo "⚠️  Building signed app WITHOUT notarization..."
    fi
fi

echo ""
echo "📋 Build Configuration:"
echo "   Product: MyTreatmentPath"
echo "   Version: 0.1.0"
echo "   Identity: John Perkins (7UU4H2GZAW)"

if [ -n "$APPLE_ID" ]; then
    echo "   Apple ID: $APPLE_ID"
    echo "   Team ID: ${APPLE_TEAM_ID:-7UU4H2GZAW}"
    echo "   Notarization: ENABLED ✅"
else
    echo "   Notarization: DISABLED ⚠️"
fi

echo ""
echo "⏱️  This will take 5-20 minutes (depending on notarization)..."
echo ""

# Clean previous builds
if [ -d "build" ]; then
    echo "🧹 Cleaning previous build..."
    rm -rf build/*.app build/*.dmg build/*.zip
fi

# Run Vite build
echo "📦 Building frontend (Vite)..."
npm run build

# Run Electron Builder
echo "🔨 Building Electron app..."
if [ -n "$APPLE_ID" ]; then
    echo "   This includes notarization - please be patient!"
fi

npm run electron:build:mac

# Check if build succeeded
if [ -f "build/MyTreatmentPath.app/Contents/MacOS/MyTreatmentPath" ]; then
    echo ""
    echo "✅ Build complete!"
    echo ""
    echo "📍 Build artifacts:"
    ls -lh build/*.dmg build/*.zip 2>/dev/null || echo "   (no distributable files found)"
    
    # Verify notarization
    if [ -n "$APPLE_ID" ]; then
        echo ""
        echo "🔍 Verifying notarization..."
        if spctl -a -vvv -t install build/MyTreatmentPath.app 2>&1 | grep -q "Notarized Developer ID"; then
            echo "✅ App is properly notarized!"
        else
            echo "⚠️  App may not be notarized. Check output above."
        fi
    fi
    
    echo ""
    echo "📤 Ready to distribute:"
    if [ -f "build/MyTreatmentPath-0.1.0.dmg" ]; then
        echo "   • DMG: build/MyTreatmentPath-0.1.0.dmg"
    fi
    if [ -f "build/MyTreatmentPath-0.1.0-mac.zip" ]; then
        echo "   • ZIP: build/MyTreatmentPath-0.1.0-mac.zip"
    fi
    
    echo ""
    echo "🎉 Done! Share the DMG or ZIP file with others."
else
    echo ""
    echo "❌ Build failed! Check errors above."
    exit 1
fi
