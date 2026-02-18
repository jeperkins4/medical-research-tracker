#!/bin/bash

# Enhanced Medication Manager Setup Script
# Automates setup of the medication tracking system

set -e  # Exit on error

echo "🔧 Enhanced Medication Manager Setup"
echo "====================================="
echo ""

# Check if database exists
DB_PATH="data/health-secure.db"
if [ ! -f "$DB_PATH" ]; then
  echo "⚠️  Database not found at $DB_PATH"
  echo "Please run the app first to create the database, or specify a different path."
  exit 1
fi

echo "✅ Database found: $DB_PATH"
echo ""

# Backup current database
BACKUP_DIR="backups/pre-medication-manager"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/health-$(date +%Y%m%d-%H%M%S).db"
cp "$DB_PATH" "$BACKUP_FILE"
echo "✅ Backup created: $BACKUP_FILE"
echo ""

# Run migration
echo "📊 Running database migration..."
sqlite3 "$DB_PATH" < server/migrations/011-enhanced-medications.sql

if [ $? -eq 0 ]; then
  echo "✅ Migration completed successfully!"
else
  echo "❌ Migration failed. Database has been preserved."
  exit 1
fi

echo ""

# Verify tables were created
echo "🔍 Verifying new tables..."
TABLES=$(sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('medications_enhanced', 'medication_research', 'medication_log');")

if echo "$TABLES" | grep -q "medications_enhanced"; then
  echo "  ✅ medications_enhanced"
else
  echo "  ❌ medications_enhanced (MISSING)"
fi

if echo "$TABLES" | grep -q "medication_research"; then
  echo "  ✅ medication_research"
else
  echo "  ❌ medication_research (MISSING)"
fi

if echo "$TABLES" | grep -q "medication_log"; then
  echo "  ✅ medication_log"
else
  echo "  ❌ medication_log (MISSING)"
fi

echo ""

# Check if old data was migrated
OLD_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM medications WHERE 1;" 2>/dev/null || echo "0")
NEW_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM medications_enhanced WHERE 1;" 2>/dev/null || echo "0")

echo "📦 Data migration:"
echo "  Old medications table: $OLD_COUNT records"
echo "  New medications_enhanced table: $NEW_COUNT records"

if [ "$OLD_COUNT" -gt 0 ] && [ "$NEW_COUNT" -ge "$OLD_COUNT" ]; then
  echo "  ✅ Data migrated successfully!"
elif [ "$OLD_COUNT" -eq 0 ]; then
  echo "  ℹ️  No existing data to migrate (fresh install)"
else
  echo "  ⚠️  Warning: Migration may have missed some records"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update server/index.js (see MEDICATION-MANAGER-SETUP.md)"
echo "2. Update src/App.jsx (see MEDICATION-MANAGER-SETUP.md)"
echo "3. Restart the server: npm run dev"
echo ""
echo "📚 Full documentation: MEDICATION-MANAGER-SETUP.md"
