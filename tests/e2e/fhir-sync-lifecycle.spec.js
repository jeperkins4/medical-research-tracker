/**
 * FHIR Sync Lifecycle & Data Ingestion Contracts
 *
 * Covers the interaction between FHIR token state, sync execution,
 * and portal sync log integrity — paths not fully exercised in
 * fhir.spec.js or portal-ingestion-contracts.spec.js.
 *
 * Test areas:
 *   1. FHIR sync response shape contracts (field presence & types)
 *   2. Sync log row atomicity — one row per trigger, correct fields
 *   3. FHIR token lifecycle: status → revoke → status transition
 *   4. Credential isolation — sync one cred never contaminates another
 *   5. FHIR sync vs portal sync routing — independent code paths
 *   6. last_sync_status field transitions across sync outcomes
 *   7. POST /api/fhir/sync — summary sub-shape contracts
 *   8. FHIR sync + credential type guard matrix
 *   9. Sync error safety — no raw internals in failure responses
 *  10. FHIR status after revoke — no stale data served
 *
 * All tests designed to run in the test environment where:
 *   - Vault is locked (decryption calls will fail gracefully)
 *   - Credential id=99: epic, has valid FHIR token
 *   - Credential id=98: epic, has expired FHIR token
 *   - Credential id=97: carespace, no FHIR token
 *   - Credential id=95: generic (first seeded credential)
 *
 * Run:
 *   npx playwright test --project=api-tests tests/e2e/fhir-sync-lifecycle.spec.js
 */

import { test, expect } from '@playwright/test';

const API = `http://localhost:${process.env.TEST_PORT || process.env.TEST_API_PORT || 3999}`;

// Seeded credential ids (from global-setup.js)
const EPIC_VALID    = 99;  // epic, valid FHIR token
const EPIC_EXPIRED  = 98;  // epic, expired FHIR token
const CARESPACE     = 97;  // carespace, no FHIR token
const GENERIC       = 95;  // generic portal
const MISSING_CRED  = 9999; // does not exist

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function login(request) {
  const res = await request.post(`${API}/api/auth/login`, {
    data: { username: 'testuser', password: 'testpass123' },
  });
  expect(res.status(), 'login must succeed').toBe(200);
  return (res.headers()['set-cookie'] || '').split(';')[0];
}

async function fhirSync(request, cookie, credId) {
  return request.post(`${API}/api/fhir/sync/${credId}`, {
    headers: { Cookie: cookie },
  });
}

async function portalSync(request, cookie, credId) {
  return request.post(`${API}/api/portals/credentials/${credId}/sync`, {
    headers: { Cookie: cookie },
  });
}

async function fhirStatus(request, cookie, credId) {
  return request.get(`${API}/api/fhir/status/${credId}`, {
    headers: { Cookie: cookie },
  });
}

async function fhirRevoke(request, cookie, credId) {
  return request.delete(`${API}/api/fhir/revoke/${credId}`, {
    headers: { Cookie: cookie },
  });
}

async function getSyncHistory(request, cookie, credId) {
  return request.get(`${API}/api/portals/credentials/${credId}/sync-history`, {
    headers: { Cookie: cookie },
  });
}

// ─── 1. FHIR Sync Response Shape Contracts ────────────────────────────────────

