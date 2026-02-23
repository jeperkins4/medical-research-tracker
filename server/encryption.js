/**
 * Application-Level Encryption for PHI Data
 * 
 * Since SQLCipher (better-sqlite3-multiple-ciphers) has C++20 compilation issues
 * with Electron 40.4.1, we implement transparent column-level encryption instead.
 * 
 * AES-256-GCM encryption for all PHI fields (same security as SQLCipher).
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits

/**
 * Derive encryption key from password using PBKDF2
 */
function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
}

/**
 * Encrypt text with AES-256-GCM
 * @param {string} text - Plaintext to encrypt
 * @param {string} password - Encryption password (DB_ENCRYPTION_KEY)
 * @returns {string} Base64-encoded: salt + iv + authTag + ciphertext
 */
export function encryptField(text, password = process.env.DB_ENCRYPTION_KEY) {
  if (!text) return null;
  if (!password) throw new Error('DB_ENCRYPTION_KEY not configured');

  // Generate random salt and IV
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(password, salt);

  // Encrypt
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  // Combine: salt + iv + authTag + ciphertext
  const combined = Buffer.concat([salt, iv, authTag, encrypted]);
  return combined.toString('base64');
}

/**
 * Decrypt text encrypted with encryptField()
 * @param {string} encryptedBase64 - Base64-encoded encrypted data
 * @param {string} password - Decryption password (must match encryption)
 * @returns {string} Decrypted plaintext
 */
export function decryptField(encryptedBase64, password = process.env.DB_ENCRYPTION_KEY) {
  if (!encryptedBase64) return null;
  if (!password) throw new Error('DB_ENCRYPTION_KEY not configured');

  try {
    const combined = Buffer.from(encryptedBase64, 'base64');

    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = combined.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
    );
    const ciphertext = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

    // Derive key and decrypt
    const key = deriveKey(password, salt);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);

    return decrypted.toString('utf8');
  } catch (error) {
    console.error('[Encryption] Decryption failed:', error.message);
    throw new Error('Decryption failed - wrong key or corrupted data');
  }
}

/**
 * Encrypt object fields (for JSON data)
 * @param {Object} obj - Object with fields to encrypt
 * @param {string[]} fields - Field names to encrypt
 * @returns {Object} Object with encrypted fields
 */
export function encryptObject(obj, fields) {
  if (!obj) return null;
  const encrypted = { ...obj };
  for (const field of fields) {
    if (encrypted[field]) {
      encrypted[field] = encryptField(encrypted[field]);
    }
  }
  return encrypted;
}

/**
 * Decrypt object fields
 * @param {Object} obj - Object with encrypted fields
 * @param {string[]} fields - Field names to decrypt
 * @returns {Object} Object with decrypted fields
 */
export function decryptObject(obj, fields) {
  if (!obj) return null;
  const decrypted = { ...obj };
  for (const field of fields) {
    if (decrypted[field]) {
      try {
        decrypted[field] = decryptField(decrypted[field]);
      } catch (error) {
        console.warn(`[Encryption] Failed to decrypt field '${field}':`, error.message);
        decrypted[field] = null; // Mark as corrupted
      }
    }
  }
  return decrypted;
}

/**
 * Middleware to transparently encrypt/decrypt database columns
 * 
 * Usage:
 *   const row = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);
 *   const decrypted = autoDecrypt(row, ['name', 'email', 'medical_history']);
 */
export const PHI_FIELDS = [
  // Patient data
  'name',
  'email',
  'phone',
  'address',
  'medical_history',
  'notes',
  
  // Treatment data
  'treatment_name',
  'doctor_name',
  'hospital_name',
  'medication_details',
  
  // Research data
  'study_details',
  'trial_notes'
];

export function autoEncrypt(data, fields = PHI_FIELDS) {
  return encryptObject(data, fields);
}

export function autoDecrypt(data, fields = PHI_FIELDS) {
  return decryptObject(data, fields);
}

export default {
  encryptField,
  decryptField,
  encryptObject,
  decryptObject,
  autoEncrypt,
  autoDecrypt,
  PHI_FIELDS
};
