/**
 * Migration: Add remaining sync columns to portal_credentials
 * Date: 2026-02-15
 * 
 * Adds all missing sync-related columns at once:
 * - sync_day_of_month
 * - sync_on_open  
 * - sync_status
 */

import Database from 'better-sqlite3-multiple-ciphers';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dataDir = join(__dirname, '..', '..', 'data');
const dbPath = join(dataDir, 'health-secure.db');

const DB_KEY = process.env.DB_ENCRYPTION_KEY;

if (!DB_KEY) {
  console.error('❌ DB_ENCRYPTION_KEY environment variable is required');
  process.exit(1);
}

console.log('🔧 Running migration: Add remaining sync columns...');

const db = new Database(dbPath);
db.pragma(`key = "${DB_KEY}"`);
db.pragma('cipher_compatibility = 4');

try {
  const columns = db.prepare("PRAGMA table_info(portal_credentials)").all();
  const existingColumns = columns.map(col => col.name);
  
  const columnsToAdd = [
    { name: 'sync_day_of_month', sql: "ADD COLUMN sync_day_of_month INTEGER DEFAULT 1" },
    { name: 'sync_on_open', sql: "ADD COLUMN sync_on_open INTEGER DEFAULT 0" },
    { name: 'sync_status', sql: "ADD COLUMN sync_status TEXT DEFAULT 'idle'" }
  ];
  
  let added = 0;
  
  for (const col of columnsToAdd) {
    if (!existingColumns.includes(col.name)) {
      db.exec(`ALTER TABLE portal_credentials ${col.sql};`);
      console.log(`  ✅ Added ${col.name}`);
      added++;
    } else {
      console.log(`  → ${col.name} already exists, skipping`);
    }
  }
  
  db.close();
  
  if (added > 0) {
    console.log(`✅ Migration completed: Added ${added} column(s)`);
  } else {
    console.log('✅ All columns already exist, no changes needed');
  }
  
  process.exit(0);
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  db.close();
  process.exit(1);
}
