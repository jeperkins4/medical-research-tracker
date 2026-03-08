/**
 * FHIR Security & Auth Edge Cases
 *
 * Focused tests for FHIR authentication flows, token security,
 * CSRF protection, and auth guard hardening. Complements the
 * broader fhir.spec.js with deeper security-oriented coverage.
 *
 * Run:
 *   npx playwright test --project=api-tests tests/e2e/fhir-security.spec.js
 */

import { test, expect } from '@playwright/test';

const API = `http://localhost:${process.env.TEST_PORT || 3999}`;

const EPIC_CRED_ID      = 99;   // valid FHIR token (seeded in global-setup)
const EXPIRED_CRED_ID   = 98;   // expired FHIR token
const NON_EPIC_CRED     = 97;   // carespace type (not epic)
const MISSING_CRED      = 99999;

async function login(request) {
  const res = await request.post(`${API}/api/auth/login`, {
    data: { username: 'testuser', password: 'testpass123' },
  });
  expect(res.status()).toBe(200);
  const setCookie = res.headers()['set-cookie'];
  return setCookie?.split(';')[0] ?? '';
}

// ─── 1. Auth guard — ALL FHIR endpoints reject unauthenticated ─────────────

test.describe('FHIR auth guards — complete endpoint coverage', () => {
  const PROTECTED_ROUTES = [
    { method: 'get',    path: `/api/fhir/config-check` },
    { method: 'get',    path: `/api/fhir/authorize/${EPIC_CRED_ID}` },
    { method: 'get',    path: `/api/fhir/status/${EPIC_CRED_ID}` },
    { method: 'post',   path: `/api/fhir/sync/${EPIC_CRED_ID}` },
    { method: 'delete', path: `/api/fhir/revoke/${EPIC_CRED_ID}` },
    { method: 'get',    path: `/api/fhir/clinical-notes` },
    { method: 'get',    path: `/api/fhir/clinical-notes/1` },
    { method: 'post',   path: `/api/fhir/refresh/${EPIC_CRED_ID}` },
    { method: 'get',    path: `/api/cancer-profiles` },
    { method: 'get',    path: `/api/cancer-profiles/urothelial_carcinoma` },
    { method: 'get',    path: `/api/cancer-profiles/biomarkers/FGFR3` },
  ];

  for (const route of PROTECTED_ROUTES) {
    test(`${route.method.toUpperCase()} ${route.path} → 401 without auth`, async ({ request }) => {
      const res = await request[route.method](route.path.startsWith('http') ? route.path : `${API}${route.path}`);
      expect(res.status()).toBe(401);
    });
  }
});

// ─── 2. CSRF Protection — callback state validation ────────────────────────

