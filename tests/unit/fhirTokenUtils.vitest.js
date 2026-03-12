/**
 * Vitest unit tests — FHIR token utility helpers
 *
 * Tests pure functions for token lifecycle management:
 *   1. Token expiry classification (valid / expired / near-expiry / null)
 *   2. Authorization URL state parameter format validation
 *   3. Token shape validation (field presence contracts)
 *   4. Refresh eligibility logic (when to auto-refresh vs. re-auth)
 *   5. FHIR credential type guard (only 'epic' type supports FHIR)
 *   6. Expiry countdown label derivation
 *   7. Token response → stored shape mapping
 *   8. Error message safety (no internal details leaked)
 *   9. Scope parsing (offline_access detection)
 *  10. Patient ID normalization
 *
 * All functions are extracted pure logic—no DB, no fetch, no IPC.
 *
 * Run:
 *   npx vitest run tests/unit/fhirTokenUtils.vitest.js
 */

import { describe, it, expect } from 'vitest';

// ─── Token Lifecycle Utilities (pure functions extracted from FHIR layer) ──────

/**
 * Classify a token record's validity state.
 *
 * @param {{ expires_at: string|null, access_token: string|null }|null} token
 * @param {Date} [now]
 * @returns {'valid'|'expired'|'near-expiry'|'missing'}
 */
function classifyTokenState(token, now = new Date()) {
  if (!token || !token.access_token || !token.expires_at) return 'missing';
  const exp = new Date(token.expires_at);
  if (isNaN(exp.getTime())) return 'missing';
  const msUntilExpiry = exp - now;
  if (msUntilExpiry <= 0) return 'expired';
  if (msUntilExpiry <= 5 * 60 * 1000) return 'near-expiry'; // within 5 min
  return 'valid';
}

/**
 * Returns human-readable expiry label.
 * Mirrors the label derivation in PortalManager.jsx fhirStatus.expiresAt display.
 *
 * @param {string|null} expiresAt - ISO datetime string or null
 * @param {Date} [now]
 * @returns {string}
 */
function deriveExpiryLabel(expiresAt, now = new Date()) {
  if (!expiresAt) return 'No expiry info';
  const exp = new Date(expiresAt);
  if (isNaN(exp.getTime())) return 'Invalid date';
  const ms = exp - now;
  if (ms < 0) return 'Expired';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'Expires < 1 min';
  if (minutes < 60) return `Expires in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Expires in ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Expires in ${days}d`;
}

/**
 * Determine whether token refresh is needed before a sync.
 * Returns true if token is expired or near-expiry and refresh_token is available.
 *
 * @param {{ expires_at: string|null, refresh_token: string|null }|null} token
 * @param {Date} [now]
 * @returns {{ needsRefresh: boolean, canRefresh: boolean, requiresReauth: boolean }}
 */
function assessRefreshNeeds(token, now = new Date()) {
  if (!token || !token.expires_at) {
    return { needsRefresh: false, canRefresh: false, requiresReauth: true };
  }
  const state = classifyTokenState(token, now);
  const hasRefreshToken = Boolean(token.refresh_token);

  if (state === 'valid') {
    return { needsRefresh: false, canRefresh: hasRefreshToken, requiresReauth: false };
  }
  if (state === 'near-expiry') {
    return { needsRefresh: true, canRefresh: hasRefreshToken, requiresReauth: !hasRefreshToken };
  }
  if (state === 'expired') {
    return { needsRefresh: true, canRefresh: hasRefreshToken, requiresReauth: !hasRefreshToken };
  }
  // 'missing'
  return { needsRefresh: false, canRefresh: false, requiresReauth: true };
}

/**
 * Validate that a FHIR credential type guard allows the operation.
 *
 * @param {{ portal_type: string }|null} credential
 * @returns {boolean}
 */
function isFhirCapable(credential) {
  return credential?.portal_type === 'epic';
}

/**
 * Validate the shape of a token response from Epic's token endpoint.
 *
 * @param {object} tokenData
 * @returns {{ valid: boolean, missing: string[] }}
 */
