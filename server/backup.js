/**
 * Encrypted Backup System
 * 
 * HIPAA Security Layer: Automated encrypted backups of PHI
 * Ensures data recovery without exposing plaintext
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { createReadStream, createWriteStream, readdirSync, statSync, unlinkSync } from 'fs';
import { pipeline } from 'stream/promises';
import { join } from 'path';

const BACKUP_KEY = process.env.BACKUP_ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Create encrypted backup of database
 * @param {string} dbPath - Path to source database file
 * @param {string} backupPath - Path for backup file (will be .enc)
 * @returns {Promise<string>} Path to created backup
 */
export async function createEncryptedBackup(dbPath, backupPath) {
  if (!BACKUP_KEY) {
    throw new Error('BACKUP_ENCRYPTION_KEY environment variable required');
  }
  
  if (BACKUP_KEY.length < 64) {
    throw new Error('BACKUP_ENCRYPTION_KEY must be at least 64 characters');
  }
  
  console.log(`📦 Creating encrypted backup: ${backupPath}`);
  
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, Buffer.from(BACKUP_KEY, 'hex'), iv);
  
  const input = createReadStream(dbPath);
  const output = createWriteStream(backupPath);
  
  // Write IV to start of file
  output.write(iv);
  
  // Encrypt and write database
  await pipeline(input, cipher, output, { end: false });
  
  // Write auth tag to end of file
  const authTag = cipher.getAuthTag();
  output.write(authTag);
  output.end();
  
  const stats = statSync(backupPath);
  console.log(`✅ Encrypted backup created: ${backupPath} (${(stats.size / 1024).toFixed(2)} KB)`);
  
  return backupPath;
}

/**
 * Restore database from encrypted backup
 * @param {string} backupPath - Path to encrypted backup file
 * @param {string} dbPath - Path where database should be restored
 * @returns {Promise<string>} Path to restored database
 */
export async function restoreEncryptedBackup(backupPath, dbPath) {
  if (!BACKUP_KEY) {
    throw new Error('BACKUP_ENCRYPTION_KEY environment variable required');
  }
  
  console.log(`📥 Restoring from encrypted backup: ${backupPath}`);
  
  // Read entire encrypted file
  const encryptedBuffer = await new Promise((resolve, reject) => {
    const chunks = [];
    const input = createReadStream(backupPath);
    input.on('data', chunk => chunks.push(chunk));
    input.on('end', () => resolve(Buffer.concat(chunks)));
    input.on('error', reject);
  });
  
  // Extract components
  const iv = encryptedBuffer.slice(0, IV_LENGTH);
  const authTag = encryptedBuffer.slice(encryptedBuffer.length - AUTH_TAG_LENGTH);
  const encryptedData = encryptedBuffer.slice(IV_LENGTH, encryptedBuffer.length - AUTH_TAG_LENGTH);
  
  // Decrypt
  const decipher = createDecipheriv(ALGORITHM, Buffer.from(BACKUP_KEY, 'hex'), iv);
  decipher.setAuthTag(authTag);
  
  const output = createWriteStream(dbPath);
  
  await pipeline(
    async function* () {
      yield encryptedData;
    },
    decipher,
    output
  );
  
  console.log(`✅ Database restored to: ${dbPath}`);
  return dbPath;
}

/**
 * Delete backups older than specified days
 * @param {string} backupDir - Directory containing backups
 * @param {number} retentionDays - Maximum age in days (default: 30)
 * @returns {number} Count of deleted backups
 */
export function cleanupOldBackups(backupDir, retentionDays = 30) {
  const now = Date.now();
  const maxAge = retentionDays * 24 * 60 * 60 * 1000;
  
  const files = readdirSync(backupDir);
  let deletedCount = 0;
  
  for (const file of files) {
    if (!file.endsWith('.db.enc')) continue;
    
    const filePath = join(backupDir, file);
    const stats = statSync(filePath);
    const age = now - stats.mtimeMs;
    
    if (age > maxAge) {
      unlinkSync(filePath);
      const ageInDays = Math.floor(age / (24 * 60 * 60 * 1000));
      console.log(`🗑️  Deleted old backup: ${file} (${ageInDays} days old)`);
      deletedCount++;
    }
  }
  
  if (deletedCount > 0) {
    console.log(`✅ Cleanup complete: ${deletedCount} old backups deleted`);
  }
  
  return deletedCount;
}

/**
 * List available backups
 * @param {string} backupDir - Directory containing backups
 * @returns {Array<{name: string, path: string, size: number, created: Date}>}
 */
export function listBackups(backupDir) {
  const files = readdirSync(backupDir);
  const backups = [];
  
  for (const file of files) {
    if (!file.endsWith('.db.enc')) continue;
    
    const filePath = join(backupDir, file);
    const stats = statSync(filePath);
    
    backups.push({
      name: file,
      path: filePath,
      size: stats.size,
      created: stats.mtime
    });
  }
  
  // Sort by creation date (newest first)
  backups.sort((a, b) => b.created.getTime() - a.created.getTime());
  
  return backups;
}
