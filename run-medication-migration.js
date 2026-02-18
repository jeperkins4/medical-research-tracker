/**
 * Run medication manager database migration
 * Uses the encrypted database API
 */

import 'dotenv/config';
import { init, query, run } from './server/db-secure.js';
import { readFileSync } from 'fs';

console.log('🔧 Enhanced Medication Manager Migration');
console.log('=========================================\n');

// Initialize database
await init();
console.log('✅ Database initialized\n');

// Read migration file
const migrationSQL = readFileSync('./server/migrations/011-enhanced-medications.sql', 'utf-8');

// Remove comments and split into statements
const cleanSQL = migrationSQL
  .split('\n')
  .filter(line => !line.trim().startsWith('--'))
  .join('\n');

// Split by semicolon but preserve multi-line statements
const statements = cleanSQL
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0);

console.log(`📊 Running ${statements.length} SQL statements...\n`);

let successCount = 0;
let errorCount = 0;

for (let i = 0; i < statements.length; i++) {
  const statement = statements[i];
  
  // Skip comments and empty lines
  if (statement.startsWith('--') || statement.length === 0) continue;
  
  try {
    run(statement);
    successCount++;
    
    // Log table creation
    if (statement.includes('CREATE TABLE')) {
      const tableName = statement.match(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/i)?.[1];
      console.log(`  ✅ Created table: ${tableName}`);
    }
    
    // Log index creation
    if (statement.includes('CREATE INDEX')) {
      const indexName = statement.match(/CREATE INDEX (?:IF NOT EXISTS )?(\w+)/i)?.[1];
      console.log(`  ✅ Created index: ${indexName}`);
    }
    
    // Log trigger creation
    if (statement.includes('CREATE TRIGGER')) {
      const triggerName = statement.match(/CREATE TRIGGER (?:IF NOT EXISTS )?(\w+)/i)?.[1];
      console.log(`  ✅ Created trigger: ${triggerName}`);
    }
    
  } catch (error) {
    // Ignore "table already exists" errors
    if (error.message.includes('already exists')) {
      console.log(`  ℹ️  Skipped (already exists): ${error.message.split(':')[0]}`);
    } else {
      console.error(`  ❌ Error: ${error.message}`);
      console.error(`     Statement: ${statement.substring(0, 100)}...`);
      errorCount++;
    }
  }
}

console.log(`\n📦 Migration complete:`);
console.log(`  ✅ Successful: ${successCount}`);
console.log(`  ❌ Errors: ${errorCount}`);

// Verify tables were created
console.log('\n🔍 Verifying tables...');

const tables = ['medications_enhanced', 'medication_research', 'medication_log', 'medication_combinations'];
for (const table of tables) {
  try {
    const result = query(`SELECT COUNT(*) as count FROM ${table}`);
    console.log(`  ✅ ${table}: ${result[0].count} records`);
  } catch (error) {
    console.log(`  ❌ ${table}: NOT FOUND`);
  }
}

// Check if old data was migrated
try {
  const oldCount = query('SELECT COUNT(*) as count FROM medications')[0]?.count || 0;
  const newCount = query('SELECT COUNT(*) as count FROM medications_enhanced')[0]?.count || 0;
  
  console.log('\n📦 Data migration:');
  console.log(`  Old medications table: ${oldCount} records`);
  console.log(`  New medications_enhanced table: ${newCount} records`);
  
  if (oldCount > 0 && newCount >= oldCount) {
    console.log('  ✅ Data migrated successfully!');
  } else if (oldCount === 0) {
    console.log('  ℹ️  No existing data to migrate (fresh install)');
  } else {
    console.log('  ⚠️  Warning: Migration may have missed some records');
  }
} catch (error) {
  console.log('\n  ℹ️  Could not verify migration (old table may not exist)');
}

console.log('\n🎉 Migration complete!');
console.log('\nNext steps:');
console.log('1. Update server/index.js (add medication routes)');
console.log('2. Update src/App.jsx (add medication manager tab)');
console.log('3. Restart server: npm run dev\n');

process.exit(0);