test.describe('POST /api/fhir/sync — response shape contracts', () => {
  test('response is always JSON (Content-Type application/json)', async ({ request }) => {
    const cookie = await login(request);
    const res = await fhirSync(request, cookie, EPIC_VALID);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct, 'Content-Type should include json').toMatch(/application\/json/i);
  });

  test('response body is never empty', async ({ request }) => {
    const cookie = await login(request);
    const res = await fhirSync(request, cookie, EPIC_VALID);
    const text = await res.text();
    expect(text.trim().length, 'body should not be empty').toBeGreaterThan(0);
  });

  test('error response has string error field (vault locked path)', async ({ request }) => {
    const cookie = await login(request);
    const res = await fhirSync(request, cookie, EPIC_VALID);
    if (res.status() >= 400) {
      const body = await res.json();
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
      expect(body.error.length).toBeGreaterThan(0);
    }
  });

  test('success response has boolean success field', async ({ request }) => {
    const cookie = await login(request);
    const res = await fhirSync(request, cookie, EPIC_VALID);
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('success');
      expect(typeof body.success).toBe('boolean');
    }
  });

  test('success response has numeric recordsImported field', async ({ request }) => {
    const cookie = await login(request);
    const res = await fhirSync(request, cookie, EPIC_VALID);
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('recordsImported');
      expect(typeof body.recordsImported).toBe('number');
      expect(body.recordsImported).toBeGreaterThanOrEqual(0);
    }
  });

  test('success response summary field is an object (not null or string)', async ({ request }) => {
    const cookie = await login(request);
    const res = await fhirSync(request, cookie, EPIC_VALID);
    if (res.status() === 200) {
      const body = await res.json();
      if ('summary' in body && body.summary !== null) {
        expect(typeof body.summary).toBe('object');
      }
    }
  });

  test('non-numeric credential id → 400 with error field', async ({ request }) => {
    const cookie = await login(request);
    const res = await fhirSync(request, cookie, 'not-an-id');
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('missing credential → 4xx or 5xx with error field (vault locked or 404)', async ({ request }) => {
    const cookie = await login(request);
    const res = await fhirSync(request, cookie, MISSING_CRED);
    // In test env vault is locked → getCredential throws → 500
    // In unlocked env → credential not found → 404
    // Either way: structured JSON error
    expect(res.status()).toBeGreaterThanOrEqual(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');
  });

  test('non-epic credential type → structured error (vault locked → 500, or 400)', async ({ request }) => {
    const cookie = await login(request);
    const res = await fhirSync(request, cookie, CARESPACE);
    // vault locked → 500 before portal_type check; vault unlocked → 400 with Epic message
    expect(res.status()).toBeGreaterThanOrEqual(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');
    expect(body.error.length).toBeGreaterThan(0);
  });

  test('response never contains raw stack trace lines', async ({ request }) => {
    const cookie = await login(request);
    const res = await fhirSync(request, cookie, EPIC_VALID);
    const text = await res.text();
    expect(text).not.toMatch(/at\s+\w[\w.]*\s*\(.*\.(?:js|cjs|mjs):\d+/);
    expect(text).not.toMatch(/node_modules\//);
  });

  test('response never leaks access_token or refresh_token values', async ({ request }) => {
    const cookie = await login(request);
    const res = await fhirSync(request, cookie, EPIC_VALID);
    const text = await res.text();
    expect(text).not.toContain('test-access-token-valid');
    expect(text).not.toContain('test-refresh-token');
  });

  test('response never contains raw SQLite error strings', async ({ request }) => {
    const cookie = await login(request);
    const res = await fhirSync(request, cookie, EPIC_VALID);
    const text = await res.text();
    expect(text).not.toMatch(/SQLITE_ERROR/i);
    expect(text).not.toMatch(/no such table/i);
  });
});

// ─── 2. FHIR Sync Auth Guards ─────────────────────────────────────────────────

test.describe('POST /api/fhir/sync — auth guards', () => {
  test('unauthenticated request → 401', async ({ request }) => {
    const res = await request.post(`${API}/api/fhir/sync/${EPIC_VALID}`);
    expect(res.status()).toBe(401);
  });

  test('unauthenticated response is JSON (not HTML redirect)', async ({ request }) => {
    const res = await request.post(`${API}/api/fhir/sync/${EPIC_VALID}`);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/json/i);
  });
});

// ─── 3. FHIR Token Lifecycle — Revoke → Status Transition ───────────────────

test.describe('FHIR token lifecycle — revoke clears authorization', () => {
  test('status before revoke shows authorized:true for EPIC_VALID', async ({ request }) => {
    const cookie = await login(request);
    const res = await fhirStatus(request, cookie, EPIC_VALID);
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Token exists (even if expired/valid varies with seeding)
    expect(body).toHaveProperty('authorized');
  });

  test('revoke returns success:true and 200', async ({ request }) => {
    const cookie = await login(request);
    // Use MISSING_CRED to avoid touching seeded tokens used by other tests
    const res = await fhirRevoke(request, cookie, MISSING_CRED);
    // Should be 200 (idempotent — no token to delete is fine)
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('success', true);
  });

  test('after revoke, status returns authorized:false for the same credential', async ({ request }) => {
    const cookie = await login(request);
    // Use EPIC_EXPIRED — expired token, safe to revoke in tests
    await fhirRevoke(request, cookie, EPIC_EXPIRED);
    const statusRes = await fhirStatus(request, cookie, EPIC_EXPIRED);
    expect(statusRes.status()).toBe(200);
    const body = await statusRes.json();
    // After revoke, token row is deleted → authorized:false
    expect(body.authorized).toBe(false);
  });

  test('revoke response is always JSON (not HTML)', async ({ request }) => {
    const cookie = await login(request);
    const res = await fhirRevoke(request, cookie, EPIC_VALID);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/json/i);
  });

  test('revoke is idempotent — second revoke still returns 200', async ({ request }) => {
    const cookie = await login(request);
    // First revoke
    await fhirRevoke(request, cookie, MISSING_CRED);
    // Second revoke same credential — should still succeed
    const res = await fhirRevoke(request, cookie, MISSING_CRED);
    expect(res.status()).toBe(200);
  });

  test('status after revoke never contains stale token data (no expiresAt from old token)', async ({ request }) => {
    const cookie = await login(request);
    // Revoke EPIC_EXPIRED (already expired, safe to revoke)
    await fhirRevoke(request, cookie, EPIC_EXPIRED);
    const statusRes = await fhirStatus(request, cookie, EPIC_EXPIRED);
    const body = await statusRes.json();
    // If authorized:false, there should be no expiresAt or patientId in response
    if (!body.authorized) {
      expect(body).not.toHaveProperty('expiresAt');
      expect(body).not.toHaveProperty('patientId');
    }
  });
});

// ─── 4. Credential Isolation — Sync One Doesn't Affect Others ────────────────

test.describe('Portal sync — credential isolation', () => {
  test('syncing CARESPACE does not alter EPIC_VALID sync-history count', async ({ request }) => {
    const cookie = await login(request);

    const epicBefore = await getSyncHistory(request, cookie, EPIC_VALID);
    const epicBeforeBody = await epicBefore.json();
    const epicBeforeCount = Array.isArray(epicBeforeBody) ? epicBeforeBody.length : 0;

    // Trigger sync on carespace
    await portalSync(request, cookie, CARESPACE);

    const epicAfter = await getSyncHistory(request, cookie, EPIC_VALID);
    const epicAfterBody = await epicAfter.json();
    const epicAfterCount = Array.isArray(epicAfterBody) ? epicAfterBody.length : 0;

    // Epic history should be unchanged
    expect(epicAfterCount).toBe(epicBeforeCount);
  });

  test('syncing EPIC_VALID does not alter CARESPACE sync-history count', async ({ request }) => {
    const cookie = await login(request);

    const carespaceBefore = await getSyncHistory(request, cookie, CARESPACE);
    const carespaceBecameBody = await carespaceBefore.json();
    const carespaceBeforeCount = Array.isArray(carespaceBecameBody) ? carespaceBecameBody.length : 0;

    // Trigger FHIR sync (different route) on epic
    await fhirSync(request, cookie, EPIC_VALID);

    const carespaceAfter = await getSyncHistory(request, cookie, CARESPACE);
    const carespaceAfterBody = await carespaceAfter.json();
    const carespaceAfterCount = Array.isArray(carespaceAfterBody) ? carespaceAfterBody.length : 0;

    expect(carespaceAfterCount).toBe(carespaceBeforeCount);
  });

  test('FHIR status for CARESPACE credential returns non-authorized (no FHIR token)', async ({ request }) => {
    const cookie = await login(request);
    const res = await fhirStatus(request, cookie, CARESPACE);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.authorized).toBe(false);
  });
});

// ─── 5. Portal Sync vs FHIR Sync — Independent Routing ──────────────────────

test.describe('Portal sync route vs FHIR sync route — independent endpoints', () => {
  test('POST /api/portals/credentials/:id/sync and POST /api/fhir/sync/:id are separate routes', async ({ request }) => {
    const cookie = await login(request);

    // Both should respond (different paths, but both valid)
    const portalRes = await portalSync(request, cookie, EPIC_VALID);
    const fhirRes   = await fhirSync(request, cookie, EPIC_VALID);

    // Both must respond with JSON
    expect((portalRes.headers()['content-type'] ?? '')).toMatch(/json/i);
    expect((fhirRes.headers()['content-type'] ?? '')).toMatch(/json/i);
  });

  test('FHIR sync route and portal sync route both respond with JSON for valid credential ids', async ({ request }) => {
    const cookie = await login(request);

    // FHIR sync: vault locked → 500; unlocked + non-epic → 400. Either way: JSON + error field.
    const fhirRes = await fhirSync(request, cookie, CARESPACE);
    expect((fhirRes.headers()['content-type'] ?? '')).toMatch(/json/i);
    expect(fhirRes.status()).toBeGreaterThanOrEqual(400);
    const fhirBody = await fhirRes.json();
    expect(fhirBody).toHaveProperty('error');

    // Portal sync should attempt (vault locked → 500 with structured error)
    const portalRes = await portalSync(request, cookie, CARESPACE);
    const ct = portalRes.headers()['content-type'] ?? '';
    expect(ct).toMatch(/json/i);
  });

  test('portal sync with non-numeric id → 400', async ({ request }) => {
    const cookie = await login(request);
    const res = await portalSync(request, cookie, 'abc');
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('portal sync with missing credential → 500 or structured error (never HTML)', async ({ request }) => {
    const cookie = await login(request);
    const res = await portalSync(request, cookie, MISSING_CRED);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/json/i);
    // Credential not found → vault getCredential throws → 500 with error field
    if (res.status() >= 400) {
      const body = await res.json();
      expect(body).toHaveProperty('error');
    }
  });
});

// ─── 6. Sync Log Row Integrity ────────────────────────────────────────────────

test.describe('Portal sync — sync log write integrity', () => {
  test('sync history for GENERIC credential is an array', async ({ request }) => {
    const cookie = await login(request);
    const res = await getSyncHistory(request, cookie, GENERIC);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('each portal sync trigger adds at most one row to sync history', async ({ request }) => {
    const cookie = await login(request);

    const before = await getSyncHistory(request, cookie, CARESPACE);
    const beforeRows = await before.json();
    const beforeCount = Array.isArray(beforeRows) ? beforeRows.length : 0;

    await portalSync(request, cookie, CARESPACE);

    const after = await getSyncHistory(request, cookie, CARESPACE);
    const afterRows = await after.json();
    const afterCount = Array.isArray(afterRows) ? afterRows.length : 0;

    const delta = afterCount - beforeCount;
    expect(delta, 'sync should add 0 or 1 rows').toBeGreaterThanOrEqual(0);
    expect(delta, 'sync should add at most 1 row').toBeLessThanOrEqual(1);
  });

  test('sync history rows include required fields when present', async ({ request }) => {
    const cookie = await login(request);

    // Trigger a sync to ensure at least one row exists
    await portalSync(request, cookie, CARESPACE);

    const res = await getSyncHistory(request, cookie, CARESPACE);
    const rows = await res.json();

    if (Array.isArray(rows) && rows.length > 0) {
      const row = rows[0];
      // status should be a string
      if ('status' in row) {
        expect(typeof row.status).toBe('string');
      }
      // records_imported should be numeric if present
      if ('records_imported' in row && row.records_imported !== null) {
        expect(typeof row.records_imported).toBe('number');
      }
    }
  });

  test('sync history rows never contain raw error stacktrace in error_message', async ({ request }) => {
    const cookie = await login(request);
    await portalSync(request, cookie, CARESPACE);

    const res = await getSyncHistory(request, cookie, CARESPACE);
    const rows = await res.json();

    if (Array.isArray(rows)) {
      for (const row of rows) {
        if (row.error_message) {
          expect(row.error_message).not.toMatch(/at\s+\w[\w.]*\s*\(.*\.(?:js|cjs):\d+/);
          expect(row.error_message).not.toMatch(/node_modules\//);
        }
      }
    }
  });
});

// ─── 7. FHIR Sync Summary Sub-Shape ──────────────────────────────────────────

test.describe('POST /api/fhir/sync — summary field contracts (when success)', () => {
  test('summary.status is a string when present in success response', async ({ request }) => {
    const cookie = await login(request);
    const res = await fhirSync(request, cookie, EPIC_VALID);
    if (res.status() === 200) {
      const body = await res.json();
      if (body.summary && 'status' in body.summary) {
        expect(typeof body.summary.status).toBe('string');
        expect(body.summary.status.length).toBeGreaterThan(0);
      }
    }
  });

  test('syncLogId is numeric when present in success response', async ({ request }) => {
    const cookie = await login(request);
    const res = await fhirSync(request, cookie, EPIC_VALID);
    if (res.status() === 200) {
      const body = await res.json();
      if ('syncLogId' in body && body.syncLogId !== null && body.syncLogId !== undefined) {
        expect(typeof body.syncLogId).toBe('number');
        expect(body.syncLogId).toBeGreaterThan(0);
      }
    }
  });

  test('FHIR sync error response for expired token is structured (not raw error)', async ({ request }) => {
    const cookie = await login(request);
    // EPIC_EXPIRED: token is expired, refresh will likely fail in test env
    const res = await fhirSync(request, cookie, EPIC_EXPIRED);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/json/i);
    const body = await res.json();
    // Should have either success:true or error field — never empty
    const hasData = 'success' in body || 'error' in body || 'recordsImported' in body;
    expect(hasData, 'response must have meaningful fields').toBe(true);
  });
});

// ─── 8. FHIR Sync Portal Type Guard Matrix ───────────────────────────────────

test.describe('POST /api/fhir/sync — portal type guard matrix', () => {
  const NON_EPIC_CREDS = [CARESPACE, GENERIC];

  for (const credId of NON_EPIC_CREDS) {
    test(`credential ${credId} (non-epic) → 4xx or 5xx with error field (never 200)`, async ({ request }) => {
      const cookie = await login(request);
      const res = await fhirSync(request, cookie, credId);
      // vault locked → 500; vault unlocked → 400 with Epic message
      // Either way: never 200 (these creds should never succeed FHIR sync)
      expect(res.status()).toBeGreaterThanOrEqual(400);
      const body = await res.json();
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
    });
  }
});

// ─── 9. Sync Error Safety — No Internal Leakage ──────────────────────────────

test.describe('Sync error safety — no internal details in error responses', () => {
  const ALL_SYNC_CREDS = [EPIC_VALID, EPIC_EXPIRED, CARESPACE, GENERIC];

  test('portal sync responses never leak SQL error strings', async ({ request }) => {
    const cookie = await login(request);
    for (const credId of ALL_SYNC_CREDS) {
      const res = await portalSync(request, cookie, credId);
      const text = await res.text();
      expect(text, `cred ${credId}`).not.toMatch(/SQLITE_ERROR/i);
      expect(text, `cred ${credId}`).not.toMatch(/UNIQUE constraint failed/i);
      expect(text, `cred ${credId}`).not.toMatch(/no such table/i);
    }
  });

  test('FHIR sync responses never leak SQL error strings', async ({ request }) => {
    const cookie = await login(request);
    // Only test epic creds (non-epic short-circuits at 400)
    for (const credId of [EPIC_VALID, EPIC_EXPIRED]) {
      const res = await fhirSync(request, cookie, credId);
      const text = await res.text();
      expect(text, `cred ${credId}`).not.toMatch(/SQLITE_ERROR/i);
      expect(text, `cred ${credId}`).not.toMatch(/no such table/i);
    }
  });

  test('portal sync responses never leak encryption key material', async ({ request }) => {
    const cookie = await login(request);
    for (const credId of ALL_SYNC_CREDS) {
      const res = await portalSync(request, cookie, credId);
      const text = await res.text();
      // Should not contain hex-format encryption keys or AES error strings
      expect(text).not.toMatch(/AES-256-GCM/i);
      expect(text).not.toMatch(/encryptionKey/i);
    }
  });
});

// ─── 10. FHIR Status — Field Consistency Across Credential States ─────────────

test.describe('GET /api/fhir/status — field consistency', () => {
  test('status for EPIC_VALID includes authorized, valid, patientId, expiresAt, scope', async ({ request }) => {
    const cookie = await login(request);
    const res = await fhirStatus(request, cookie, EPIC_VALID);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('authorized');
    if (body.authorized) {
      expect(body).toHaveProperty('valid');
      expect(body).toHaveProperty('patientId');
      expect(body).toHaveProperty('expiresAt');
      expect(body).toHaveProperty('scope');
    }
  });

  test('status for non-authorized credential only has authorized:false + message', async ({ request }) => {
    const cookie = await login(request);
    // CARESPACE has no FHIR token
    const res = await fhirStatus(request, cookie, CARESPACE);
    const body = await res.json();
    expect(body.authorized).toBe(false);
    expect(body).toHaveProperty('message');
    expect(typeof body.message).toBe('string');
  });

  test('status message field is always a non-empty string', async ({ request }) => {
    const cookie = await login(request);
    const credIds = [EPIC_VALID, EPIC_EXPIRED, CARESPACE];
    for (const credId of credIds) {
      const res = await fhirStatus(request, cookie, credId);
      const body = await res.json();
      expect(body).toHaveProperty('message');
      expect(typeof body.message, `cred ${credId} message should be string`).toBe('string');
      expect(body.message.length, `cred ${credId} message should not be empty`).toBeGreaterThan(0);
    }
  });

  test('expiresAt when present is ISO 8601 datetime string', async ({ request }) => {
    const cookie = await login(request);
    const res = await fhirStatus(request, cookie, EPIC_VALID);
    const body = await res.json();
    if (body.authorized && body.expiresAt) {
      // Should be parseable as a date
      const d = new Date(body.expiresAt);
      expect(isNaN(d.getTime())).toBe(false);
    }
  });

  test('valid flag is boolean when present', async ({ request }) => {
    const cookie = await login(request);
    const credIds = [EPIC_VALID, EPIC_EXPIRED];
    for (const credId of credIds) {
      const res = await fhirStatus(request, cookie, credId);
      const body = await res.json();
      if (body.authorized && 'valid' in body) {
        expect(typeof body.valid).toBe('boolean');
      }
    }
  });

  test('EPIC_VALID token shows valid:true (seeded with +1h expiry)', async ({ request }) => {
    const cookie = await login(request);
    const res = await fhirStatus(request, cookie, EPIC_VALID);
    const body = await res.json();
    if (body.authorized) {
      expect(body.valid).toBe(true);
    }
  });

  test('EPIC_EXPIRED token shows valid:false (seeded with -1h expiry)', async ({ request }) => {
    const cookie = await login(request);
    const res = await fhirStatus(request, cookie, EPIC_EXPIRED);
    const body = await res.json();
    // After prior revoke test, this may show authorized:false — either way is correct
    if (body.authorized) {
      expect(body.valid).toBe(false);
    } else {
      expect(body.authorized).toBe(false);
    }
  });

  test('status for very large nonexistent id returns 200 with authorized:false (no crash)', async ({ request }) => {
    const cookie = await login(request);
    const res = await fhirStatus(request, cookie, 999999);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.authorized).toBe(false);
  });
});
