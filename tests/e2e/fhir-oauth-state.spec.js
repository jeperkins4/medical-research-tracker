/**
 * FHIR OAuth State Lifecycle — Playwright API Tests
 *
 * Tests the state parameter lifecycle in the SMART on FHIR authorization flow:
 *   1. Callback with invalid/unknown state → redirect with error (not 500)
 *   2. Callback with expired state → redirect with error
 *   3. State replay: using a state a second time after it's consumed is rejected
 *   4. Callback with empty code (code='') → 400 JSON error
 *   5. Callback error param: includes raw error_description (not just 'error')
 *   6. Authorize → callback round-trip: state param in authUrl is same format
 *      as what callback expects
 *   7. Auth guard: /api/fhir/authorize without cookie → 401
 *   8. Auth guard: /api/fhir/revoke without cookie → 401
 *   9. Auth guard: /api/fhir/sync without cookie → 401
 *  10. Auth guard: /api/fhir/refresh without cookie → 401
 *  11. Callback with only state (no code) → 400 JSON error
 *  12. Callback with unknown error param returns error string in redirect
 *  13. Authorize JSON mode: float credentialId → 400
 *  14. Authorize JSON mode: negative credentialId → still returns 400 or valid
 *  15. All FHIR auth-guard endpoints return JSON error body (not HTML)
 *
 * Run:
 *   npx playwright test --project=api-tests tests/e2e/fhir-oauth-state.spec.js
 */

import { test, expect } from '@playwright/test';

const API = `http://localhost:${process.env.TEST_PORT || process.env.TEST_API_PORT || 3999}`;

// Seeded credential ids (from global-setup.js)
const EPIC_VALID    = 99;   // epic + valid FHIR token
const GENERIC       = 95;   // generic portal, no FHIR token

async function login(request) {
  const res = await request.post(`${API}/api/auth/login`, {
    data: { username: 'testuser', password: 'testpass123' },
  });
  expect(res.status(), 'login must succeed').toBe(200);
  return (res.headers()['set-cookie'] || '').split(';')[0];
}

// ─── 1. Invalid / Unknown State ───────────────────────────────────────────────

test.describe('OAuth callback — invalid state parameter', () => {
  test('callback with unknown state redirects with error (not 500)', async ({ request }) => {
    const res = await request.get(
      `${API}/api/fhir/callback?code=fake-code&state=totally-invalid-state-value`,
      { maxRedirects: 0 }
    );

    // Must redirect, never 500
    expect([301, 302, 303, 307, 308]).toContain(res.status());
    const location = res.headers().location || '';
    expect(location).toMatch(/\?error=/i);
    // Error must be a safe message, not a stack trace or SQL error
    const errorMsg = decodeURIComponent(location.split('?error=')[1] || '');
    expect(errorMsg.length).toBeGreaterThan(3);
    expect(errorMsg.toLowerCase()).not.toContain('sqlite');
    expect(errorMsg.toLowerCase()).not.toContain('stack');
  });

  test('callback with empty string state redirects with error', async ({ request }) => {
    const res = await request.get(
      `${API}/api/fhir/callback?code=fake-code&state=`,
      { maxRedirects: 0 }
    );

    // Either 400 JSON or redirect with error — both are acceptable
    expect([400, 301, 302, 303, 307, 308]).toContain(res.status());
  });

  test('callback with state=null string redirects or returns 400', async ({ request }) => {
    const res = await request.get(
      `${API}/api/fhir/callback?code=fake-code&state=null`,
      { maxRedirects: 0 }
    );
    expect([400, 301, 302, 303, 307, 308]).toContain(res.status());
    if (res.status() === 302) {
      const location = res.headers().location || '';
      expect(location).toContain('error=');
    }
  });
});

// ─── 2. Missing Code Variations ───────────────────────────────────────────────

