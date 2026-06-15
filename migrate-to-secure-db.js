/**
 * Migration Script: Plaintext DB → Encrypted DB
 * 
 * Migrates all data from the existing health.db (plaintext)
 * to the new health-secure.db (SQLCipher encrypted)
 */

import PlaintextDb from 'better-sqlite3';
import EncryptedDb from 'better-sqlite3-multiple-ciphers';
import { existsSync, copyFileSync } from 'fs';
import 'dotenv/config';

const PLAINTEXT_DB = './data/health.db';
const ENCRYPTED_DB = './data/health-secure.db';
const BACKUP_DB = `./backups/health_plaintext_${new Date().toISOString().split('T')[0]}.db`;
const DB_KEY = process.env.DB_ENCRYPTION_KEY;

console.log('🔐 MRT Database Migration: Plaintext → Encrypted (SQLCipher)\n');

// Validate encryption key
if (!DB_KEY) {
  console.error('❌ DB_ENCRYPTION_KEY environment variable is required');
  console.error('   Add to .env file: DB_ENCRYPTION_KEY=<64-char-hex-string>');
  console.error('   Generate with: openssl rand -hex 32\n');
  process.exit(1);
}

if (DB_KEY.length < 64) {
  console.error(`❌ DB_ENCRYPTION_KEY too short (${DB_KEY.length} chars, need 64)`);
  console.error('   Generate with: openssl rand -hex 32\n');
  process.exit(1);
}

// Check if source database exists
if (!existsSync(PLAINTEXT_DB)) {
  console.log('ℹ️  No existing plaintext database found.');
  console.log('   A new encrypted database will be created when the server starts.\n');
  process.exit(0);
}

// Create backup of plaintext database
console.log('📦 Step 1: Backing up plaintext database...');
copyFileSync(PLAINTEXT_DB, BACKUP_DB);
console.log(`   ✅ Backup created: ${BACKUP_DB}\n`);

// Open plaintext database (read-only)
console.log('📖 Step 2: Opening plaintext database (read-only)...');
const oldDb = new PlaintextDb(PLAINTEXT_DB, { readonly: true });
console.log('   ✅ Plaintext database opened\n');

// Create new encrypted database
console.log('🔒 Step 3: Creating encrypted database...');
const newDb = new EncryptedDb(ENCRYPTED_DB);
newDb.pragma(`key = "${DB_KEY}"`);
newDb.pragma('cipher_compatibility = 4');
newDb.pragma('foreign_keys = ON');
console.log('   ✅ Encrypted database created (AES-256)\n');

// Get list of all tables
console.log('📊 Step 4: Discovering tables...');
const tables = oldDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
console.log(`   Found ${tables.length} tables to migrate\n`);

// Migrate each table
console.log('🚚 Step 5: Migrating data...\n');
let totalRows = 0;

for (const { name } of tables) {
  console.log(`   Migrating table: ${name}`);
  
  // Get table schema
  const schema = oldDb.prepare(`SELECT sql FROM sqlite_master WHERE name = ?`).get(name);
  
  // Create table in encrypted DB
  if (schema && schema.sql) {
    try {
      newDb.exec(schema.sql);
      console.log(`     ✅ Schema created`);
    } catch (err) {
      // Table might already exist (created by db-secure.js init)
      console.log(`     ℹ️  Schema already exists`);
    }
  }
  
  // Copy data
  const rows = oldDb.prepare(`SELECT * FROM ${name}`).all();
  
  if (rows.length > 0) {
    const columns = Object.keys(rows[0]);
    const placeholders = columns.map(() => '?').join(',');
    const insertStmt = newDb.prepare(`INSERT OR IGNORE INTO ${name} (${columns.join(',')}) VALUES (${placeholders})`);
    
    // Use better-sqlite3 transaction
    const insertMany = newDb.transaction((records) => {
      for (const record of records) {
        insertStmt.run(...columns.map(col => record[col]));
      }
    });
    
    insertMany(rows);
    console.log(`     ✅ Migrated ${rows.length} rows`);
    totalRows += rows.length;
  } else {
    console.log(`     ℹ️  No data to migrate`);
  }
  
  console.log('');
}

// Close databases
oldDb.close();
newDb.close();

console.log('✅ Migration Complete!\n');
console.log(`📊 Summary:`);
console.log(`   • Total tables migrated: ${tables.length}`);
console.log(`   • Total rows migrated: ${totalRows}`);
console.log(`   • Encrypted database: ${ENCRYPTED_DB}`);
console.log(`   • Backup (plaintext): ${BACKUP_DB}\n`);

console.log('🔒 Next Steps:');
console.log('   1. Update server/index.js to use db-secure.js instead of db.js');
console.log('   2. Test the application to verify all data migrated correctly');
console.log('   3. Securely delete the plaintext backup:');
console.log(`      shred -u ${BACKUP_DB}`);
console.log(`      rm ${PLAINTEXT_DB}\n`);

console.log('⚠️  IMPORTANT: Keep DB_ENCRYPTION_KEY safe!');
console.log('   Without this key, your database cannot be decrypted.\n');