function validateTokenResponseShape(tokenData) {
  const required = ['access_token', 'expires_in'];
  const missing = required.filter((k) => !(k in tokenData) || tokenData[k] == null);
  return { valid: missing.length === 0, missing };
}

/**
 * Check whether a scope string includes offline_access (refresh token grant).
 *
 * @param {string|null} scope
 * @returns {boolean}
 */
function scopeIncludesOfflineAccess(scope) {
  if (!scope || typeof scope !== 'string') return false;
  return scope.split(/\s+/).includes('offline_access');
}

/**
 * Normalize a patient FHIR ID from an Epic token response.
 * Epic may return it as `patient` or inside `patient_id`.
 *
 * @param {object} tokenData
 * @returns {string|null}
 */
function normalizePatientId(tokenData) {
  if (!tokenData) return null;
  const id = tokenData.patient || tokenData.patient_id || null;
  if (!id) return null;
  const s = String(id).trim();
  return s.length > 0 ? s : null;
}

/**
 * Validate OAuth state parameter format.
 * Epic requires 64 hex chars (32 bytes).
 *
 * @param {string|null} state
 * @returns {boolean}
 */
function isValidStateParam(state) {
  if (!state || typeof state !== 'string') return false;
  return /^[0-9a-f]{64}$/i.test(state);
}

/**
 * Build a safe error message for the UI — never expose raw DB or network errors.
 *
 * @param {string} rawError
 * @returns {string}
 */
function sanitizeFhirError(rawError) {
  if (!rawError || typeof rawError !== 'string') return 'An unknown error occurred';

  // Known safe error messages to pass through
  const SAFE_PATTERNS = [
    /EPIC_CLIENT_ID not configured/i,
    /Authorization expired/i,
    /Invalid state parameter/i,
    /Token exchange failed/i,
    /not authorized/i,
    /credential not found/i,
  ];

  if (SAFE_PATTERNS.some((p) => p.test(rawError))) return rawError;

  // Block internal details
  const DANGEROUS_PATTERNS = [
    /sqlite/i,
    /SQLITE/,
    /stack trace/i,
    /at [A-Za-z]+\.[A-Za-z]+/,  // JS stack frame
    /node_modules/i,
    /password/i,
    /secret/i,
    /token_value/i,
  ];

  if (DANGEROUS_PATTERNS.some((p) => p.test(rawError))) {
    return 'An authentication error occurred. Please try again.';
  }

  return rawError;
}

// ══════════════════════════════════════════════════════════════════════════════
// TESTS
// ══════════════════════════════════════════════════════════════════════════════

// ─── 1. Token State Classification ────────────────────────────────────────────

describe('classifyTokenState', () => {
  const FUTURE = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // +2h
  const PAST   = new Date(Date.now() - 60 * 1000).toISOString();          // -1min
  const NEAR   = new Date(Date.now() + 2 * 60 * 1000).toISOString();      // +2min

  it('returns valid for non-expired token', () => {
    expect(classifyTokenState({ access_token: 'tok', expires_at: FUTURE })).toBe('valid');
  });

  it('returns expired for past expires_at', () => {
    expect(classifyTokenState({ access_token: 'tok', expires_at: PAST })).toBe('expired');
  });

  it('returns near-expiry for token expiring within 5 minutes', () => {
    expect(classifyTokenState({ access_token: 'tok', expires_at: NEAR })).toBe('near-expiry');
  });

  it('returns missing for null token', () => {
    expect(classifyTokenState(null)).toBe('missing');
  });

  it('returns missing when access_token is null', () => {
    expect(classifyTokenState({ access_token: null, expires_at: FUTURE })).toBe('missing');
  });

  it('returns missing when expires_at is null', () => {
    expect(classifyTokenState({ access_token: 'tok', expires_at: null })).toBe('missing');
  });

  it('returns missing when expires_at is not a parseable date', () => {
    expect(classifyTokenState({ access_token: 'tok', expires_at: 'not-a-date' })).toBe('missing');
  });

  it('boundary: token expiring exactly now is expired', () => {
    const now = new Date();
    const justNow = new Date(now.getTime() - 1).toISOString();
    expect(classifyTokenState({ access_token: 'tok', expires_at: justNow }, now)).toBe('expired');
  });

  it('boundary: token expiring exactly at 5min boundary is near-expiry', () => {
    const now = new Date();
    const fiveMinFromNow = new Date(now.getTime() + 5 * 60 * 1000 - 1).toISOString();
    expect(classifyTokenState({ access_token: 'tok', expires_at: fiveMinFromNow }, now)).toBe('near-expiry');
  });

  it('boundary: token expiring just past 5min is valid', () => {
    const now = new Date();
    const sixMinFromNow = new Date(now.getTime() + 6 * 60 * 1000).toISOString();
    expect(classifyTokenState({ access_token: 'tok', expires_at: sixMinFromNow }, now)).toBe('valid');
  });
});

