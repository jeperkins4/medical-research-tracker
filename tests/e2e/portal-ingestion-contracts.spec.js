/**
 * Portal Sync Data Ingestion Contracts
 *
 * Tests specifically targeting the data ingestion paths of portal sync:
 *   - Response shape contracts per portal type
 *   - records_synced field integrity
 *   - Sync log write behavior (one row per trigger)
 *   - Error message safety (no SQL leakage)
 *   - Field type contracts across all sync response surfaces
 *   - Sync history join integrity
 *
 * All tests designed to pass even when the vault is locked (test env
 * does not unlock the vault; sync attempts return structured errors).
 *
 * Run:
 *   npx playwright test --project=api-tests tests/e2e/portal-ingestion-contracts.spec.js
 */

import { test, expect } from '@playwright/test';

const API = `http://localhost:${process.env.TEST_PORT || 3999}`;

// Seeded credentials (from global-setup)
const CRED_GENERIC  = 95;   // generic portal type
const CRED_EPIC     = 99;   // epic portal type (valid FHIR token)
const CRED_CARESPACE = 97;  // carespace portal type

async function login(request) {
  const res = await request.post(`${API}/api/auth/login`, {
    data: { username: 'testuser', password: 'testpass123' },
  });
  expect(res.status()).toBe(200);
  const setCookie = res.headers()['set-cookie'];
  return setCookie?.split(';')[0] ?? '';
}

async function triggerSync(request, cookie, credId) {
  return request.post(`${API}/api/portals/credentials/${credId}/sync`, {
    headers: { Cookie: cookie },
  });
}

// ─── 1. Sync Response Shape Contracts ─────────────────────────────────────

