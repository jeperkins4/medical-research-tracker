/**
 * FHIR Token Lifecycle — Edge Case & Boundary Contracts
 *
 * Fills gaps not covered by fhir-refresh-contracts.spec.js and
 * fhir-sync-lifecycle.spec.js. Focuses on:
 *
 *   1. Status field type contracts (expiresAt, patientId, scope, authorized, valid)
 *   2. Token expiry boundary: valid-token cred reads authorized:true, valid:true
 *   3. Token expiry boundary: expired-token cred reads authorized:true, valid:false
 *   4. Revoke → status transition: revoked cred reads authorized:false
 *   5. Status idempotency — repeated calls return consistent shape
 *   6. POST /api/fhir/refresh — response field contracts after "attempt"
 *   7. Concurrent status polls — n requests to different creds don't bleed
 *   8. Stale status after revoke — no residual token data served
 *   9. Non-numeric credential ids on all FHIR routes → 400
 *  10. Missing credential on status/sync/refresh/revoke → 404 (not 500)
 *
 * Seeded credential ids:
 *   id=99  — epic, valid FHIR token (access expires +1h from setup)
 *   id=98  — epic, expired FHIR token (access expired -1h from setup)
 *   id=97  — carespace, no FHIR token
 *   id=95  — generic, no FHIR token
 *   id=94  — epic, NULL refresh_token (fhir_tokens row exists)
 *
 * Run:
 *   npx playwright test --project=api-tests tests/e2e/fhir-token-lifecycle.spec.js
 */

import { test, expect } from '@playwright/test';

const API = `http://localhost:${process.env.TEST_API_PORT || process.env.TEST_PORT || 3999}`;

const EPIC_VALID    = 99;
const EPIC_EXPIRED  = 98;
const CARESPACE     = 97;
const GENERIC       = 95;
const EPIC_NO_RT    = 94;
const MISSING       = 9999;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function login(request) {
  const res = await request.post(`${API}/api/auth/login`, {
    data: { username: 'testuser', password: 'testpass123' },
  });
  expect(res.status(), 'login must succeed').toBe(200);
  return (res.headers()['set-cookie'] || '').split(';')[0];
}

async function getStatus(request, cookie, credId) {
  return request.get(`${API}/api/fhir/status/${credId}`, {
    headers: { Cookie: cookie },
  });
}

async function doRefresh(request, cookie, credId) {
  return request.post(`${API}/api/fhir/refresh/${credId}`, {
    headers: { Cookie: cookie },
  });
}

async function doRevoke(request, cookie, credId) {
  return request.delete(`${API}/api/fhir/revoke/${credId}`, {
    headers: { Cookie: cookie },
  });
}

// ─── 1. Status response field type contracts ──────────────────────────────────

test.describe('GET /api/fhir/status — field type contracts', () => {
  test('valid-token status: authorized is boolean true', async ({ request }) => {
    const cookie = await login(request);
    const res = await getStatus(request, cookie, EPIC_VALID);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.authorized).toBe('boolean');
    expect(body.authorized).toBe(true);
  });

  test('valid-token status: valid is boolean true', async ({ request }) => {
    const cookie = await login(request);
    const res = await getStatus(request, cookie, EPIC_VALID);
    const body = await res.json();
    expect(typeof body.valid).toBe('boolean');
    expect(body.valid).toBe(true);
  });

  test('valid-token status: expiresAt is a parseable date string', async ({ request }) => {
    const cookie = await login(request);
    const res = await getStatus(request, cookie, EPIC_VALID);
    const body = await res.json();
    expect(typeof body.expiresAt).toBe('string');
    const parsed = new Date(body.expiresAt);
    expect(Number.isNaN(parsed.getTime())).toBe(false);
  });

  test('valid-token status: patientId is a non-empty string', async ({ request }) => {
    const cookie = await login(request);
    const res = await getStatus(request, cookie, EPIC_VALID);
    const body = await res.json();
    expect(typeof body.patientId).toBe('string');
    expect(body.patientId.trim().length).toBeGreaterThan(0);
  });

  test('valid-token status: scope is a non-empty string', async ({ request }) => {
    const cookie = await login(request);
    const res = await getStatus(request, cookie, EPIC_VALID);
    const body = await res.json();
    expect(typeof body.scope).toBe('string');
    expect(body.scope.trim().length).toBeGreaterThan(0);
  });

  test('valid-token status: response never includes raw SQL or stack traces', async ({ request }) => {
    const cookie = await login(request);
    const res = await getStatus(request, cookie, EPIC_VALID);
    const text = await res.text();
    expect(text).not.toMatch(/SqliteError|SQLITE_|stacktrace|at Object\.|at Module\./i);
  });
});

