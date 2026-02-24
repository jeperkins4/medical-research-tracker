/**
 * API wrapper - uses Electron IPC when available, falls back to HTTP
 * This allows seamless transition from HTTP to IPC-based architecture
 */

const isElectron = typeof window !== 'undefined' && window.electron && window.electron.db;

/**
 * Check if setup is needed
 */
export async function needsSetup() {
  if (isElectron) {
    return window.electron.db.needsSetup();
  }
  
  const res = await fetch('/api/auth/needs-setup');
  const data = await res.json();
  return data.needsSetup;
}

/**
 * Create new user
 */
export async function createUser(username, password) {
  if (isElectron) {
    return window.electron.db.createUser(username, password);
  }
  
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    credentials: 'include'
  });
  
  if (res.ok) {
    return { success: true };
  } else {
    const data = await res.json();
    return { success: false, error: data.error || 'Registration failed' };
  }
}

/**
 * Login user
 */
export async function loginUser(username, password) {
  if (isElectron) {
    return window.electron.db.verifyUser(username, password);
  }
  
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    credentials: 'include'
  });
  
  if (res.ok) {
    return { success: true };
  } else {
    const data = await res.json();
    return { success: false, error: data.error || 'Login failed' };
  }
}

/**
 * Logout user
 */
export async function logoutUser() {
  if (isElectron) {
    return window.electron.db.logout();
  }
  
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include'
  });
  
  return { success: true };
}

/**
 * Get user profile
 */
export async function getProfile() {
  if (isElectron) {
    const result = await window.electron.db.getProfile();
    return result.profile || {};
  }
  
  const res = await fetch('/api/profile', { credentials: 'include' });
  return await res.json();
}

/**
 * Update user profile
 */
export async function updateProfile(data) {
  if (isElectron) {
    return window.electron.db.updateProfile(data);
  }
  
  const res = await fetch('/api/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include'
  });
  
  return await res.json();
}

/**
 * Get conditions
 */
export async function getConditions() {
  if (isElectron) {
    const result = await window.electron.db.getConditions();
    return result.conditions || [];
  }
  
  const res = await fetch('/api/conditions', { credentials: 'include' });
  return await res.json();
}

/**
 * Add condition
 */
export async function addCondition(data) {
  if (isElectron) {
    return window.electron.db.addCondition(data);
  }
  
  const res = await fetch('/api/conditions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include'
  });
  
  return await res.json();
}

/**
 * Get medications
 */
export async function getMedications() {
  if (isElectron) {
    const result = await window.electron.db.getMedications();
    return result.medications || [];
  }
  
  const res = await fetch('/api/medications', { credentials: 'include' });
  return await res.json();
}

/**
 * Add medication
 */
export async function addMedication(data) {
  if (isElectron) {
    return window.electron.db.addMedication(data);
  }
  
  const res = await fetch('/api/medications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include'
  });
  
  return await res.json();
}

/**
 * Get vitals
 */
export async function getVitals(limit = 10) {
  if (isElectron) {
    const result = await window.electron.db.getVitals(limit);
    return result.vitals || [];
  }
  
  const res = await fetch(`/api/vitals?limit=${limit}`, { credentials: 'include' });
  return await res.json();
}

/**
 * Add vitals
 */
export async function addVitals(data) {
  if (isElectron) {
    return window.electron.db.addVitals(data);
  }
  
  const res = await fetch('/api/vitals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include'
  });
  
  return await res.json();
}

/**
 * Get health status (compatibility check)
 */
export async function getHealthStatus() {
  if (isElectron) {
    return { status: 'embedded', message: 'Using embedded database (no HTTP server)' };
  }
  
  try {
    const res = await fetch('/api/health');
    return await res.json();
  } catch (err) {
    return { status: 'offline', message: err.message };
  }
}

// ============================================================
// VAULT API (Portal Credentials Encryption)
// ============================================================

const isVaultAvailable = typeof window !== 'undefined' && window.electron && window.electron.vault;

/**
 * Get vault status (initialized, unlocked)
 */
export async function getVaultStatus() {
  if (isVaultAvailable) {
    return window.electron.vault.getStatus();
  }
  
  const res = await fetch('/api/vault/status', { credentials: 'include' });
  return await res.json();
}

/**
 * Setup master password (first time only)
 */
