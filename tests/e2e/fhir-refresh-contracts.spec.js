/**
 * FHIR Token Refresh Contracts
 *
 * Focused tests for POST /api/fhir/refresh/:credentialId — the explicit
 * token refresh endpoint. Complements fhir.spec.js (which already covers
 * the basic refresh lifecycle) with:
 *
 *  1. Input validation: non-numeric id, missing id
 *  2. Auth guard: 401 without session cookie
 *  3. Non-epic credential → 400 with meaningful error
 *  4. Missing credential → 404
 *  5. Epic credential with NO fhir_tokens row → 400, requiresAuth:true
 *  6. Epic credential with fhir_tokens row but NULL refresh_token → 400, requiresAuth:true
 *  7. Epic credential with expired access + refresh token → structured error (no raw internals)
 *  8. Response never leaks raw token material
 *  9. Response shape contracts (field types, presence)
 * 10. Repeated refresh attempts on same cred are safe (idempotent error)
 * 11. After failed refresh, status endpoint still returns correct state (no corruption)
 *
 * Seeded credentials (global-setup.js):
 *   id=99 — epic, valid FHIR token (access + refresh)
 *   id=98 — epic, expired FHIR token (has refresh_token)
 *   id=97 — carespace (not epic)
 *   id=95 — generic (not epic)
 *   id=94 — epic, FHIR token with NULL refresh_token  ← new this session
 *
 * Run:
 *   npx playwright test --project=api-tests tests/e2e/fhir-refresh-contracts.spec.js
 */

import { test, expect } from '@playwright/test';

const API = `http://localhost:${process.env.TEST_API_PORT || '3999'}`;

const EPIC_VALID     = 99;  // epic, valid token + refresh_token
const EPIC_EXPIRED   = 98;  // epic, expired token + refresh_token (stale)
const CARESPACE      = 97;  // carespace — not epic
const GENERIC        = 95;  // generic — not epic
const EPIC_NO_RT     = 94;  // epic, expired token, NULL refresh_token  ← key fixture
const MISSING_CRED   = 9999;

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function login(request) {
  const res = await request.post(`${API}/api/auth/login`, {
    data: { username: 'testuser', password: 'testpass123' },
  });
  expect(res.status(), 'login must succeed').toBe(200);
  return (res.headers()['set-cookie'] || '').split(';')[0];
}

async function refresh(request, cookie, credId) {
  return request.post(`${API}/api/fhir/refresh/${credId}`, {
    headers: { Cookie: cookie },
  });
}

async function fhirStatus(request, cookie, credId) {
  return request.get(`${API}/api/fhir/status/${credId}`, {
    headers: { Cookie: cookie },
  });
}

// ─── 1. Auth guard ─────────────────────────────────────────────────────────