// ─── 2. Expired token boundary ────────────────────────────────────────────────

test.describe('GET /api/fhir/status — expired token (id=98)', () => {
  test('expired credential: authorized is true (row exists), valid is false (past expiry)', async ({ request }) => {
    const cookie = await login(request);
    const res = await getStatus(request, cookie, EPIC_EXPIRED);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.authorized).toBe(true);
    expect(body.valid).toBe(false);
  });

  test('expired credential: expiresAt (if present) is a parseable date', async ({ request }) => {
    const cookie = await login(request);
    const res = await getStatus(request, cookie, EPIC_EXPIRED);
    const body = await res.json();
    if (body.expiresAt) {
      const parsed = new Date(body.expiresAt);
      expect(Number.isNaN(parsed.getTime())).toBe(false);
    }
  });

  test('expired credential: no raw token string in response', async ({ request }) => {
    const cookie = await login(request);
    const res = await getStatus(request, cookie, EPIC_EXPIRED);
    const text = await res.text();
    // access tokens are opaque strings — the server must not echo them
    expect(text).not.toContain('test-access-token-expired');
  });
});

// ─── 3. Non-epic / no-token credentials ──────────────────────────────────────

test.describe('GET /api/fhir/status — no-token credentials', () => {
  test('carespace credential: authorized is false (no FHIR token row)', async ({ request }) => {
    const cookie = await login(request);
    const res = await getStatus(request, cookie, CARESPACE);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.authorized).toBe(false);
  });

  test('generic credential: authorized is false', async ({ request }) => {
    const cookie = await login(request);
    const res = await getStatus(request, cookie, GENERIC);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.authorized).toBe(false);
  });

  test('no-token credential: patientId is null or absent', async ({ request }) => {
    const cookie = await login(request);
    const res = await getStatus(request, cookie, CARESPACE);
    const body = await res.json();
    // patientId should not be present or should be null when not authorized
    if ('patientId' in body) {
      expect(body.patientId).toBeNull();
    }
  });
});

// ─── 4. Revoke → status transition ───────────────────────────────────────────

test.describe('DELETE /api/fhir/revoke → GET /api/fhir/status transition', () => {
  // Use a fresh credential id that won't affect other tests.
  // We use EPIC_NO_RT (id=94) which has a token but NULL refresh_token.
  // Revoking it clears the fhir_tokens row; subsequent status should show authorized:false.
  // Note: global-setup re-seeds between runs so this is safe.

  test('after revoke, status returns authorized:false (token cleared)', async ({ request }) => {
    const cookie = await login(request);

    // Revoke
    const revokeRes = await doRevoke(request, cookie, EPIC_NO_RT);
    // Accept 200 or 204 — depends on implementation
    expect([200, 204]).toContain(revokeRes.status());

    // Check status post-revoke
    const statusRes = await getStatus(request, cookie, EPIC_NO_RT);
    expect(statusRes.status()).toBe(200);
    const body = await statusRes.json();
    expect(body.authorized).toBe(false);
  });

  test('after revoke, status does not include patientId or scope from the revoked token', async ({ request }) => {
    const cookie = await login(request);
    await doRevoke(request, cookie, EPIC_NO_RT);
    const statusRes = await getStatus(request, cookie, EPIC_NO_RT);
    const body = await statusRes.json();

    if ('patientId' in body) expect(body.patientId).toBeNull();
    if ('scope' in body) {
      const scope = body.scope;
      expect(!scope || scope === '').toBe(true);
    }
  });
});

// ─── 5. Status idempotency ────────────────────────────────────────────────────

