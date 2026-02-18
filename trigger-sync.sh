#!/bin/bash

# Trigger CareSpace sync via API (requires running server)

API_BASE="http://localhost:3000"
USERNAME="jeperkins4"
PASSWORD="$1"  # Pass password as first argument

if [ -z "$PASSWORD" ]; then
    echo "Usage: ./trigger-sync.sh <password>"
    exit 1
fi

echo "🔐 Logging in as $USERNAME..."

# Login and get JWT token
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/api/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | sed 's/"token":"//')

if [ -z "$TOKEN" ]; then
    echo "❌ Login failed!"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

echo "✅ Logged in successfully"
echo ""
echo "🔄 Triggering CareSpace sync (this may take 30-60 seconds)..."
echo ""

# Trigger sync for credential ID 1 (CareSpace)
SYNC_RESPONSE=$(curl -s -X POST "$API_BASE/api/portals/credentials/1/sync" \
    -H "Content-Type: application/json" \
    -H "Cookie: token=$TOKEN")

echo "📊 Sync Response:"
echo "$SYNC_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$SYNC_RESPONSE"
echo ""

# Check for success
if echo "$SYNC_RESPONSE" | grep -q '"success":true'; then
    echo "✅ Sync completed successfully!"
    
    # Extract record count
    RECORDS=$(echo "$SYNC_RESPONSE" | grep -o '"recordsImported":[0-9]*' | sed 's/"recordsImported"://')
    if [ ! -z "$RECORDS" ]; then
        echo "📥 Records imported: $RECORDS"
    fi
else
    echo "⚠️  Check response above for details"
fi
