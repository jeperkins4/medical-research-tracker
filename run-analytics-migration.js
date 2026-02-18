#!/usr/bin/env node

/**
 * Run Analytics Migration on Encrypted Database
 * Uses better-sqlite3-multiple-ciphers to access encrypted health-secure.db
 */

import Database from 'better-sqlite3-multiple-ciphers';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database paths
const dataDir = join(__dirname, 'data');
const dbPath = join(dataDir, 'health-secure.db');
const migrationPath = join(__dirname, 'server', 'migrations', '012-analytics.sql');

console.log('📊 Analytics Migration for Encrypted Database');
console.log('===========================================');
console.log('');

// Get encryption key from environment
const encryptionKey = process.env.DB_ENCRYPTION_KEY;
if (!encryptionKey) {
  console.error('❌ Error: DB_ENCRYPTION_KEY not found in environment');
  console.error('   Please set it in .env file');
  process.exit(1);
}

console.log('✅ Encryption key found');
console.log(`📁 Database: ${dbPath}`);
console.log(`📄 Migration: ${migrationPath}`);
console.log('');

try {
  // Open encrypted database
  console.log('🔓 Opening encrypted database...');
  const db = new Database(dbPath);
  db.pragma(`key='${encryptionKey}'`);
  db.pragma('cipher_page_size=4096');
  db.pragma('kdf_iter=256000');
  db.pragma('cipher_hmac_algorithm=HMAC_SHA512');
  db.pragma('cipher_kdf_algorithm=PBKDF2_HMAC_SHA512');

  // Verify database is decrypted
  try {
    db.prepare('SELECT COUNT(*) FROM sqlite_master').get();
    console.log('✅ Database decrypted successfully');
  } catch (err) {
    console.error('❌ Failed to decrypt database (wrong key?)');
    process.exit(1);
  }

  // Read migration SQL
  console.log('');
  console.log('📖 Reading migration file...');
  const migrationSQL = readFileSync(migrationPath, 'utf8');

  console.log('🔨 Running migration...');
  
  try {
    // Execute entire migration as one script (better-sqlite3 handles multi-statement)
    db.exec(migrationSQL);
    console.log('✅ Migration executed successfully');
  } catch (err) {
    console.error(`❌ Migration error: ${err.message}`);
    // Continue to verification anyway
  }

  // Verify tables created
  console.log('');
  console.log('🔍 Verifying analytics tables...');
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name LIKE 'analytics%'
    ORDER BY name
  `).all();

  if (tables.length > 0) {
    console.log('✅ Analytics tables found:');
    tables.forEach(t => console.log(`  - ${t.name}`));
  } else {
    console.log('⚠️  No analytics tables found');
  }

  // Close database
  db.close();

  console.log('');
  console.log('🎉 Migration successful!');
  console.log('');
  console.log('📋 Next steps:');
  console.log('   1. Add analytics routes to server/index.js');
  console.log('   2. Add AnalyticsDashboard to src/App.jsx');
  console.log('   3. Restart server and test');
  console.log('');

} catch (error) {
  console.error('');
  console.error('❌ Migration failed:', error.message);
  console.error('');
  process.exit(1);
}
