#!/bin/bash

# Run Supabase migration via SQL API
# This script executes the migration SQL against your Supabase database

set -e  # Exit on error

echo "🚀 Running Supabase database migration..."
echo ""

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Check required variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
  echo "❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env"
  exit 1
fi

# Read migration file
MIGRATION_FILE="supabase/migrations/001_initial_schema.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
  echo "❌ Error: Migration file not found: $MIGRATION_FILE"
  exit 1
fi

echo "📄 Migration file: $MIGRATION_FILE"
echo "🌐 Supabase URL: $SUPABASE_URL"
echo ""

# Execute migration using psql via Supabase connection string
# Note: This requires getting the database password from Supabase dashboard

echo "⚠️  Direct SQL execution requires database password."
echo ""
echo "Please run this migration manually via Supabase Dashboard:"
echo ""
echo "1. Go to: https://supabase.com/dashboard/project/akawgrcegxycfoobikbw/editor"
echo "2. Click 'SQL Editor' → 'New query'"
echo "3. Copy/paste the contents of: $MIGRATION_FILE"
echo "4. Click 'Run'"
echo ""
echo "Or, I can show you the SQL to copy..."
echo ""

read -p "Would you like me to display the SQL? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📋 COPY EVERYTHING BELOW THIS LINE:"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  cat "$MIGRATION_FILE"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📋 COPY EVERYTHING ABOVE THIS LINE"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi

echo ""
echo "✅ Once you've run the migration, come back and I'll help test it!"