// ─── 2. Expiry Label Derivation ───────────────────────────────────────────────

describe('deriveExpiryLabel', () => {
  it('returns "No expiry info" for null', () => {
    expect(deriveExpiryLabel(null)).toBe('No expiry info');
  });

  it('returns "Invalid date" for non-parseable string', () => {
    expect(deriveExpiryLabel('garbage')).toBe('Invalid date');
  });

  it('returns "Expired" for past date', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(deriveExpiryLabel(past)).toBe('Expired');
  });

  it('returns minutes label for short future window', () => {
    const now = new Date();
    const thirtyMin = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
    expect(deriveExpiryLabel(thirtyMin, now)).toBe('Expires in 30m');
  });

  it('returns hours label for same-day expiry', () => {
    const now = new Date();
    const twoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
    expect(deriveExpiryLabel(twoHours, now)).toBe('Expires in 2h');
  });

  it('returns days label for multi-day expiry', () => {
    const now = new Date();
    const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(deriveExpiryLabel(threeDays, now)).toBe('Expires in 3d');
  });

  it('returns "Expires < 1 min" for sub-minute window', () => {
    const now = new Date();
    const almostNow = new Date(now.getTime() + 30_000).toISOString(); // 30 sec
    expect(deriveExpiryLabel(almostNow, now)).toBe('Expires < 1 min');
  });
});

// ─── 3. Refresh Assessment ────────────────────────────────────────────────────

describe('assessRefreshNeeds', () => {
  // Token rows always include access_token (classifyTokenState requires it)
  const AT = 'test-access-token';
  const FUTURE = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const PAST   = new Date(Date.now() - 60_000).toISOString();
  const NEAR   = new Date(Date.now() + 2 * 60 * 1000).toISOString();

  it('valid token + has refresh: needsRefresh=false, canRefresh=true', () => {
    const r = assessRefreshNeeds({ access_token: AT, expires_at: FUTURE, refresh_token: 'rt' });
    expect(r).toMatchObject({ needsRefresh: false, canRefresh: true, requiresReauth: false });
  });

  it('valid token + no refresh_token: needsRefresh=false, canRefresh=false', () => {
    const r = assessRefreshNeeds({ access_token: AT, expires_at: FUTURE, refresh_token: null });
    expect(r).toMatchObject({ needsRefresh: false, canRefresh: false, requiresReauth: false });
  });

  it('expired token + has refresh: needsRefresh=true, canRefresh=true, requiresReauth=false', () => {
    const r = assessRefreshNeeds({ access_token: AT, expires_at: PAST, refresh_token: 'rt' });
    expect(r).toMatchObject({ needsRefresh: true, canRefresh: true, requiresReauth: false });
  });

  it('expired token + no refresh: needsRefresh=true, requiresReauth=true', () => {
    const r = assessRefreshNeeds({ access_token: AT, expires_at: PAST, refresh_token: null });
    expect(r).toMatchObject({ needsRefresh: true, canRefresh: false, requiresReauth: true });
  });

  it('near-expiry token + has refresh: needsRefresh=true, canRefresh=true', () => {
    const r = assessRefreshNeeds({ access_token: AT, expires_at: NEAR, refresh_token: 'rt' });
    expect(r).toMatchObject({ needsRefresh: true, canRefresh: true, requiresReauth: false });
  });

  it('null token: requiresReauth=true', () => {
    const r = assessRefreshNeeds(null);
    expect(r.requiresReauth).toBe(true);
  });

  it('missing expires_at: requiresReauth=true', () => {
    const r = assessRefreshNeeds({ access_token: AT, expires_at: null, refresh_token: 'rt' });
    expect(r.requiresReauth).toBe(true);
  });
});