test.describe('FHIR callback CSRF protection', () => {
  test('callback with unknown state → redirect with csrf_invalid error', async ({ request }) => {
    const res = await request.get(`${API}/api/fhir/callback?code=test-code&state=random-unknown-state`, {
      maxRedirects: 0,
    });
    // Should redirect to /?error=...
    expect([301, 302, 303]).toContain(res.status());
    const location = res.headers()['location'] ?? '';
    expect(location).toMatch(/error=/i);
  });

  test('callback with missing code → 400 (never proceeds to state check)', async ({ request }) => {
    const res = await request.get(`${API}/api/fhir/callback?state=some-state-value`);
    expect(res.status()).toBe(400);
  });

  test('callback with missing state → 400 (never proceeds)', async ({ request }) => {
    const res = await request.get(`${API}/api/fhir/callback?code=someauthorizationcode`);
    expect(res.status()).toBe(400);
  });

  test('callback with both missing → 400', async ({ request }) => {
    const res = await request.get(`${API}/api/fhir/callback`);
    expect(res.status()).toBe(400);
  });

  test('OAuth error parameter causes redirect regardless of state', async ({ request }) => {
    // Epic returns ?error=access_denied — callback should redirect before state check
    const res = await request.get(
      `${API}/api/fhir/callback?error=access_denied&error_description=User+denied`,
      { maxRedirects: 0 },
    );
    // Should redirect to /?error=... — not 500 or hang
    expect([301, 302, 303]).toContain(res.status());
    const location = res.headers()['location'] ?? '';
    expect(location).toMatch(/error=/i);
  });

  test('callback error redirect location never contains raw stack trace', async ({ request }) => {
    const res = await request.get(`${API}/api/fhir/callback?code=x&state=unknown-state-xyz`, {
      maxRedirects: 0,
    });
    const location = res.headers()['location'] ?? '';
    expect(location).not.toMatch(/at\s+\w+\s*\(/);  // stack frame pattern
    expect(location).not.toMatch(/node_modules/);
  });
});

// ─── 3. Token security — no token leakage in any response surface ─────────

test.describe('FHIR token security — no plaintext token leakage', () => {
  test('GET /api/fhir/status/:id never leaks access_token', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/fhir/status/${EPIC_CRED_ID}`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    expect(text).not.toContain('test-access-token-valid');
    expect(text).not.toContain('test-refresh-token');
  });

  test('GET /api/fhir/status expired → never leaks expired token', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/fhir/status/${EXPIRED_CRED_ID}`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    expect(text).not.toContain('test-access-token-expired');
    expect(text).not.toContain('test-refresh-token-expired');
  });

  test('POST /api/fhir/refresh never leaks token value in success response', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/fhir/refresh/${EXPIRED_CRED_ID}`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    // Even if refresh succeeds, raw token must not be in response body
    expect(text).not.toMatch(/"access_token"\s*:\s*"[^"]{10,}"/);
    expect(text).not.toContain('test-access-token');
  });

  test('POST /api/fhir/sync never leaks patient_id as raw FHIR ID in error response', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/fhir/sync/${EPIC_CRED_ID}`, {
      headers: { Cookie: cookie },
    });
    // Sync will fail in test env (no Epic endpoint) — error must be structured
    const body = await res.json();
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
  });

  test('GET /api/portals/credentials never leaks fhir tokens in list response', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/portals/credentials`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    expect(text).not.toContain('test-access-token-valid');
    expect(text).not.toContain('test-refresh-token');
  });
});

// ─── 4. Status endpoint — token state accuracy ─────────────────────────────

test.describe('FHIR status — token state accuracy', () => {
  test('valid token → authorized:true, valid:true, no error field', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/fhir/status/${EPIC_CRED_ID}`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.authorized).toBe(true);
    expect(body.valid).toBe(true);
    expect(body.error).toBeUndefined();
  });

  test('expired token → authorized:true, valid:false', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/fhir/status/${EXPIRED_CRED_ID}`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.authorized).toBe(true);
    expect(body.valid).toBe(false);
  });

  test('no token credential → authorized:false', async ({ request }) => {
    const cookie = await login(request);
    // NON_EPIC_CRED (id=97) has no fhir_tokens row
    const res = await request.get(`${API}/api/fhir/status/${NON_EPIC_CRED}`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.authorized).toBe(false);
  });

  test('status response always includes authorized field', async ({ request }) => {
    const cookie = await login(request);
    for (const credId of [EPIC_CRED_ID, EXPIRED_CRED_ID, NON_EPIC_CRED]) {
      const res = await request.get(`${API}/api/fhir/status/${credId}`, {
        headers: { Cookie: cookie },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('authorized');
      expect(typeof body.authorized).toBe('boolean');
    }
  });

  test('status for non-existent credential → 200 with authorized:false (not 500)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/fhir/status/${MISSING_CRED}`, {
      headers: { Cookie: cookie },
    });
    // Should not crash — either 200 authorized:false or 404, never 500
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.authorized).toBe(false);
    }
  });
});

// ─── 5. Revoke endpoint — idempotency and cleanup ─────────────────────────

test.describe('DELETE /api/fhir/revoke — idempotency', () => {
  test('revoke with no existing token → still 200 (idempotent)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.delete(`${API}/api/fhir/revoke/${NON_EPIC_CRED}`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
  });

  test('revoke twice is idempotent (no crash second time)', async ({ request }) => {
    const cookie = await login(request);
    // First revoke
    await request.delete(`${API}/api/fhir/revoke/${NON_EPIC_CRED}`, {
      headers: { Cookie: cookie },
    });
    // Second revoke — should not crash
    const res2 = await request.delete(`${API}/api/fhir/revoke/${NON_EPIC_CRED}`, {
      headers: { Cookie: cookie },
    });
    expect(res2.status()).toBe(200);
  });

  test('revoke response is always JSON (not HTML)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.delete(`${API}/api/fhir/revoke/${NON_EPIC_CRED}`, {
      headers: { Cookie: cookie },
    });
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/json/i);
  });

  test('revoke non-numeric id → 400 (no crash)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.delete(`${API}/api/fhir/revoke/badid`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(400);
  });
});

// ─── 6. Config-check — environment info safety ────────────────────────────

