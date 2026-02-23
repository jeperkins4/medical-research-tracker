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
    db = new Database(dbPath);
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
    SELECT id, portal_name, username, password_encrypted, url, notes, last_synced
    FROM portal_credentials
    ORDER BY portal_name
  `).all();

  // Decrypt passwords
  return credentials.map(cred => ({
    ...cred,
    password: cred.password_encrypted ? decryptField(cred.password_encrypted) : null,
    password_encrypted: undefined // Remove encrypted field from response
  }));
}

/**
 * Add or update portal credential
 */
function savePortalCredential({ id, portal_name, username, password, url, notes }) {
  if (!isVaultUnlocked()) {
    throw new Error('Vault is locked. Unlock with master password first.');
  }

  const database = getDB();
  const password_encrypted = password ? encryptField(password) : null;

  if (id) {
    // Update existing
    database.prepare(`
      UPDATE portal_credentials
      SET portal_name = ?, username = ?, password_encrypted = ?, url = ?, notes = ?
      WHERE id = ?
    `).run(portal_name, username, password_encrypted, url, notes || null, id);
  } else {
    // Insert new
    const result = database.prepare(`
      INSERT INTO portal_credentials (portal_name, username, password_encrypted, url, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(portal_name, username, password_encrypted, url, notes || null);
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
  getPortalCredentials,
  savePortalCredential,
  deletePortalCredential
};