// ─── 4. FHIR Capability Guard ─────────────────────────────────────────────────

describe('isFhirCapable', () => {
  it('returns true for epic portal type', () => {
    expect(isFhirCapable({ portal_type: 'epic' })).toBe(true);
  });

  it('returns false for carespace portal type', () => {
    expect(isFhirCapable({ portal_type: 'carespace' })).toBe(false);
  });

  it('returns false for generic portal type', () => {
    expect(isFhirCapable({ portal_type: 'generic' })).toBe(false);
  });

  it('returns false for null credential', () => {
    expect(isFhirCapable(null)).toBe(false);
  });

  it('returns false for undefined credential', () => {
    expect(isFhirCapable(undefined)).toBe(false);
  });

  it('returns false when portal_type is missing', () => {
    expect(isFhirCapable({})).toBe(false);
  });

  it('is case-sensitive (EPIC !== epic)', () => {
    expect(isFhirCapable({ portal_type: 'EPIC' })).toBe(false);
  });
});

// ─── 5. Token Response Shape Validation ───────────────────────────────────────

describe('validateTokenResponseShape', () => {
  it('valid complete response passes', () => {
    const r = validateTokenResponseShape({
      access_token: 'at',
      expires_in: 3600,
      token_type: 'Bearer',
      patient: 'patient-fhir-id',
      scope: 'patient/Observation.read offline_access',
    });
    expect(r.valid).toBe(true);
    expect(r.missing).toHaveLength(0);
  });

  it('missing access_token fails', () => {
    const r = validateTokenResponseShape({ expires_in: 3600 });
    expect(r.valid).toBe(false);
    expect(r.missing).toContain('access_token');
  });

  it('missing expires_in fails', () => {
    const r = validateTokenResponseShape({ access_token: 'tok' });
    expect(r.valid).toBe(false);
    expect(r.missing).toContain('expires_in');
  });

  it('both missing → both listed', () => {
    const r = validateTokenResponseShape({});
    expect(r.valid).toBe(false);
    expect(r.missing).toContain('access_token');
    expect(r.missing).toContain('expires_in');
  });

  it('null values for required fields fails', () => {
    const r = validateTokenResponseShape({ access_token: null, expires_in: null });
    expect(r.valid).toBe(false);
  });

  it('optional fields (refresh_token, patient) do not affect validity', () => {
    const r = validateTokenResponseShape({ access_token: 'tok', expires_in: 3600 });
    expect(r.valid).toBe(true);
  });
});

// ─── 6. Scope Parsing ─────────────────────────────────────────────────────────