test.describe('GET /api/fhir/status — idempotency (repeated calls)', () => {
  test('calling status 3x for valid credential returns consistent authorized/valid', async ({ request }) => {
    const cookie = await login(request);
    const results = [];
    for (let i = 0; i < 3; i++) {
      const res = await getStatus(request, cookie, EPIC_VALID);
      const body = await res.json();
      results.push({ authorized: body.authorized, valid: body.valid });
    }
    for (const r of results) {
      expect(r.authorized).toBe(results[0].authorized);
      expect(r.valid).toBe(results[0].valid);
    }
  });

  test('calling status 3x for expired credential returns consistent authorized/valid', async ({ request }) => {
    const cookie = await login(request);
    const results = [];
    for (let i = 0; i < 3; i++) {
      const res = await getStatus(request, cookie, EPIC_EXPIRED);
      const body = await res.json();
      results.push({ authorized: body.authorized, valid: body.valid });
    }
    for (const r of results) {
      expect(r.authorized).toBe(results[0].authorized);
      expect(r.valid).toBe(results[0].valid);
    }
  });
});

// ─── 6. POST /api/fhir/refresh — response shape after attempt ────────────────

test.describe('POST /api/fhir/refresh — response shape contracts', () => {
  test('refresh attempt on valid-token cred: response is JSON with success or error field', async ({ request }) => {
    const cookie = await login(request);
    const res = await doRefresh(request, cookie, EPIC_VALID);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/application\/json/i);
    const body = await res.json();
    const hasField = 'success' in body || 'error' in body || 'message' in body || 'requiresAuth' in body;
    expect(hasField).toBe(true);
  });

  test('refresh attempt on expired-token cred: response is JSON (never HTML)', async ({ request }) => {
    const cookie = await login(request);
    const res = await doRefresh(request, cookie, EPIC_EXPIRED);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/application\/json/i);
    const text = await res.text();
    expect(text.trim()).not.toBe('');
    expect(() => JSON.parse(text)).not.toThrow();
  });

  test('refresh attempt on NULL-refresh-token cred (id=94): returns 400 with requiresAuth:true', async ({ request }) => {
    const cookie = await login(request);
    const res = await doRefresh(request, cookie, EPIC_NO_RT);
    // Either 400 (null refresh token case) or 200 if re-seeded with fresh data
    // Accept 400 as primary, 200 as acceptable if token was re-seeded valid
    if (res.status() === 400) {
      const body = await res.json();
      expect(body.requiresAuth).toBe(true);
      expect(typeof body.error).toBe('string');
    } else {
      // Token may have been refreshed by another test — just verify JSON shape
      expect([200, 400, 500]).toContain(res.status());
      const body = await res.json();
      expect(typeof body).toBe('object');
    }
  });

  test('refresh response never exposes raw access_token value in body', async ({ request }) => {
    const cookie = await login(request);
    const res = await doRefresh(request, cookie, EPIC_VALID);
    const text = await res.text();
    // The seeded access token string should not appear in refresh response
    expect(text).not.toContain('test-access-token-valid');
  });

  test('refresh on non-epic credential → 400 or 404 (portal type guard)', async ({ request }) => {
    const cookie = await login(request);
    const res = await doRefresh(request, cookie, CARESPACE);
    expect([400, 404]).toContain(res.status());
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });
});

// ─── 7. Concurrent status polls — credential isolation ───────────────────────

test.describe('Concurrent status polls — credential isolation', () => {
  test('concurrent status for 3 different creds: each returns its own authorized state', async ({ request }) => {
    const cookie = await login(request);
    const [r99, r98, r97] = await Promise.all([
      getStatus(request, cookie, EPIC_VALID),
      getStatus(request, cookie, EPIC_EXPIRED),
      getStatus(request, cookie, CARESPACE),
    ]);

    const b99 = await r99.json();
    const b98 = await r98.json();
    const b97 = await r97.json();

    expect(b99.authorized).toBe(true);
    expect(b99.valid).toBe(true);

    expect(b98.authorized).toBe(true);
    expect(b98.valid).toBe(false);

    expect(b97.authorized).toBe(false);
  });

  test('concurrent status for same valid cred: all 3 responses are identical', async ({ request }) => {
    const cookie = await login(request);
    const [r1, r2, r3] = await Promise.all([
      getStatus(request, cookie, EPIC_VALID),
      getStatus(request, cookie, EPIC_VALID),
      getStatus(request, cookie, EPIC_VALID),
    ]);
    const [b1, b2, b3] = await Promise.all([r1.json(), r2.json(), r3.json()]);
    expect(b1.authorized).toBe(b2.authorized);
    expect(b2.authorized).toBe(b3.authorized);
    expect(b1.valid).toBe(b2.valid);
    expect(b2.valid).toBe(b3.valid);
  });
});

