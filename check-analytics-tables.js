/**
 * Check if analytics tables exist and create them if needed
 */

import 'dotenv/config';
import { init, query, run } from './server/db-secure.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Checking analytics tables...');

// Initialize database
await init();

// Check if analytics tables exist
const tables = query(`
  SELECT name FROM sqlite_master 
  WHERE type='table' AND name LIKE 'analytics_%'
  ORDER BY name
`);

console.log(`\nFound ${tables.length} analytics tables:`);
tables.forEach(t => console.log(`  - ${t.name}`));

if (tables.length === 0) {
  console.log('\n⚠️  No analytics tables found. Creating them now...\n');
  
  try {
    // Read and execute migration
    const migrationPath = join(__dirname, 'server', 'migrations', '012-analytics.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    // Split by semicolon and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const stmt of statements) {
      try {
        run(stmt);
      } catch (err) {
        // Ignore "table already exists" errors
        if (!err.message.includes('already exists')) {
          throw err;
        }
      }
    }
    
    // Verify tables were created
    const newTables = query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name LIKE 'analytics_%'
      ORDER BY name
    `);
    
    console.log(`✅ Created ${newTables.length} analytics tables:`);
    newTables.forEach(t => console.log(`  - ${t.name}`));
    
  } catch (error) {
    console.error('❌ Error creating analytics tables:', error.message);
    process.exit(1);
  }
} else {
  console.log('\n✅ Analytics tables already exist');
}

console.log('\n✅ Analytics tables check complete');
process.exit(0);
