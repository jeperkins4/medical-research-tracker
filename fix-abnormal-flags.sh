#!/bin/bash
# Migration script to add HIGH/LOW flags to existing test results

DB_PATH="./data/health.db"

echo "Starting migration to add HIGH/LOW flags..."
echo ""

# Get count of records to process
TOTAL=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM test_results WHERE notes LIKE '%Normal range:%';")
echo "Found $TOTAL test results with reference ranges"
echo ""

# Export to temp file for processing
sqlite3 "$DB_PATH" -header -csv "SELECT id, test_name, result, notes FROM test_results WHERE notes LIKE '%Normal range:%' ORDER BY date DESC" > /tmp/test_results.csv

# Process with awk/Python
python3 << 'PYTHON_SCRIPT'
import sqlite3
import re
import sys

db = sqlite3.connect('./data/health.db')
cursor = db.cursor()

cursor.execute("SELECT id, test_name, result, notes FROM test_results WHERE notes LIKE '%Normal range:%' ORDER BY date DESC")
results = cursor.fetchall()

updated = 0
skipped = 0
errors = 0

for row in results:
    try:
        row_id, test_name, result, notes = row
        
        # Skip if already flagged
        if ' HIGH' in result or ' LOW' in result:
            skipped += 1
            continue
        
        # Parse value from result
        value_match = re.search(r'([\d.]+)', result)
        if not value_match:
            print(f"  ⚠️  Could not parse value from: {test_name} = {result}")
            skipped += 1
            continue
        value = float(value_match.group(1))
        
        # Parse reference range from notes
        range_match = re.search(r'Normal range:\s*([\d.]+)\s*[-–]\s*([\d.]+)', notes)
        if not range_match:
            print(f"  ⚠️  Could not parse range from notes: {test_name}")
            skipped += 1
            continue
        
        normal_low = float(range_match.group(1))
        normal_high = float(range_match.group(2))
        
        # Determine if out of range
        flag = None
        if value < normal_low:
            flag = ' LOW'
        elif value > normal_high:
            flag = ' HIGH'
        
        # Update if flagged
        if flag:
            new_result = result + flag
            cursor.execute("UPDATE test_results SET result = ? WHERE id = ?", (new_result, row_id))
            print(f"  ✓ {test_name}: {result} → {new_result}")
            updated += 1
        else:
            skipped += 1
            
    except Exception as e:
        print(f"  ✗ Error processing {test_name}: {e}")
        errors += 1

db.commit()
db.close()

print(f"\n=== Migration Complete ===")
print(f"Updated: {updated}")
print(f"Skipped: {skipped}")
print(f"Errors: {errors}")
print(f"Total: {len(results)}")
PYTHON_SCRIPT

echo ""
echo "Done!"
