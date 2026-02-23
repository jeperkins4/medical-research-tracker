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