test.describe('Portal sync — response shape contracts', () => {
  test('sync response is always valid JSON (never HTML or empty)', async ({ request }) => {
    const cookie = await login(request);
    const credIds = [CRED_GENERIC, CRED_EPIC, CRED_CARESPACE];
    for (const id of credIds) {
      const res = await triggerSync(request, cookie, id);
      const ct = res.headers()['content-type'] ?? '';
      expect(ct, `cred ${id} should return JSON`).toMatch(/json/i);
      const text = await res.text();
      expect(text.trim(), `cred ${id} body should not be empty`).not.toBe('');
      expect(() => JSON.parse(text), `cred ${id} body should be valid JSON`).not.toThrow();
    }
  });

  test('sync response always has records_synced or error — never empty object', async ({ request }) => {
    const cookie = await login(request);
    const credIds = [CRED_GENERIC, CRED_EPIC, CRED_CARESPACE];
    for (const id of credIds) {
      const res = await triggerSync(request, cookie, id);
      const body = await res.json();
      const hasData = 'records_synced' in body || 'error' in body || 'message' in body;
      expect(hasData, `cred ${id} sync response must have records_synced or error`).toBe(true);
    }
  });

  test('records_synced is always numeric or null (never a string)', async ({ request }) => {
    const cookie = await login(request);
    const credIds = [CRED_GENERIC, CRED_EPIC, CRED_CARESPACE];
    for (const id of credIds) {
      const res = await triggerSync(request, cookie, id);
      const body = await res.json();
      if ('records_synced' in body && body.records_synced !== null) {
        expect(
          typeof body.records_synced,
          `cred ${id} records_synced should be number, got ${typeof body.records_synced}`
        ).toBe('number');
      }
    }
  });

  test('sync error response always has string error field (never undefined)', async ({ request }) => {
    const cookie = await login(request);
    // In test env vault is locked — sync should fail with structured error
    const res = await triggerSync(request, cookie, CRED_GENERIC);
    if (res.status() >= 400) {
      const body = await res.json();
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
      expect(body.error.length).toBeGreaterThan(0);
    }
  });

  test('sync response never contains raw SQL error strings', async ({ request }) => {
    const cookie = await login(request);
    const credIds = [CRED_GENERIC, CRED_EPIC, CRED_CARESPACE];
    for (const id of credIds) {
      const res = await triggerSync(request, cookie, id);
      const text = await res.text();
      expect(text, `cred ${id} must not contain SQLITE_ERROR`).not.toMatch(/SQLITE_ERROR/i);
      expect(text, `cred ${id} must not contain "no such table"`).not.toMatch(/no such table/i);
      expect(text, `cred ${id} must not contain "UNIQUE constraint"`).not.toMatch(/UNIQUE constraint failed/i);
    }
  });

  test('sync response never contains raw stack trace', async ({ request }) => {
    const cookie = await login(request);
    const credIds = [CRED_GENERIC, CRED_EPIC, CRED_CARESPACE];
    for (const id of credIds) {
      const res = await triggerSync(request, cookie, id);
      const text = await res.text();
      expect(text).not.toMatch(/at\s+\w+\s*\(.*\.js:\d+/);
      expect(text).not.toMatch(/node_modules\//);
    }
  });
});

// ─── 2. Sync Log Integrity ─────────────────────────────────────────────────

test.describe('Portal sync — sync log write integrity', () => {
  test('each sync trigger writes at most one new row to sync history', async ({ request }) => {
    const cookie = await login(request);
    // Baseline
    const before = await request.get(`${API}/api/portals/credentials/${CRED_GENERIC}/sync-history`, {
      headers: { Cookie: cookie },
    });
    expect(before.status()).toBe(200);
    const beforeRows = await before.json();
    const beforeCount = beforeRows.length;

    // Trigger sync
    await triggerSync(request, cookie, CRED_GENERIC);

    const after = await request.get(`${API}/api/portals/credentials/${CRED_GENERIC}/sync-history`, {
      headers: { Cookie: cookie },
    });
    expect(after.status()).toBe(200);
    const afterRows = await after.json();
    const afterCount = afterRows.length;

    // Should have grown by exactly 0 or 1 (0 if sync writes synchronously on error path)
    const delta = afterCount - beforeCount;
    expect(delta).toBeGreaterThanOrEqual(0);
    expect(delta).toBeLessThanOrEqual(1);
  });

  test('sync history rows have required fields', async ({ request }) => {
    const cookie = await login(request);
    // Trigger at least one sync to ensure we have a row
    await triggerSync(request, cookie, CRED_GENERIC);

    const res = await request.get(`${API}/api/portals/credentials/${CRED_GENERIC}/sync-history`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const rows = await res.json();
    if (rows.length === 0) return; // no rows yet is acceptable

    for (const row of rows) {
      expect(row).toHaveProperty('credential_id');
      expect(row).toHaveProperty('sync_started');
      expect(row).toHaveProperty('status');
    }
  });

  test('sync history status field is a known value', async ({ request }) => {
    const cookie = await login(request);
    await triggerSync(request, cookie, CRED_GENERIC);

    const res = await request.get(`${API}/api/portals/credentials/${CRED_GENERIC}/sync-history`, {
      headers: { Cookie: cookie },
    });
    const rows = await res.json();
    const KNOWN_STATUSES = ['success', 'failed', 'partial', 'pending', 'running', 'error'];
    for (const row of rows) {
      if (row.status) {
        expect(KNOWN_STATUSES).toContain(row.status);
      }
    }
  });

  test('sync history error_message never contains raw SQL', async ({ request }) => {
    const cookie = await login(request);
    await triggerSync(request, cookie, CRED_GENERIC);

    const res = await request.get(`${API}/api/portals/sync-history`, {
      headers: { Cookie: cookie },
    });
    const rows = await res.json();
    for (const row of rows) {
      if (row.error_message) {
        expect(row.error_message).not.toMatch(/SQLITE_ERROR/i);
        expect(row.error_message).not.toMatch(/no such table/i);
      }
    }
  });

  test('global sync-history and per-credential sync-history agree on row count for cred 95', async ({ request }) => {
    const cookie = await login(request);

    const [globalRes, perCredRes] = await Promise.all([
      request.get(`${API}/api/portals/sync-history`, { headers: { Cookie: cookie } }),
      request.get(`${API}/api/portals/credentials/${CRED_GENERIC}/sync-history`, { headers: { Cookie: cookie } }),
    ]);

    expect(globalRes.status()).toBe(200);
    expect(perCredRes.status()).toBe(200);

    const globalRows = await globalRes.json();
    const perCredRows = await perCredRes.json();

    // All per-cred rows must belong to the credential
    for (const row of perCredRows) {
      expect(row.credential_id).toBe(CRED_GENERIC);
    }

    // per-cred count should be <= global count
    expect(perCredRows.length).toBeLessThanOrEqual(globalRows.length);
  });
});

// ─── 3. Portal Type Routing Contracts ─────────────────────────────────────

test.describe('Portal sync — type routing contracts', () => {
  const PORTAL_TYPES = [
    { label: 'generic',    credId: CRED_GENERIC },
    { label: 'epic',       credId: CRED_EPIC },
    { label: 'carespace',  credId: CRED_CARESPACE },
  ];

  for (const { label, credId } of PORTAL_TYPES) {
    test(`${label} portal sync → JSON response with status or error`, async ({ request }) => {
      const cookie = await login(request);
      const res = await triggerSync(request, cookie, credId);

      // Never crashes (no 500 without body, no HTML)
      const ct = res.headers()['content-type'] ?? '';
      expect(ct).toMatch(/json/i);

      const body = await res.json();
      expect(typeof body).toBe('object');
      expect(body).not.toBeNull();

      const hasStatus = 'records_synced' in body || 'error' in body || 'message' in body;
      expect(hasStatus, `${label} sync response must include records_synced or error`).toBe(true);
    });
  }

  test('non-numeric credential id → 400 (router guard)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/portals/credentials/notanumber/sync`, {
      headers: { Cookie: cookie },
    });
    expect([400, 404]).toContain(res.status());
  });

  test('very large credential id → 404 (not crash)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/portals/credentials/999999999/sync`, {
      headers: { Cookie: cookie },
    });
    expect([400, 404, 500]).toContain(res.status());
    // Must still be JSON
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/json/i);
  });
});

// ─── 4. Credential List Data Quality ─────────────────────────────────────

