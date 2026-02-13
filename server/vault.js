import crypto from 'crypto';
import { query, run } from './db.js';

// In-memory storage for the encryption key (cleared on server restart)
let encryptionKey = null;

// PBKDF2 configuration
const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 32; // 256 bits for AES-256
const SALT_LENGTH = 32;
const IV_LENGTH = 12; // GCM standard

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
export function isVaultInitialized() {
  const result = query('SELECT COUNT(*) as count FROM vault_master');
  return result[0].count > 0;
}

/**
 * Set up master password (first time only)
 */
export function setupMasterPassword(password) {
  if (isVaultInitialized()) {
    throw new Error('Master password already set. Use reset if needed.');
  }

  if (!password || password.length < 8) {
    throw new Error('Master password must be at least 8 characters');
  }

  const salt = generateSalt();
  const passwordHash = hashPassword(password, salt);

  run(
    'INSERT INTO vault_master (password_hash, salt, iterations) VALUES (?, ?, ?)',
    [passwordHash, salt, PBKDF2_ITERATIONS]
  );

  // Auto-unlock after setup
  const key = deriveKey(password, salt);
  encryptionKey = key;

  return { success: true };
}

/**
 * Verify master password and load encryption key into memory
 */
export function unlockVault(password) {
  if (!isVaultInitialized()) {
    throw new Error('Master password not set up. Run setup first.');
  }

  const vaultData = query('SELECT password_hash, salt FROM vault_master WHERE id = 1')[0];
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
export function lockVault() {
  encryptionKey = null;
  return { success: true };
}

/**
 * Check if vault is currently unlocked
 */
export function isVaultUnlocked() {
  return encryptionKey !== null;
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
export function encryptField(plaintext) {
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
export function decryptField(ciphertext) {
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
 * Reset vault (DANGEROUS - for testing only)
 */
export function resetVault() {
  run('DELETE FROM vault_master');
  run('DELETE FROM portal_credentials');
  run('DELETE FROM portal_sync_log');
  encryptionKey = null;
  return { success: true };
}

/**
 * Get vault status
 */
export function getVaultStatus() {
  return {
    initialized: isVaultInitialized(),
    unlocked: isVaultUnlocked()
  };
}
