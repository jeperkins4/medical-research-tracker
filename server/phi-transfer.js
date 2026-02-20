/**
 * PHI Data Transfer System
 * 
 * Secure encrypted export/import for transferring data between devices
 * WITHOUT cloud sync (e.g., Macbook → Mac Mini)
 * 
 * Security: AES-256-GCM with user-provided password
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32; // 256 bits

/**
 * Derive encryption key from password using scrypt
 * @param {string} password - User-provided password
 * @param {Buffer} salt - Random salt
 * @returns {Buffer} Derived key
 */
function deriveKey(password, salt) {
  return scryptSync(password, salt, KEY_LENGTH);
}

/**
 * Export entire database as encrypted JSON
 * @param {string} dbPath - Path to SQLite database
 * @param {string} password - Encryption password
 * @returns {Buffer} Encrypted export data
 */
export function exportEncrypted(dbPath, password) {
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  console.log('📦 Exporting PHI data (encrypted)...');

  // Open database
  const db = new Database(dbPath, { readonly: true });

  // Extract all tables and data
  const exportData = {};

  // Get list of all tables
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
  `).all();

  // Export each table
  for (const { name } of tables) {
    console.log(`  Exporting table: ${name}`);
    const rows = db.prepare(`SELECT * FROM ${name}`).all();
    exportData[name] = rows;
  }

  db.close();

  // Convert to JSON
  const jsonData = JSON.stringify(exportData, null, 2);
  const dataBuffer = Buffer.from(jsonData, 'utf8');

  console.log(`  Total data size: ${(dataBuffer.length / 1024).toFixed(2)} KB`);

  // Generate random salt and IV
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);

  // Derive key from password
  const key = deriveKey(password, salt);

  // Encrypt
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(dataBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Pack: [salt][iv][authTag][encrypted data]
  const packed = Buffer.concat([salt, iv, authTag, encrypted]);

  console.log(`✅ Export complete: ${(packed.length / 1024).toFixed(2)} KB encrypted`);

  return packed;
}

/**
 * Import encrypted database export
 * @param {Buffer} encryptedData - Encrypted export data
 * @param {string} password - Decryption password
 * @param {string} dbPath - Path to target database
 * @param {string} mode - 'merge' or 'replace'
 * @returns {Object} Import statistics
 */
export function importEncrypted(encryptedData, password, dbPath, mode = 'merge') {
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  console.log(`📥 Importing PHI data (mode: ${mode})...`);

  // Unpack: [salt][iv][authTag][encrypted data]
  const salt = encryptedData.slice(0, SALT_LENGTH);
  const iv = encryptedData.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = encryptedData.slice(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
  );
  const encrypted = encryptedData.slice(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  // Derive key from password
  const key = deriveKey(password, salt);

  // Decrypt
  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    const jsonData = decrypted.toString('utf8');
    const importData = JSON.parse(jsonData);

    console.log(`  Decrypted ${Object.keys(importData).length} tables`);

    // Open database
    const db = new Database(dbPath);

    const stats = {
      mode,
      tables: {},
      totalInserted: 0,
      totalUpdated: 0,
      totalSkipped: 0,
    };

    // If replace mode, clear all tables first
    if (mode === 'replace') {
      console.log('  Mode: REPLACE - Clearing existing data...');
      for (const tableName of Object.keys(importData)) {
        db.prepare(`DELETE FROM ${tableName}`).run();
      }
    }

    // Import each table
    for (const [tableName, rows] of Object.entries(importData)) {
      console.log(`  Importing table: ${tableName} (${rows.length} rows)`);

      if (!rows || rows.length === 0) {
        stats.tables[tableName] = { inserted: 0, updated: 0, skipped: 0 };
        continue;
      }

      let inserted = 0;
      let updated = 0;
      let skipped = 0;

      // Get columns from first row
      const columns = Object.keys(rows[0]);
      const placeholders = columns.map(() => '?').join(', ');

      // Check if table has PRIMARY KEY or UNIQUE constraints
      const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all();
      const pkColumns = tableInfo.filter(col => col.pk > 0).map(col => col.name);

      if (mode === 'merge' && pkColumns.length > 0) {
        // UPSERT: INSERT OR REPLACE
        const insertStmt = db.prepare(`
          INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')})
          VALUES (${placeholders})
        `);

        for (const row of rows) {
          const values = columns.map(col => row[col]);
          const result = insertStmt.run(values);
          if (result.changes > 0) {
            // Check if this was an update or insert
            // (SQLite doesn't distinguish easily, so we'll count all as inserted for simplicity)
            inserted++;
          }
        }
      } else {
        // Simple INSERT (may fail on duplicates)
        const insertStmt = db.prepare(`
          INSERT OR IGNORE INTO ${tableName} (${columns.join(', ')})
          VALUES (${placeholders})
        `);

        for (const row of rows) {
          const values = columns.map(col => row[col]);
          const result = insertStmt.run(values);
          if (result.changes > 0) {
            inserted++;
          } else {
            skipped++;
          }
        }
      }

      stats.tables[tableName] = { inserted, updated, skipped };
      stats.totalInserted += inserted;
      stats.totalUpdated += updated;
      stats.totalSkipped += skipped;
    }

    db.close();

    console.log('✅ Import complete:');
    console.log(`   Inserted: ${stats.totalInserted}`);
    console.log(`   Updated: ${stats.totalUpdated}`);
    console.log(`   Skipped: ${stats.totalSkipped}`);

    return stats;
  } catch (error) {
    if (error.message.includes('Unsupported state or unable to authenticate data')) {
      throw new Error('Invalid password or corrupted data');
    }
    throw error;
  }
}

/**
 * Express route handlers
 */

export function setupTransferRoutes(app, dbPath) {
  /**
   * POST /api/phi/export
   * Body: { password: string }
   * Returns: Binary encrypted data (download)
   */
  app.post('/api/phi/export', (req, res) => {
    try {
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({ error: 'Password required' });
      }

      const encrypted = exportEncrypted(dbPath, password);

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `health-data-export-${timestamp}.enc`;

      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(encrypted);
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/phi/import
   * Body: multipart/form-data with file and password
   * Returns: Import statistics
   */
  app.post('/api/phi/import', (req, res) => {
    try {
      const { password, mode = 'merge' } = req.body;

      if (!password) {
        return res.status(400).json({ error: 'Password required' });
      }

      if (!req.files || !req.files.file) {
        return res.status(400).json({ error: 'File required' });
      }

      const encryptedData = req.files.file.data;
      const stats = importEncrypted(encryptedData, password, dbPath, mode);

      res.json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error('Import error:', error);
      res.status(500).json({ error: error.message });
    }
  });
}