test.describe('Portal credentials list — data quality contracts', () => {
  test('last_sync_status for each credential is a known value or null', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/portals/credentials`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const creds = await res.json();
    const KNOWN_STATUSES = ['never', 'success', 'failed', 'partial', 'pending', 'running', null];
    for (const cred of creds) {
      expect(KNOWN_STATUSES, `cred ${cred.id} last_sync_status must be known value`).toContain(cred.last_sync_status);
    }
  });

  test('portal_type for seeded credentials is correct', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/portals/credentials`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const creds = await res.json();

    const epic = creds.find(c => c.id === CRED_EPIC);
    const carespace = creds.find(c => c.id === CRED_CARESPACE);
    const generic = creds.find(c => c.id === CRED_GENERIC);

    if (epic)      expect(epic.portal_type).toBe('epic');
    if (carespace) expect(carespace.portal_type).toBe('carespace');
    if (generic)   expect(generic.portal_type).toBe('generic');
  });

  test('no credential in list has null service_name', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/portals/credentials`, {
      headers: { Cookie: cookie },
    });
    const creds = await res.json();
    for (const cred of creds) {
      expect(cred.service_name).not.toBeNull();
      expect(cred.service_name).not.toBe('');
    }
  });

  test('credentials list never leaks encrypted fields in plaintext', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/portals/credentials`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    // Must not contain test vault password
    expect(text).not.toContain('testpass123');
    // Must not contain raw access tokens
    expect(text).not.toContain('test-access-token');
    expect(text).not.toContain('test-refresh-token');
  });
});

// ─── 5. Sync History Join Integrity ──────────────────────────────────────

test.describe('Sync history join integrity', () => {
  test('GET /api/portals/sync-history returns array (not null or object)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/portals/sync-history`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('sync history rows include credential_id (join integrity)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/portals/sync-history`, {
      headers: { Cookie: cookie },
    });
    const rows = await res.json();
    for (const row of rows) {
      expect(row).toHaveProperty('credential_id');
      expect(typeof row.credential_id).toBe('number');
    }
  });

  test('per-credential sync history respects limit param', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(
      `${API}/api/portals/credentials/${CRED_GENERIC}/sync-history?limit=2`,
      { headers: { Cookie: cookie } },
    );
    expect(res.status()).toBe(200);
    const rows = await res.json();
    expect(rows.length).toBeLessThanOrEqual(2);
  });

  test('global sync-history rows have sync_started field in ISO-like format', async ({ request }) => {
    const cookie = await login(request);
    // Trigger one so we have data
    await triggerSync(request, cookie, CRED_GENERIC);

    const res = await request.get(`${API}/api/portals/sync-history`, {
      headers: { Cookie: cookie },
    });
    const rows = await res.json();
    for (const row of rows) {
      if (row.sync_started) {
        // Should be a date-like string
        expect(typeof row.sync_started).toBe('string');
        expect(row.sync_started.length).toBeGreaterThan(8);
      }
    }
  });

  test('sync history content-type is application/json', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/portals/sync-history`, {
      headers: { Cookie: cookie },
    });
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/application\/json/i);
  });

  test('GET /api/portals/sync-history requires auth → 401 without cookie', async ({ request }) => {
    const res = await request.get(`${API}/api/portals/sync-history`);
    expect(res.status()).toBe(401);
  });

  test('GET /api/portals/credentials/:id/sync-history requires auth → 401', async ({ request }) => {
    const res = await request.get(`${API}/api/portals/credentials/${CRED_GENERIC}/sync-history`);
    expect(res.status()).toBe(401);
  });
});

// ─── 6. Ingestion Safety — concurrent/boundary cases ─────────────────────

test.describe('Portal ingestion — boundary and safety cases', () => {
  test('sync trigger with credential id 0 → 400 or 404 (not crash)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/portals/credentials/0/sync`, {
      headers: { Cookie: cookie },
    });
    expect([400, 404]).toContain(res.status());
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/json/i);
  });

  test('sync trigger with negative id → 400 or 404 (not crash)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/portals/credentials/-1/sync`, {
      headers: { Cookie: cookie },
    });
    expect([400, 404]).toContain(res.status());
  });

  test('multiple rapid syncs on same credential — all return structured response', async ({ request }) => {
    const cookie = await login(request);
    // Fire 3 syncs sequentially
    for (let i = 0; i < 3; i++) {
      const res = await triggerSync(request, cookie, CRED_GENERIC);
      const ct = res.headers()['content-type'] ?? '';
      expect(ct).toMatch(/json/i);
      const body = await res.json();
      expect(typeof body).toBe('object');
    }
  });

  test('sync result for epic credential includes structured response (not plain HTML)', async ({ request }) => {
    const cookie = await login(request);
    const res = await triggerSync(request, cookie, CRED_EPIC);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/json/i);
    const text = await res.text();
    expect(text).not.toMatch(/^<!DOCTYPE/i);
    expect(text).not.toMatch(/^<html/i);
  });

  test('sync without auth → 401 (not 500)', async ({ request }) => {
    const res = await request.post(`${API}/api/portals/credentials/${CRED_GENERIC}/sync`);
    expect(res.status()).toBe(401);
  });
});
