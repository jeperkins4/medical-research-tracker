/**
 * Migration: Add sync_day_of_week column to portal_credentials
 * Date: 2026-02-15
 * 
 * Fixes: "table portal_credentials has no column named sync_day_of_week" error
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

console.log('🔧 Running migration: Add sync_day_of_week column...');

const db = new Database(dbPath);
db.pragma(`key = "${DB_KEY}"`);
db.pragma('cipher_compatibility = 4');

try {
  // Check if column already exists
  const columns = db.prepare("PRAGMA table_info(portal_credentials)").all();
  const hasColumn = columns.some(col => col.name === 'sync_day_of_week');
  
  if (hasColumn) {
    console.log('✅ Column sync_day_of_week already exists, skipping migration');
  } else {
    // Add the column
    db.exec(`
      ALTER TABLE portal_credentials 
      ADD COLUMN sync_day_of_week TEXT DEFAULT 'monday';
    `);
    console.log('✅ Added sync_day_of_week column to portal_credentials');
  }
  
  db.close();
  console.log('✅ Migration completed successfully');
  process.exit(0);
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  db.close();
  process.exit(1);
}