test.describe('POST /api/fhir/refresh — auth guard', () => {
  test('returns 401 without auth cookie', async ({ request }) => {
    const res = await request.post(`${API}/api/fhir/refresh/${EPIC_VALID}`);
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('returns 401 with invalid/garbage auth cookie', async ({ request }) => {
    const res = await request.post(`${API}/api/fhir/refresh/${EPIC_VALID}`, {
      headers: { Cookie: 'mrt_session=not-a-real-session-token' },
    });
    expect(res.status()).toBe(401);
  });
});

// ─── 2. Input validation ──────────────────────────────────────────────────

test.describe('POST /api/fhir/refresh — input validation', () => {
  test('non-numeric credential id → 400 with error field', async ({ request }) => {
    const cookie = await login(request);
    const res = await refresh(request, cookie, 'not-a-number');
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');
  });

  test('float id string — never returns 200 (no unsafe data access)', async ({ request }) => {
    const cookie = await login(request);
    // '99.5' → parseInt returns 99 (not NaN), so it hits cred 99 normally.
    // Epic is unavailable in test env → 200 only if Epic responded, otherwise 4xx/5xx.
    // Key invariant: must not return 200 with a fabricated success.
    const res = await refresh(request, cookie, '99.5');
    // Either it proceeds to cred 99 (and fails because Epic is unavailable → 4xx/5xx)
    // or the app rejects it. Never a fake success.
    expect([400, 404, 500]).toContain(res.status());
  });

  test('zero id → 400 (not a valid credential id)', async ({ request }) => {
    const cookie = await login(request);
    const res = await refresh(request, cookie, '0');
    // Zero is falsy / not a real credential
    const body = await res.json();
    expect([400, 404]).toContain(res.status());
    expect(body).toHaveProperty('error');
  });

  test('negative id → 400 or 404 (never 200)', async ({ request }) => {
    const cookie = await login(request);
    const res = await refresh(request, cookie, '-1');
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('very large id → 404 (credential does not exist)', async ({ request }) => {
    const cookie = await login(request);
    const res = await refresh(request, cookie, MISSING_CRED);
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });
});

// ─── 3. Non-epic credential type guard ───────────────────────────────────

test.describe('POST /api/fhir/refresh — non-epic credentials rejected', () => {
  test('carespace credential → 400 with epic-related error message', async ({ request }) => {
    const cookie = await login(request);
    const res = await refresh(request, cookie, CARESPACE);
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body.error.toLowerCase()).toMatch(/epic/i);
  });

  test('generic credential → 400 (FHIR refresh not supported)', async ({ request }) => {
    const cookie = await login(request);
    const res = await refresh(request, cookie, GENERIC);
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });
});

// ─── 4. NULL refresh_token path (id=94) ──────────────────────────────────

test.describe('POST /api/fhir/refresh — credential 94 (null refresh_token)', () => {
  test('returns 400 with requiresAuth:true when refresh_token is null', async ({ request }) => {
    const cookie = await login(request);
    const res = await refresh(request, cookie, EPIC_NO_RT);
    // No refresh token stored → must return 400 with requiresAuth
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('requiresAuth', true);
    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');
    expect(body.error.length).toBeGreaterThan(0);
  });

  test('error message for null refresh_token does not expose internal field names', async ({ request }) => {
    const cookie = await login(request);
    const res = await refresh(request, cookie, EPIC_NO_RT);
    const text = await res.text();
    // Should not expose 'refresh_token' as a raw field name in error response
    expect(text).not.toMatch(/refresh_token.*null/i);
    // Must not expose SQL internals
    expect(text).not.toMatch(/SQLITE_ERROR|no such table/i);
  });

  test('fhir status after null-refresh-token attempt still shows correct state', async ({ request }) => {
    const cookie = await login(request);
    // Attempt refresh (will fail with 400)
    await refresh(request, cookie, EPIC_NO_RT);
    // Status check should still work correctly
    const statusRes = await fhirStatus(request, cookie, EPIC_NO_RT);
    expect(statusRes.status()).toBe(200);
    const statusBody = await statusRes.json();
    expect(statusBody).toHaveProperty('authorized');
    // Cred 94 has a token → authorized:true, but expired → valid:false
    if (statusBody.authorized) {
      expect(statusBody.valid).toBe(false);
    }
  });
});

// ─── 5. Expired token with refresh_token (id=98) ─────────────────────────

test.describe('POST /api/fhir/refresh — credential 98 (expired, has refresh_token)', () => {
  test('returns structured JSON (not raw crash) when real Epic unavailable', async ({ request }) => {
    const cookie = await login(request);
    const res = await refresh(request, cookie, EPIC_EXPIRED);
    // No real Epic endpoint → refresh will fail, but should be structured
    expect([200, 400, 500]).toContain(res.status());
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/json/i);
    const body = await res.json();
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
  });

  test('on failure: error field is always a string', async ({ request }) => {
    const cookie = await login(request);
    const res = await refresh(request, cookie, EPIC_EXPIRED);
    if (res.status() !== 200) {
      const body = await res.json();
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
      expect(body.error.length).toBeGreaterThan(0);
    }
  });

  test('on failure: response never leaks raw access_token value', async ({ request }) => {
    const cookie = await login(request);
    const res = await refresh(request, cookie, EPIC_EXPIRED);
    const text = await res.text();
    // Seeded access token value must not appear in response
    expect(text).not.toMatch(/test-access-token-expired/);
  });

  test('on failure: response never leaks raw refresh_token value', async ({ request }) => {
    const cookie = await login(request);
    const res = await refresh(request, cookie, EPIC_EXPIRED);
    const text = await res.text();
    // Seeded refresh token value must not appear in response
    expect(text).not.toMatch(/test-refresh-token-expired/);
  });

  test('on failure: no SQL error strings in response', async ({ request }) => {
    const cookie = await login(request);
    const res = await refresh(request, cookie, EPIC_EXPIRED);
    const text = await res.text();
    expect(text).not.toMatch(/SQLITE_ERROR|UNIQUE constraint|no such table/i);
  });

  test('on failure: no stack trace in response', async ({ request }) => {
    const cookie = await login(request);
    const res = await refresh(request, cookie, EPIC_EXPIRED);
    const text = await res.text();
    expect(text).not.toMatch(/at\s+\w[\w.]*\s*\(.*\.(?:js|cjs):\d+/);
    expect(text).not.toMatch(/node_modules\//);
  });
});

// ─── 6. Repeated refresh calls are safe ─────────────────────────────────

test.describe('POST /api/fhir/refresh — idempotency and safety', () => {
  test('two consecutive refresh attempts on cred 94 both return 400 (no crash on second)', async ({ request }) => {
    const cookie = await login(request);
    const r1 = await refresh(request, cookie, EPIC_NO_RT);
    const r2 = await refresh(request, cookie, EPIC_NO_RT);
    expect(r1.status()).toBe(400);
    expect(r2.status()).toBe(400);
    // Both must be JSON
    const b1 = await r1.json();
    const b2 = await r2.json();
    expect(b1).toHaveProperty('requiresAuth', true);
    expect(b2).toHaveProperty('requiresAuth', true);
  });

  test('refresh on missing cred does not corrupt DB (status still works after)', async ({ request }) => {
    const cookie = await login(request);
    // Call refresh on non-existent cred
    await refresh(request, cookie, MISSING_CRED);
    // Status check on valid cred should still work
    const statusRes = await fhirStatus(request, cookie, EPIC_VALID);
    expect(statusRes.status()).toBe(200);
    const body = await statusRes.json();
    expect(body).toHaveProperty('authorized');
  });
});

// ─── 7. Response shape contracts ─────────────────────────────────────────

test.describe('POST /api/fhir/refresh — response shape contracts', () => {
  test('response is always valid JSON (content-type: application/json)', async ({ request }) => {
    const cookie = await login(request);
    const credIds = [EPIC_VALID, EPIC_EXPIRED, EPIC_NO_RT, CARESPACE, MISSING_CRED];
    for (const credId of credIds) {
      const res = await refresh(request, cookie, credId);
      const ct = res.headers()['content-type'] ?? '';
      expect(ct, `cred ${credId} should return JSON`).toMatch(/json/i);
      const text = await res.text();
      expect(() => JSON.parse(text), `cred ${credId} must be valid JSON`).not.toThrow();
    }
  });

  test('error responses always have string error field', async ({ request }) => {
    const cookie = await login(request);
    const credIds = [EPIC_NO_RT, CARESPACE, MISSING_CRED];
    for (const credId of credIds) {
      const res = await refresh(request, cookie, credId);
      const body = await res.json();
      if (res.status() !== 200) {
        expect(body).toHaveProperty('error');
        expect(typeof body.error).toBe('string');
        expect(body.error.length).toBeGreaterThan(0);
      }
    }
  });

  test('requiresAuth field is boolean when present', async ({ request }) => {
    const cookie = await login(request);
    const res = await refresh(request, cookie, EPIC_NO_RT);
    const body = await res.json();
    if ('requiresAuth' in body) {
      expect(typeof body.requiresAuth).toBe('boolean');
    }
  });

  test('success response (200) has required fields', async ({ request }) => {
    // We can't get a real 200 in test env, but this guard protects against
    // shape regressions if Epic environment is ever added to CI
    const cookie = await login(request);
    const res = await refresh(request, cookie, EPIC_VALID);
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('expiresAt');
      expect(body).toHaveProperty('valid');
      expect(typeof body.valid).toBe('boolean');
      expect(typeof body.expiresAt).toBe('string');
    }
  });
});