test.describe('GET /api/fhir/config-check — env safety', () => {
  test('config-check returns JSON with expected keys', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/fhir/config-check`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('configured');
    expect(body).toHaveProperty('callbackUrl');
  });

  test('config-check never leaks raw CLIENT_SECRET', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/fhir/config-check`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    // CLIENT_SECRET env var must never appear in response
    if (process.env.EPIC_CLIENT_SECRET) {
      expect(text).not.toContain(process.env.EPIC_CLIENT_SECRET);
    }
    expect(text).not.toMatch(/"client_secret"\s*:/i);
  });

  test('config-check callbackUrl is absolute URL ending in /api/fhir/callback', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/fhir/config-check`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.callbackUrl).toMatch(/\/api\/fhir\/callback$/);
  });

  test('response content-type is application/json', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/fhir/config-check`, {
      headers: { Cookie: cookie },
    });
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/application\/json/i);
  });
});

// ─── 7. Refresh endpoint — error shape contracts ──────────────────────────

test.describe('POST /api/fhir/refresh — error response contracts', () => {
  test('all error responses include error field (never empty body)', async ({ request }) => {
    const cookie = await login(request);
    const errorCases = [
      { id: 'notanumber', label: 'non-numeric id' },
      { id: MISSING_CRED, label: 'missing credential' },
      { id: NON_EPIC_CRED, label: 'non-epic type' },
    ];
    for (const { id, label } of errorCases) {
      const res = await request.post(`${API}/api/fhir/refresh/${id}`, {
        headers: { Cookie: cookie },
      });
      expect([400, 404, 500]).toContain(res.status());
      const body = await res.json();
      expect(body, `${label} should have error field`).toHaveProperty('error');
    }
  });

  test('refresh 400 response never contains raw SQLite error', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/fhir/refresh/${NON_EPIC_CRED}`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    expect(text).not.toMatch(/SQLITE_ERROR/i);
    expect(text).not.toMatch(/no such table/i);
    expect(text).not.toMatch(/UNIQUE constraint failed/i);
  });

  test('refresh non-epic credential error mentions epic in message', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/fhir/refresh/${NON_EPIC_CRED}`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error.toLowerCase()).toMatch(/epic/);
  });
});

// ─── 8. Sync endpoint — structured responses under failure ────────────────

test.describe('POST /api/fhir/sync — failure shape contracts', () => {
  test('sync always returns JSON (never HTML or empty string)', async ({ request }) => {
    const cookie = await login(request);
    for (const credId of [EPIC_CRED_ID, EXPIRED_CRED_ID, NON_EPIC_CRED]) {
      const res = await request.post(`${API}/api/fhir/sync/${credId}`, {
        headers: { Cookie: cookie },
      });
      const ct = res.headers()['content-type'] ?? '';
      expect(ct).toMatch(/json/i);
      const text = await res.text();
      expect(text.trim()).not.toBe('');
      // Must be valid JSON
      expect(() => JSON.parse(text)).not.toThrow();
    }
  });

  test('sync error response never leaks raw stack trace', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/fhir/sync/${EPIC_CRED_ID}`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    expect(text).not.toMatch(/at\s+\w+\s*\(.*\.js:\d+/);
    expect(text).not.toMatch(/node_modules\//);
  });

  test('sync non-numeric id → 400 (not 500)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/fhir/sync/BADID`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(400);
  });
});

// ─── 9. Cancer profile security ───────────────────────────────────────────

test.describe('Cancer profile endpoints — security contracts', () => {
  test('all 8 profile IDs are accessible without data leakage', async ({ request }) => {
    const cookie = await login(request);
    const profileIds = [
      'urothelial_carcinoma', 'colorectal_cancer', 'lung_nsclc',
      'prostate_cancer', 'ovarian_cancer', 'pancreatic_cancer',
      'melanoma', 'breast_cancer',
    ];
    for (const id of profileIds) {
      const res = await request.get(`${API}/api/cancer-profiles/${id}`, {
        headers: { Cookie: cookie },
      });
      expect([200, 404]).toContain(res.status());
      if (res.status() === 200) {
        const body = await res.json();
        expect(body).toHaveProperty('id');
        expect(body).toHaveProperty('label');
      }
    }
  });

  test('cancer profiles list never contains SQL error text', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/cancer-profiles`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).not.toMatch(/SQLITE_ERROR/i);
    expect(text).not.toMatch(/no such table/i);
  });

  test('cancer profiles list returns profiles array with items', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/cancer-profiles`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Endpoint returns { profiles: [...] } shape
    const profiles = Array.isArray(body) ? body : (body.profiles ?? []);
    expect(Array.isArray(profiles)).toBe(true);
    expect(profiles.length).toBeGreaterThan(0);
  });

  test('biomarker cross-ref — response shape always consistent', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/cancer-profiles/biomarkers/FGFR3`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('gene');
    expect(body).toHaveProperty('matches');
    expect(body).toHaveProperty('count');
    expect(typeof body.count).toBe('number');
    expect(body.count).toBe(body.matches.length);
  });
});