describe('scopeIncludesOfflineAccess', () => {
  it('detects offline_access in a multi-scope string', () => {
    expect(scopeIncludesOfflineAccess('patient/Observation.read offline_access launch/patient')).toBe(true);
  });

  it('returns false when offline_access is absent', () => {
    expect(scopeIncludesOfflineAccess('patient/Observation.read patient/Patient.read')).toBe(false);
  });

  it('returns false for null scope', () => {
    expect(scopeIncludesOfflineAccess(null)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(scopeIncludesOfflineAccess('')).toBe(false);
  });

  it('does not match partial substrings (offline_access_extended ≠ offline_access)', () => {
    expect(scopeIncludesOfflineAccess('offline_access_extended')).toBe(false);
  });

  it('single-scope string: offline_access alone', () => {
    expect(scopeIncludesOfflineAccess('offline_access')).toBe(true);
  });
});

// ─── 7. Patient ID Normalization ─────────────────────────────────────────────

describe('normalizePatientId', () => {
  it('extracts patient field from token response', () => {
    expect(normalizePatientId({ patient: 'T-12345' })).toBe('T-12345');
  });

  it('falls back to patient_id field', () => {
    expect(normalizePatientId({ patient_id: 'P-99999' })).toBe('P-99999');
  });

  it('patient takes precedence over patient_id', () => {
    expect(normalizePatientId({ patient: 'A', patient_id: 'B' })).toBe('A');
  });

  it('returns null when neither field is present', () => {
    expect(normalizePatientId({ access_token: 'tok' })).toBeNull();
  });

  it('returns null for null tokenData', () => {
    expect(normalizePatientId(null)).toBeNull();
  });

  it('trims whitespace from patient id', () => {
    expect(normalizePatientId({ patient: '  T-001  ' })).toBe('T-001');
  });

  it('returns null when patient is empty string', () => {
    expect(normalizePatientId({ patient: '' })).toBeNull();
  });

  it('returns null when patient is whitespace only', () => {
    expect(normalizePatientId({ patient: '   ' })).toBeNull();
  });
});

// ─── 8. State Parameter Validation ───────────────────────────────────────────

describe('isValidStateParam', () => {
  it('accepts 64-char lowercase hex string', () => {
    expect(isValidStateParam('a'.repeat(64))).toBe(true);
  });

  it('accepts 64-char mixed-case hex string', () => {
    expect(isValidStateParam('aAbBcCdD'.repeat(8))).toBe(true);
  });

  it('rejects 63-char string', () => {
    expect(isValidStateParam('a'.repeat(63))).toBe(false);
  });

  it('rejects 65-char string', () => {
    expect(isValidStateParam('a'.repeat(65))).toBe(false);
  });

  it('rejects non-hex characters', () => {
    expect(isValidStateParam('g'.repeat(64))).toBe(false);
  });

  it('rejects null', () => {
    expect(isValidStateParam(null)).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidStateParam('')).toBe(false);
  });

  it('rejects UUID format (contains hyphens)', () => {
    expect(isValidStateParam('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(false);
  });
});

// ─── 9. Error Message Sanitization ───────────────────────────────────────────

describe('sanitizeFhirError', () => {
  it('passes through EPIC_CLIENT_ID config error message', () => {
    const msg = 'EPIC_CLIENT_ID not configured. See FHIR-SETUP-GUIDE.md';
    expect(sanitizeFhirError(msg)).toBe(msg);
  });

  it('passes through Authorization expired message', () => {
    const msg = 'Authorization expired. Please try again.';
    expect(sanitizeFhirError(msg)).toBe(msg);
  });

  it('passes through Invalid state parameter message', () => {
    const msg = 'Invalid state parameter (possible CSRF attack)';
    expect(sanitizeFhirError(msg)).toBe(msg);
  });

  it('sanitizes SQLite error', () => {
    const result = sanitizeFhirError('SQLITE_ERROR: no such table: fhir_tokens');
    expect(result).not.toContain('sqlite');
    expect(result).not.toContain('fhir_tokens');
    expect(result.length).toBeGreaterThan(5);
  });

  it('sanitizes stack trace', () => {
    const result = sanitizeFhirError('Error: something\n    at Object.query (db.js:42:10)');
    expect(result).not.toContain('at Object.query');
  });

  it('sanitizes messages containing "password"', () => {
    const result = sanitizeFhirError('password validation failed for user root');
    expect(result.toLowerCase()).not.toContain('password');
  });

  it('sanitizes messages containing "secret"', () => {
    const result = sanitizeFhirError('client_secret mismatch in token exchange');
    expect(result.toLowerCase()).not.toContain('secret');
  });

  it('returns fallback for null input', () => {
    const result = sanitizeFhirError(null);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(5);
  });

  it('returns fallback for empty string', () => {
    const result = sanitizeFhirError('');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(5);
  });

  it('passes through generic user-facing error', () => {
    const msg = 'Token exchange failed: 401 Unauthorized';
    expect(sanitizeFhirError(msg)).toBe(msg);
  });
});