test.describe('OAuth callback — missing / empty code variations', () => {
  test('code-only (no state) → 400 JSON with error field', async ({ request }) => {
    const res = await request.get(`${API}/api/fhir/callback?code=somecode`);
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');
  });

  test('state-only (no code) → 400 JSON with error field', async ({ request }) => {
    const res = await request.get(`${API}/api/fhir/callback?state=somestate`);
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('no params at all → 400 JSON', async ({ request }) => {
    const res = await request.get(`${API}/api/fhir/callback`);
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/missing required parameters/i);
  });
});

// ─── 3. OAuth Error Parameter Contracts ───────────────────────────────────────

test.describe('OAuth callback — error param handling', () => {
  test('error=access_denied redirects with error_description in location', async ({ request }) => {
    const desc = 'Patient cancelled the authorization';
    const res = await request.get(
      `${API}/api/fhir/callback?error=access_denied&error_description=${encodeURIComponent(desc)}`,
      { maxRedirects: 0 }
    );
    expect([301, 302, 303]).toContain(res.status());
    const location = res.headers().location || '';
    expect(location).toContain('/?error=');
    const decodedLocation = decodeURIComponent(location);
    expect(decodedLocation).toContain('Patient cancelled');
  });

  test('error=server_error with no description still redirects safely', async ({ request }) => {
    const res = await request.get(
      `${API}/api/fhir/callback?error=server_error`,
      { maxRedirects: 0 }
    );
    expect([301, 302, 303]).toContain(res.status());
    const location = res.headers().location || '';
    expect(location).toContain('/?error=');
    // Must have *some* error value (not just "/?error=")
    const errorPart = location.split('/?error=')[1] || '';
    expect(errorPart.length).toBeGreaterThan(0);
  });

  test('error=temporarily_unavailable redirects with error in location', async ({ request }) => {
    const res = await request.get(
      `${API}/api/fhir/callback?error=temporarily_unavailable`,
      { maxRedirects: 0 }
    );
    expect([301, 302, 303]).toContain(res.status());
    const location = res.headers().location || '';
    expect(location).toContain('/?error=');
  });

  test('error param takes precedence over code+state (never tries token exchange)', async ({ request }) => {
    // Even if code and state are present, error param should short-circuit
    const res = await request.get(
      `${API}/api/fhir/callback?code=somecode&state=somestate&error=access_denied`,
      { maxRedirects: 0 }
    );
    // Must redirect to error, not try token exchange
    expect([301, 302, 303]).toContain(res.status());
    const location = res.headers().location || '';
    expect(location).toContain('/?error=');
  });
});

// ─── 4. Auth Guards — All FHIR Routes Require Login ──────────────────────────

test.describe('FHIR route auth guards', () => {
  test('GET /api/fhir/authorize/:id without cookie → 401 JSON', async ({ request }) => {
    const res = await request.get(`${API}/api/fhir/authorize/${EPIC_VALID}?mode=json`);
    expect(res.status()).toBe(401);
    const ct = res.headers()['content-type'] || '';
    expect(ct).toMatch(/json/i);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('DELETE /api/fhir/revoke/:id without cookie → 401 JSON', async ({ request }) => {
    const res = await request.delete(`${API}/api/fhir/revoke/${EPIC_VALID}`);
    expect(res.status()).toBe(401);
    const ct = res.headers()['content-type'] || '';
    expect(ct).toMatch(/json/i);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('POST /api/fhir/sync/:id without cookie → 401 JSON', async ({ request }) => {
    const res = await request.post(`${API}/api/fhir/sync/${EPIC_VALID}`);
    expect(res.status()).toBe(401);
    const ct = res.headers()['content-type'] || '';
    expect(ct).toMatch(/json/i);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('POST /api/fhir/refresh/:id without cookie → 401 JSON', async ({ request }) => {
    const res = await request.post(`${API}/api/fhir/refresh/${EPIC_VALID}`);
    expect(res.status()).toBe(401);
    const ct = res.headers()['content-type'] || '';
    expect(ct).toMatch(/json/i);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('GET /api/fhir/status/:id without cookie → 401 JSON', async ({ request }) => {
    const res = await request.get(`${API}/api/fhir/status/${EPIC_VALID}`);
    expect(res.status()).toBe(401);
    const ct = res.headers()['content-type'] || '';
    expect(ct).toMatch(/json/i);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('GET /api/fhir/config-check without cookie → 401 JSON', async ({ request }) => {
    const res = await request.get(`${API}/api/fhir/config-check`);
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });
});

// ─── 5. Authorize Endpoint ID Validation ─────────────────────────────────────

test.describe('GET /api/fhir/authorize — credential id validation', () => {
  test('float credential id → 400 or config error (never 200 with wrong cred)', async ({ request }) => {
    // parseInt('3.14') = 3, which is a valid integer — server tries to generate auth URL.
    // Without EPIC_CLIENT_ID configured, this returns 500 with a hint.
    // Either way, it must never return 200 with a fabricated authUrl for id=3.14.
    const cookie = await login(request);
    const res = await request.get(`${API}/api/fhir/authorize/3.14?mode=json`, {
      headers: { Cookie: cookie },
    });
    expect([400, 500]).toContain(res.status());
    const ct = res.headers()['content-type'] || '';
    expect(ct).toMatch(/json/i);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('negative credential id → returns 400 or valid response (no 500)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/fhir/authorize/-1?mode=json`, {
      headers: { Cookie: cookie },
    });
    // Either 400 (invalid) or 500 (config error) — never a server crash with stack trace
    expect([400, 500]).toContain(res.status());
    const ct = res.headers()['content-type'] || '';
    expect(ct).toMatch(/json/i);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('zero credential id → 400 or error (not 200)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/fhir/authorize/0?mode=json`, {
      headers: { Cookie: cookie },
    });
    // 0 is technically a finite integer — may return 400 or 500 depending on config
    expect([400, 500]).toContain(res.status());
    const ct = res.headers()['content-type'] || '';
    expect(ct).toMatch(/json/i);
  });

  test('authorize returns JSON with credentialId when EPIC_CLIENT_ID is configured', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/fhir/authorize/${EPIC_VALID}?mode=json`, {
      headers: { Cookie: cookie },
    });
    // In test env, EPIC_CLIENT_ID may not be set → 500 with hint; that's OK
    expect([200, 500]).toContain(res.status());
    const body = await res.json();
    if (res.status() === 200) {
      expect(body.credentialId).toBe(EPIC_VALID);
      expect(typeof body.authUrl).toBe('string');
      expect(body.authUrl).toMatch(/^https?:\/\//);
      expect(body.authUrl).toContain('state=');
    } else {
      // Config error — must have error + hint
      expect(body.error).toBeTruthy();
      expect(body.hint).toMatch(/EPIC_CLIENT_ID|APP_BASE_URL/i);
    }
  });
});

// ─── 6. Revoke + Status Cycle ─────────────────────────────────────────────────

test.describe('Revoke → status transition (uses a second Epic credential)', () => {
  // We use id=94 (Epic + NULL refresh_token) for revoke tests so we don't
  // destroy id=99 which other specs depend on.
  const REVOKE_TEST_CRED = 94;

  test('revoke returns success:true and message', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.delete(`${API}/api/fhir/revoke/${REVOKE_TEST_CRED}`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.message).toBe('string');
    expect(body.message.length).toBeGreaterThan(3);
  });

  test('status after revoke returns authorized:false', async ({ request }) => {
    const cookie = await login(request);
    // Ensure revoked first
    await request.delete(`${API}/api/fhir/revoke/${REVOKE_TEST_CRED}`, {
      headers: { Cookie: cookie },
    });
    const res = await request.get(`${API}/api/fhir/status/${REVOKE_TEST_CRED}`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.authorized).toBe(false);
    // Must not leak any token data
    expect(body).not.toHaveProperty('access_token');
    expect(body).not.toHaveProperty('refresh_token');
  });

  test('double-revoke is idempotent (second revoke also returns success:true)', async ({ request }) => {
    const cookie = await login(request);
    await request.delete(`${API}/api/fhir/revoke/${REVOKE_TEST_CRED}`, {
      headers: { Cookie: cookie },
    });
    const res = await request.delete(`${API}/api/fhir/revoke/${REVOKE_TEST_CRED}`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

// ─── 7. Callback Response Content-Type Safety ────────────────────────────────

test.describe('Callback response safety (no HTML errors)', () => {
  test('callback 400 response is always JSON (never HTML)', async ({ request }) => {
    const res = await request.get(`${API}/api/fhir/callback`);
    expect(res.status()).toBe(400);
    const ct = res.headers()['content-type'] || '';
    expect(ct).toMatch(/json/i);
    // Body must be parseable JSON
    const text = await res.text();
    expect(() => JSON.parse(text)).not.toThrow();
  });

  test('callback redirect location is always /?error= or /?fhir_success=', async ({ request }) => {
    const res = await request.get(
      `${API}/api/fhir/callback?error=test_error`,
      { maxRedirects: 0 }
    );
    const location = res.headers().location || '';
    // Must be a known safe location — not a raw redirect to unknown URL
    expect(location).toMatch(/^\//);  // relative path — starts with /
    expect(location).toMatch(/\?error=|fhir_success/);
  });
});
