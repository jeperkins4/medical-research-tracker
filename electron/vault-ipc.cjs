const crypto = require('crypto');
const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

// In-memory storage for the encryption key (cleared on app restart)
let encryptionKey = null;

// PBKDF2 configuration
const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 32; // 256 bits for AES-256
const SALT_LENGTH = 32;
const IV_LENGTH = 12; // GCM standard

let db = null;

function getDB() {
  if (!db) {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'data', 'health-secure.db');
    console.log('[Vault IPC] Opening database at:', dbPath);
    
    // Open database (will create if doesn't exist)
    db = new Database(dbPath);
    
    // Verify vault tables exist
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='vault_master'").all();
    if (tables.length === 0) {
      console.error('[Vault IPC] vault_master table not found! Creating it now...');
      // Create vault tables if they don't exist (should be created by db-ipc.cjs, but just in case)
      db.exec(`
        CREATE TABLE IF NOT EXISTS vault_master (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          password_hash TEXT NOT NULL,
          salt TEXT NOT NULL,
          iterations INTEGER DEFAULT 100000,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS portal_credentials (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          portal_name TEXT NOT NULL,
          username TEXT NOT NULL,
          password_encrypted TEXT,
          url TEXT,
          notes TEXT,
          last_synced TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('[Vault IPC] Vault tables created successfully');
    }
    
    // ── Schema migration: ensure portal_credentials has all expected columns ──
    // Each column gets its OWN try-catch so a failure on one never blocks the rest.
    const needed = [
      ['service_name',          'TEXT'],
      ['username_encrypted',    'TEXT'],
      ['notes_encrypted',       'TEXT'],
      ['totp_secret_encrypted', 'TEXT'],
      ['updated_at',            'TEXT DEFAULT CURRENT_TIMESTAMP'],
      ['last_sync',             'TEXT'],
      ['last_sync_status',      "TEXT DEFAULT 'never'"],
      ['portal_type',           "TEXT DEFAULT 'generic'"],
      ['base_url',              'TEXT'],
      ['mfa_method',            "TEXT DEFAULT 'none'"],
    ];
    let existingCols;
    try {
      existingCols = new Set(
        db.prepare('PRAGMA table_info(portal_credentials)').all().map(c => c.name)
      );
    } catch (e) {
      console.error('[Vault IPC] Could not read portal_credentials schema:', e.message);
      existingCols = new Set();
    }
    for (const [col, def] of needed) {
      if (!existingCols.has(col)) {
        try {
          db.exec(`ALTER TABLE portal_credentials ADD COLUMN ${col} ${def}`);
          console.log(`[Vault IPC] Migration: added portal_credentials.${col}`);
          existingCols.add(col); // keep set in sync
        } catch (colErr) {
          // "duplicate column name" is fine — means it exists already
          if (!colErr.message.includes('duplicate column')) {
            console.error(`[Vault IPC] Migration failed for ${col}:`, colErr.message);
          }
        }
      }
    }
    // Backfill old column names → new column names
    try {
      db.exec("UPDATE portal_credentials SET service_name = portal_name WHERE service_name IS NULL AND portal_name IS NOT NULL");
      db.exec("UPDATE portal_credentials SET base_url = url WHERE base_url IS NULL AND url IS NOT NULL");
      db.exec("UPDATE portal_credentials SET username_encrypted = username WHERE username_encrypted IS NULL AND username IS NOT NULL");
    } catch (backfillErr) {
      console.warn('[Vault IPC] Backfill skipped:', backfillErr.message);
    }
    console.log('[Vault IPC] Database opened successfully');
  }
  return db;
}

/**
 * Generate a cryptographically secure random salt
 */
function generateSalt() {
  return crypto.randomBytes(SALT_LENGTH).toString('base64');
}

/**
 * Derive encryption key from password using PBKDF2
 */
function deriveKey(password, salt) {
  const saltBuffer = Buffer.from(salt, 'base64');
  return crypto.pbkdf2Sync(password, saltBuffer, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Hash password for verification (separate from encryption key)
 */
function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, Buffer.from(salt, 'base64'), PBKDF2_ITERATIONS, 64, 'sha512').toString('base64');
}

/**
 * Check if master password has been set up
 */
function isVaultInitialized() {
  const database = getDB();
  const result = database.prepare('SELECT COUNT(*) as count FROM vault_master').get();
  return result.count > 0;
}

/**
 * Check if vault is currently unlocked
 */
function isVaultUnlocked() {
  return encryptionKey !== null;
}

/**
 * Auto-unlock vault using user's login password
 * Called after successful login
 */
function autoUnlockVault(password) {
  try {
    const database = getDB();
    
    // Check if vault is initialized
    const vaultRow = database.prepare('SELECT * FROM vault_master WHERE id = 1').get();
    
    if (!vaultRow) {
      // Vault not initialized - set it up with the login password
      console.log('[Vault IPC] Auto-initializing vault with login password');
      const salt = generateSalt();
      const passwordHash = hashPassword(password, salt);
      
      database.prepare(`
        INSERT INTO vault_master (id, password_hash, salt, iterations)
        VALUES (1, ?, ?, ?)
      `).run(passwordHash, salt, PBKDF2_ITERATIONS);
      
      // Derive and store encryption key
      encryptionKey = deriveKey(password, salt);
      console.log('[Vault IPC] Vault auto-initialized and unlocked');
      return { success: true };
    }
    
    // Vault exists - verify password and unlock
    const providedHash = hashPassword(password, vaultRow.salt);
    
    if (providedHash !== vaultRow.password_hash) {
      console.error('[Vault IPC] Auto-unlock failed - password mismatch');
      return { success: false, error: 'Password mismatch' };
    }
    
    // Derive encryption key and store in memory
    encryptionKey = deriveKey(password, vaultRow.salt);
    console.log('[Vault IPC] Vault auto-unlocked successfully');
    
    return { success: true };
    
  } catch (error) {
    console.error('[Vault IPC] Auto-unlock error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get vault status
 */
function getVaultStatus() {
  return {
    initialized: isVaultInitialized(),
    unlocked: isVaultUnlocked()
  };
}

/**
 * Set up master password (first time only)
 */
function setupMasterPassword(password) {
  if (isVaultInitialized()) {
    throw new Error('Master password already set. Use reset if needed.');
  }

  if (!password || password.length < 8) {
    throw new Error('Master password must be at least 8 characters');
  }

  const salt = generateSalt();
  const passwordHash = hashPassword(password, salt);

  const database = getDB();
  database.prepare(
    'INSERT INTO vault_master (password_hash, salt, iterations) VALUES (?, ?, ?)'
  ).run(passwordHash, salt, PBKDF2_ITERATIONS);

  // Auto-unlock after setup
  const key = deriveKey(password, salt);
  encryptionKey = key;

  return { success: true };
}

/**
 * Verify master password and load encryption key into memory
 */
function unlockVault(password) {
  if (!isVaultInitialized()) {
    throw new Error('Master password not set up. Run setup first.');
  }

  const database = getDB();
  const vaultData = database.prepare('SELECT password_hash, salt FROM vault_master WHERE id = 1').get();
  
  const passwordHash = hashPassword(password, vaultData.salt);

  if (passwordHash !== vaultData.password_hash) {
    throw new Error('Invalid master password');
  }

  // Derive and store encryption key in memory
  const key = deriveKey(password, vaultData.salt);
  encryptionKey = key;

  return { success: true };
}

/**
 * Clear encryption key from memory (lock vault)
 */
function lockVault() {
  encryptionKey = null;
  return { success: true };
}

/**
 * Get current encryption key (throws if vault is locked)
 */
function getEncryptionKey() {
  if (!encryptionKey) {
    throw new Error('Vault is locked. Unlock with master password first.');
  }
  return encryptionKey;
}

/**
 * Encrypt a field using AES-256-GCM
 * Format: iv:authTag:ciphertext (all Base64)
 */
function encryptField(plaintext) {
  if (!plaintext) return null;

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt a field encrypted with encryptField
 */
function decryptField(ciphertext) {
  if (!ciphertext) return null;

  const key = getEncryptionKey();
  const parts = ciphertext.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted field format');
  }

  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Get portal credentials (decrypted)
 */
function getPortalCredentials() {
  if (!isVaultUnlocked()) {
    throw new Error('Vault is locked. Unlock with master password first.');
  }

  const database = getDB();
  const credentials = database.prepare(`
    SELECT id, service_name, portal_type, base_url,
           username_encrypted, password_encrypted,
           mfa_method, totp_secret_encrypted, notes_encrypted,
           last_sync, last_sync_status,
           created_at
    FROM portal_credentials
    ORDER BY service_name
  `).all();

  // Decrypt sensitive fields and normalize for UI
  return credentials.map(cred => ({
    ...cred,
    portal_name: cred.service_name,   // legacy compat for older UI code
    username: cred.username_encrypted ? (() => { try { return decryptField(cred.username_encrypted); } catch { return ''; } })() : '',
    notes: cred.notes_encrypted ? (() => { try { return decryptField(cred.notes_encrypted); } catch { return ''; } })() : '',
    url: cred.base_url,
    last_synced: cred.last_sync,      // legacy compat
    password: cred.password_encrypted ? (() => { try { return decryptField(cred.password_encrypted); } catch { return null; } })() : null,
    password_encrypted: undefined,
    username_encrypted: undefined,
    notes_encrypted: undefined,
    totp_secret_encrypted: undefined,
  }));
}

/**
 * Add or update portal credential
 */
function savePortalCredential({ id, service_name, portal_name, portal_type, base_url, url,
                                  username, password, mfa_method, notes }) {
  if (!isVaultUnlocked()) {
    throw new Error('Vault is locked. Unlock with master password first.');
  }

  const database = getDB();
  const name = service_name || portal_name || '';
  const resolvedUrl = base_url || url || null;
  const password_encrypted = password ? encryptField(password) : null;
  const username_encrypted = username ? encryptField(username) : null;
  const notes_encrypted = notes ? encryptField(notes) : null;

  if (id) {
    database.prepare(`
      UPDATE portal_credentials
      SET service_name = ?, portal_type = ?, base_url = ?,
          username_encrypted = ?, password_encrypted = ?,
          mfa_method = ?, notes_encrypted = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, portal_type || 'generic', resolvedUrl,
           username_encrypted, password_encrypted,
           mfa_method || 'none', notes_encrypted, id);
  } else {
    const result = database.prepare(`
      INSERT INTO portal_credentials
        (service_name, portal_type, base_url, username_encrypted, password_encrypted, mfa_method, notes_encrypted)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, portal_type || 'generic', resolvedUrl,
           username_encrypted, password_encrypted,
           mfa_method || 'none', notes_encrypted);
    id = result.lastInsertRowid;
  }

  return { id, success: true };
}

/**
 * Delete portal credential
 */
function deletePortalCredential(id) {
  if (!isVaultUnlocked()) {
    throw new Error('Vault is locked. Unlock with master password first.');
  }

  const database = getDB();
  database.prepare('DELETE FROM portal_credentials WHERE id = ?').run(id);
  return { success: true };
}

module.exports = {
  getVaultStatus,
  setupMasterPassword,
  unlockVault,
  lockVault,
  autoUnlockVault,
  isVaultUnlocked,
  getPortalCredentials,
  savePortalCredential,
  deletePortalCredential,
  getVault: () => ({ isUnlocked: isVaultUnlocked, decrypt: decryptField })
};
