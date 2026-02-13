/**
 * Migration script to add HIGH/LOW flags to existing test results
 * that don't have them but should based on reference ranges
 */

import { query, run } from './server/db.js';

console.log('Starting migration to add HIGH/LOW flags...\n');

// Get all test results with reference ranges
const results = query(`
  SELECT id, test_name, result, notes 
  FROM test_results 
  WHERE notes LIKE '%Normal range:%'
  ORDER BY date DESC
`);

console.log(`Found ${results.length} test results with reference ranges\n`);

let updatedCount = 0;
let skippedCount = 0;
let errorCount = 0;

for (const row of results) {
  try {
    // Skip if already flagged
    if (row.result.includes(' HIGH') || row.result.includes(' LOW')) {
      skippedCount++;
      continue;
    }
    
    // Parse the value from result (e.g., "13.3 g/dL" → 13.3)
    const valueMatch = row.result.match(/([\d.]+)/);
    if (!valueMatch) {
      console.log(`  ⚠️  Could not parse value from: ${row.test_name} = ${row.result}`);
      skippedCount++;
      continue;
    }
    const value = parseFloat(valueMatch[1]);
    
    // Parse reference range from notes (e.g., "Normal range: 14-18 g/dL")
    const rangeMatch = row.notes.match(/Normal range:\s*([\d.]+)\s*[-–]\s*([\d.]+)/);
    if (!rangeMatch) {
      console.log(`  ⚠️  Could not parse range from notes: ${row.test_name}`);
      skippedCount++;
      continue;
    }
    
    const normalLow = parseFloat(rangeMatch[1]);
    const normalHigh = parseFloat(rangeMatch[2]);
    
    // Determine if out of range
    let flag = null;
    if (value < normalLow) {
      flag = ' LOW';
    } else if (value > normalHigh) {
      flag = ' HIGH';
    }
    
    // Update if flagged
    if (flag) {
      const newResult = row.result + flag;
      run(`UPDATE test_results SET result = ? WHERE id = ?`, [newResult, row.id]);
      console.log(`  ✓ ${row.test_name}: ${row.result} → ${newResult}`);
      updatedCount++;
    } else {
      skippedCount++;
    }
    
  } catch (error) {
    console.error(`  ✗ Error processing ${row.test_name}: ${error.message}`);
    errorCount++;
  }
}

console.log(`\n=== Migration Complete ===`);
console.log(`Updated: ${updatedCount}`);
console.log(`Skipped: ${skippedCount}`);
console.log(`Errors: ${errorCount}`);
console.log(`Total: ${results.length}`);