export async function setupVault(password) {
  if (isVaultAvailable) {
    return window.electron.vault.setup(password);
  }
  
  const res = await fetch('/api/vault/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
    credentials: 'include'
  });
  
  return await res.json();
}

/**
 * Unlock vault with master password
 */
export async function unlockVault(password) {
  if (isVaultAvailable) {
    return window.electron.vault.unlock(password);
  }
  
  const res = await fetch('/api/vault/unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
    credentials: 'include'
  });
  
  return await res.json();
}

/**
 * Lock vault (clear encryption key from memory)
 */
export async function lockVault() {
  if (isVaultAvailable) {
    return window.electron.vault.lock();
  }
  
  const res = await fetch('/api/vault/lock', {
    method: 'POST',
    credentials: 'include'
  });
  
  return await res.json();
}

/**
 * Get portal credentials (decrypted)
 */
export async function getPortalCredentials() {
  let credentials;
  
  if (isVaultAvailable) {
    credentials = await window.electron.vault.getCredentials();
  } else {
    const res = await fetch('/api/portals/credentials', { credentials: 'include' });
    credentials = await res.json();
  }
  
  // Map portal_name to service_name for UI compatibility
  return credentials.map(cred => ({
    ...cred,
    service_name: cred.portal_name || cred.service_name
  }));
}

/**
 * Save portal credential (encrypts password)
 */
export async function savePortalCredential(data) {
  // Map service_name to portal_name for database compatibility
  const mappedData = {
    ...data,
    portal_name: data.service_name || data.portal_name,
    service_name: undefined // Remove to avoid confusion
  };
  
  if (isVaultAvailable) {
    return window.electron.vault.saveCredential(mappedData);
  }
  
  const res = await fetch('/api/portals/credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mappedData),
    credentials: 'include'
  });
  
  return await res.json();
}

/**
 * Delete portal credential
 */
export async function deletePortalCredential(id) {
  if (isVaultAvailable) {
    return window.electron.vault.deleteCredential(id);
  }
  
  const res = await fetch(`/api/portals/credentials/${id}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  
  return await res.json();
}

/**
 * Sync portal (scrape and import records)
 */
export async function syncPortal(credentialId) {
  const isPortalSyncAvailable = typeof window !== 'undefined' && window.electron && window.electron.portal;
  
  if (isPortalSyncAvailable) {
    return window.electron.portal.sync(credentialId);
  }
  
  const res = await fetch(`/api/portals/credentials/${credentialId}/sync`, {
    method: 'POST',
    credentials: 'include'
  });
  
  return await res.json();
}

// ============================================================
// GENOMICS API
// ============================================================

const isGenomicsAvailable = typeof window !== 'undefined' && window.electron && window.electron.genomics;

/**
 * Get genomic dashboard data
 */
export async function getGenomicDashboard() {
  if (isGenomicsAvailable) {
    return window.electron.genomics.getDashboard();
  }
  
  const res = await fetch('/api/genomics/dashboard', { credentials: 'include' });
  return await res.json();
}

/**
 * Get mutation details by ID
 */
export async function getMutationDetails(mutationId) {
  if (isGenomicsAvailable) {
    return window.electron.genomics.getMutation(mutationId);
  }
  
  const res = await fetch(`/api/genomics/mutations/${mutationId}`, { credentials: 'include' });
  return await res.json();
}

/**
 * Add genomic mutation
 */
export async function addGenomicMutation(data) {
  if (isGenomicsAvailable) {
    return window.electron.genomics.addMutation(data);
  }
  
  const res = await fetch('/api/genomics/mutations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include'
  });
  
  return await res.json();
}

/**
 * Add therapy for mutation
 */
export async function addMutationTherapy(data) {
  if (isGenomicsAvailable) {
    return window.electron.genomics.addTherapy(data);
  }
  
  const res = await fetch('/api/genomics/therapies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include'
  });
  
  return await res.json();
}

// Foundation One PDF import (Electron IPC only for parsing; web uses multipart upload)
export async function importFoundationOneMutations(mutations, replaceExisting = false) {
  if (typeof window !== 'undefined' && window.electron?.genomics?.importMutations) {
    return window.electron.genomics.importMutations(mutations, replaceExisting);
  }
  const res = await fetch('/api/genomics/import-mutations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ mutations, replaceExisting }),
  });
  return res.json();
}
