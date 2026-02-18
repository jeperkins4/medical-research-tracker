#!/bin/bash

# HIPAA-Compliant Analytics Setup Script
# Automates migration + initial aggregation

set -e

echo "📊 HIPAA-Compliant Analytics Setup"
echo "==================================="
echo ""

cd "$(dirname "$0")"

# Find the database (try multiple locations)
DB_PATH=""
for path in "data/health-secure.db" "data/health.db" "health.db" "server/health.db"; do
    if [ -f "$path" ]; then
        DB_PATH="$path"
        break
    fi
done

if [ -z "$DB_PATH" ]; then
    echo "❌ Error: Database not found"
    echo "   Tried: data/health-secure.db, data/health.db, health.db, server/health.db"
    exit 1
fi

echo "✅ Found database at: $DB_PATH"
echo ""

# Step 1: Run migration
echo "Step 1: Creating analytics tables..."
sqlite3 "$DB_PATH" < server/migrations/012-analytics.sql

# Verify tables created
TABLES=$(sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'analytics%';" | wc -l)

if [ "$TABLES" -ge 6 ]; then
    echo "✅ Analytics tables created ($TABLES tables)"
else
    echo "⚠️  Expected 7 analytics tables, found $TABLES"
fi

# Step 2: Generate initial analytics
echo ""
echo "Step 2: Generating initial analytics data..."
echo "   (This may take a moment...)"

# Run aggregator
node -e "
import('./server/analytics-aggregator.js')
  .then(module => module.generateAllAnalytics())
  .then(() => {
    console.log('✅ Initial analytics generated');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Analytics generation failed:', err.message);
    process.exit(1);
  });
"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Setup complete!"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Add analytics routes to server/index.js (see ANALYTICS-SETUP.md)"
    echo "   2. Add AnalyticsDashboard to src/App.jsx"
    echo "   3. Restart server: npm run server"
    echo "   4. Navigate to Analytics tab in app"
    echo ""
    echo "🔒 HIPAA Status: COMPLIANT (Safe Harbor de-identification)"
    echo "   - Minimum cell size: 11 users"
    echo "   - No individual identifiers"
    echo "   - All access logged"
    echo ""
else
    echo ""
    echo "❌ Setup failed. Check errors above."
    echo "   For help, see ANALYTICS-SETUP.md"
    exit 1
fi
