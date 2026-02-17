/**
 * Migration: Add notify_on_sync column to portal_credentials
 * Date: 2026-02-15
 * 
 * Fixes: "table portal_credentials has no column named notify_on_sync" error
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

console.log('🔧 Running migration: Add notify_on_sync column...');

const db = new Database(dbPath);
db.pragma(`key = "${DB_KEY}"`);
db.pragma('cipher_compatibility = 4');

try {
  const columns = db.prepare("PRAGMA table_info(portal_credentials)").all();
  const hasColumn = columns.some(col => col.name === 'notify_on_sync');
  
  if (hasColumn) {
    console.log('✅ Column notify_on_sync already exists, skipping migration');
  } else {
    db.exec(`
      ALTER TABLE portal_credentials 
      ADD COLUMN notify_on_sync INTEGER DEFAULT 1;
    `);
    console.log('✅ Added notify_on_sync column to portal_credentials');
  }
  
  db.close();
  console.log('✅ Migration completed successfully');
  process.exit(0);
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  db.close();
  process.exit(1);
}