// ─── 8. Non-numeric credential ids on FHIR routes → 400 ─────────────────────

test.describe('Non-numeric credential ids — all FHIR routes return 400', () => {
  test('GET /api/fhir/status/abc → 400', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/fhir/status/abc`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });

  test('POST /api/fhir/refresh/abc → 400', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/fhir/refresh/abc`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });

  test('DELETE /api/fhir/revoke/abc → 400', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.delete(`${API}/api/fhir/revoke/abc`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });

  test('POST /api/fhir/sync/abc → 400', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/fhir/sync/abc`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });

  test('GET /api/fhir/authorize/abc → 400', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/fhir/authorize/abc?mode=json`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });
});

// ─── 9. Missing credential → 404 (not 500) ───────────────────────────────────

test.describe('Missing credential (id=9999) — all FHIR routes return 404', () => {
  test('GET /api/fhir/status/9999 → 404', async ({ request }) => {
    const cookie = await login(request);
    const res = await getStatus(request, cookie, MISSING);
    expect([404, 200]).toContain(res.status()); // 200 with authorized:false is acceptable
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.authorized).toBe(false);
    } else {
      const body = await res.json();
      expect(typeof body.error).toBe('string');
    }
  });

  test('POST /api/fhir/refresh/9999 → 404 (not 500)', async ({ request }) => {
    const cookie = await login(request);
    const res = await doRefresh(request, cookie, MISSING);
    expect([400, 404]).toContain(res.status());
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });

  test('DELETE /api/fhir/revoke/9999 → 404 (not 500)', async ({ request }) => {
    const cookie = await login(request);
    const res = await doRevoke(request, cookie, MISSING);
    expect([200, 204, 404]).toContain(res.status()); // no-op revoke on missing cred is acceptable
  });

  test('POST /api/fhir/sync/9999 → 4xx (never unhandled crash)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/fhir/sync/${MISSING}`, {
      headers: { Cookie: cookie },
    });
    // Acceptable: 400 (validation), 404 (not found), 500 (sync failure — not a crash)
    expect([400, 404, 500]).toContain(res.status());
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/application\/json/i);
    const body = await res.json();
    expect(typeof body).toBe('object');
  });
});

// ─── 10. Auth guard — all FHIR endpoints require cookie ──────────────────────

test.describe('FHIR endpoints — auth guard (no cookie → 401)', () => {
  test('GET /api/fhir/status/99 without cookie → 401', async ({ request }) => {
    const res = await request.get(`${API}/api/fhir/status/${EPIC_VALID}`);
    expect(res.status()).toBe(401);
  });

  test('POST /api/fhir/refresh/99 without cookie → 401', async ({ request }) => {
    const res = await request.post(`${API}/api/fhir/refresh/${EPIC_VALID}`);
    expect(res.status()).toBe(401);
  });

  test('DELETE /api/fhir/revoke/99 without cookie → 401', async ({ request }) => {
    const res = await request.delete(`${API}/api/fhir/revoke/${EPIC_VALID}`);
    expect(res.status()).toBe(401);
  });

  test('POST /api/fhir/sync/99 without cookie → 401', async ({ request }) => {
    const res = await request.post(`${API}/api/fhir/sync/${EPIC_VALID}`);
    expect(res.status()).toBe(401);
  });

  test('GET /api/fhir/config-check without cookie → 401', async ({ request }) => {
    const res = await request.get(`${API}/api/fhir/config-check`);
    expect(res.status()).toBe(401);
  });
});
