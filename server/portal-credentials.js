import { query, run } from './db-secure.js';
import { encryptField, decryptField, isVaultUnlocked } from './vault.js';

/**
 * Add new portal credentials
 */
export function addCredential(data) {
  if (!isVaultUnlocked()) {
    throw new Error('Vault must be unlocked to add credentials');
  }

  const {
    service_name,
    portal_type,
    base_url,
    username,
    password,
    mfa_method = 'none',
    totp_secret,
    notes,
    sync_schedule = 'manual',
    sync_time = '02:00',
    sync_day_of_week = 1,
    sync_day_of_month = 1,
    auto_sync_on_open = false,
    notify_on_sync = true
  } = data;

  // Validate required fields
  if (!service_name || !portal_type || !username || !password) {
    throw new Error('service_name, portal_type, username, and password are required');
  }

  // Encrypt sensitive fields
  const username_encrypted = encryptField(username);
  const password_encrypted = encryptField(password);
  const totp_secret_encrypted = totp_secret ? encryptField(totp_secret) : null;
  const notes_encrypted = notes ? encryptField(notes) : null;

  const result = run(`
    INSERT INTO portal_credentials (
      service_name, portal_type, base_url,
      username_encrypted, password_encrypted,
      mfa_method, totp_secret_encrypted, notes_encrypted,
      sync_schedule, sync_time, sync_day_of_week, sync_day_of_month,
      auto_sync_on_open, notify_on_sync
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    service_name, portal_type, base_url,
    username_encrypted, password_encrypted,
    mfa_method, totp_secret_encrypted, notes_encrypted,
    sync_schedule, sync_time, sync_day_of_week, sync_day_of_month,
    auto_sync_on_open ? 1 : 0, notify_on_sync ? 1 : 0
  ]);

  return { id: result.lastInsertRowid, service_name };
}

/**
 * List all credentials (without decrypted passwords)
 */
export function listCredentials() {
  const credentials = query(`
    SELECT 
      id, service_name, portal_type, base_url,
      mfa_method, last_sync, last_sync_status,
      created_at, updated_at
    FROM portal_credentials
    ORDER BY service_name
  `);

  return credentials;
}

/**
 * Get single credential with decrypted fields
 */
export function getCredential(id) {
  if (!isVaultUnlocked()) {
    throw new Error('Vault must be unlocked to access credentials');
  }

  const creds = query(`
    SELECT * FROM portal_credentials WHERE id = ?
  `, [id]);

  if (creds.length === 0) {
    throw new Error('Credential not found');
  }

  const cred = creds[0];

  // Decrypt sensitive fields
  return {
    id: cred.id,
    service_name: cred.service_name,
    portal_type: cred.portal_type,
    base_url: cred.base_url,
    username: decryptField(cred.username_encrypted),
    password: decryptField(cred.password_encrypted),
    mfa_method: cred.mfa_method,
    totp_secret: cred.totp_secret_encrypted ? decryptField(cred.totp_secret_encrypted) : null,
    notes: cred.notes_encrypted ? decryptField(cred.notes_encrypted) : null,
    last_sync: cred.last_sync,
    last_sync_status: cred.last_sync_status,
    created_at: cred.created_at,
    updated_at: cred.updated_at
  };
}

/**
 * Update credential
 */
export function updateCredential(id, data) {
  if (!isVaultUnlocked()) {
    throw new Error('Vault must be unlocked to update credentials');
  }

  const updates = [];
  const params = [];

  if (data.service_name) {
    updates.push('service_name = ?');
    params.push(data.service_name);
  }

  if (data.portal_type) {
    updates.push('portal_type = ?');
    params.push(data.portal_type);
  }

  if (data.base_url !== undefined) {
    updates.push('base_url = ?');
    params.push(data.base_url);
  }

  if (data.username) {
    updates.push('username_encrypted = ?');
    params.push(encryptField(data.username));
  }

  if (data.password) {
    updates.push('password_encrypted = ?');
    params.push(encryptField(data.password));
  }

  if (data.mfa_method) {
    updates.push('mfa_method = ?');
    params.push(data.mfa_method);
  }

  if (data.totp_secret !== undefined) {
    updates.push('totp_secret_encrypted = ?');
    params.push(data.totp_secret ? encryptField(data.totp_secret) : null);
  }

  if (data.notes !== undefined) {
    updates.push('notes_encrypted = ?');
    params.push(data.notes ? encryptField(data.notes) : null);
  }

  if (data.sync_schedule !== undefined) {
    updates.push('sync_schedule = ?');
    params.push(data.sync_schedule);
  }

  if (data.sync_time !== undefined) {
    updates.push('sync_time = ?');
    params.push(data.sync_time);
  }

  if (data.sync_day_of_week !== undefined) {
    updates.push('sync_day_of_week = ?');
    params.push(data.sync_day_of_week);
  }

  if (data.sync_day_of_month !== undefined) {
    updates.push('sync_day_of_month = ?');
    params.push(data.sync_day_of_month);
  }

  if (data.auto_sync_on_open !== undefined) {
    updates.push('auto_sync_on_open = ?');
    params.push(data.auto_sync_on_open ? 1 : 0);
  }

  if (data.notify_on_sync !== undefined) {
    updates.push('notify_on_sync = ?');
    params.push(data.notify_on_sync ? 1 : 0);
  }

  if (updates.length === 0) {
    throw new Error('No fields to update');
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);

  run(`
    UPDATE portal_credentials
    SET ${updates.join(', ')}
    WHERE id = ?
  `, params);

  return { success: true };
}

/**
 * Delete credential
 */
export function deleteCredential(id) {
  run('DELETE FROM portal_credentials WHERE id = ?', [id]);
  return { success: true };
}

/**
 * Update last sync status
 */
export function updateSyncStatus(id, status, recordsImported = 0, errorMessage = null) {
  run(`
    UPDATE portal_credentials
    SET last_sync = CURRENT_TIMESTAMP,
        last_sync_status = ?
    WHERE id = ?
  `, [status, id]);

  // Also log to sync history
  run(`
    INSERT INTO portal_sync_log (
      credential_id, sync_started, sync_completed,
      status, records_imported, error_message
    ) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, ?, ?)
  `, [id, status, recordsImported, errorMessage]);

  return { success: true };
}

/**
 * Get sync history for a credential
 */
export function getSyncHistory(credentialId, limit = 20) {
  return query(`
    SELECT * FROM portal_sync_log
    WHERE credential_id = ?
    ORDER BY sync_started DESC
    LIMIT ?
  `, [credentialId, limit]);
}

/**
 * Get all sync history
 */
export function getAllSyncHistory(limit = 50) {
  return query(`
    SELECT 
      psl.*,
      pc.service_name,
      pc.portal_type
    FROM portal_sync_log psl
    JOIN portal_credentials pc ON psl.credential_id = pc.id
    ORDER BY psl.sync_started DESC
    LIMIT ?
  `, [limit]);
}
