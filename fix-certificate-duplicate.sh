#!/bin/bash

# Fix Certificate Duplicate Issue
# Removes the duplicate Developer ID certificate from System.keychain
# (keeps the one in login.keychain-db)

set -e

echo "🔍 Certificate Duplicate Fix"
echo "=============================="
echo ""

CERT_NAME="Developer ID Application: John Perkins (7UU4H2GZAW)"

echo "Checking for duplicate certificates..."
echo ""

# List all matches
echo "Current certificates found:"
security find-certificate -c "Developer ID Application: John Perkins" -a | grep "keychain:" || echo "None found"

echo ""
echo "This script will:"
echo "  ✅ KEEP: Certificate in login.keychain-db (needed for signing)"
echo "  ❌ DELETE: Certificate in System.keychain (causing ambiguity)"
echo ""
echo "⚠️  You will be prompted for your admin password."
echo ""

read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "🗑️  Deleting certificate from System.keychain..."

# Delete from System.keychain (requires sudo)
sudo security delete-certificate -c "$CERT_NAME" /Library/Keychains/System.keychain 2>&1 || {
    echo ""
    echo "⚠️  Failed to delete certificate. Possible reasons:"
    echo "   • Certificate doesn't exist in System.keychain (that's OK!)"
    echo "   • Permission denied"
    echo ""
}

echo ""
echo "✅ Verifying fix..."
echo ""

# Check what's left
MATCHES=$(security find-certificate -c "Developer ID Application: John Perkins" -a | grep -c "keychain:" || echo "0")

echo "Certificates found: $MATCHES"
security find-certificate -c "Developer ID Application: John Perkins" -a | grep "keychain:" || echo "None found"

if [ "$MATCHES" = "1" ]; then
    echo ""
    echo "✅ SUCCESS! Only one certificate remains (in login.keychain-db)"
    echo ""
    echo "You can now run:"
    echo "  ./build-notarized-fixed.sh"
else
    echo ""
    echo "⚠️  Still seeing $MATCHES certificates. Manual cleanup may be needed."
fi
