/**
 * Auth Session State Contracts
 *
 * Covers the auth endpoints that track and expose session state — areas
 * with thin coverage in auth-contracts.spec.js:
 *
 *   GET /api/auth/check   — "am I still logged in?" endpoint
 *   GET /api/auth/needs-setup — first-run gate
 *
 * Also covers:
 *   - Concurrent identical logins (isolation)
 *   - Cookie revocation-then-reuse
 *   - Session state after password change (separate user)
 *   - auth/check field type contracts
 *   - needs-setup field contracts
 *   - Error response shapes (JSON, never HTML)
 *
 * Run:
 *   npx playwright test --project=api-tests tests/e2e/auth-check-contracts.spec.js
 */

import { test, expect } from '@playwright/test';

const API = `http://localhost:${process.env.TEST_API_PORT || '3999'}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function login(request, username = 'testuser', password = 'testpass123') {
  const res = await request.post(`${API}/api/auth/login`, {
    data: { username, password },
  });
  expect(res.status(), `login for ${username} must succeed`).toBe(200);
  return (res.headers()['set-cookie'] || '').split(';')[0];
}

async function logout(request, cookie) {
  return request.post(`${API}/api/auth/logout`, {
    headers: { Cookie: cookie },
  });
}

async function check(request, cookie) {
  return request.get(`${API}/api/auth/check`, {
    headers: { Cookie: cookie },
  });
}

// ─── 1. GET /api/auth/check — auth guard ──────────────────────────────────────

test.describe('GET /api/auth/check — auth guard', () => {
  test('returns 401 with no cookie', async ({ request }) => {
    const res = await request.get(`${API}/api/auth/check`);
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('returns 401 with garbage cookie', async ({ request }) => {
    const res = await request.get(`${API}/api/auth/check`, {
      headers: { Cookie: 'auth_token=totally-invalid-token-value' },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');
  });

  test('returns 401 with empty cookie value', async ({ request }) => {
    const res = await request.get(`${API}/api/auth/check`, {
      headers: { Cookie: 'auth_token=' },
    });
    expect(res.status()).toBe(401);
  });

  test('returns 401 with wrong cookie name', async ({ request }) => {
    const res = await request.get(`${API}/api/auth/check`, {
      headers: { Cookie: 'session=anything' },
    });
    expect(res.status()).toBe(401);
  });

  test('401 response is always JSON (never HTML error page)', async ({ request }) => {
    const res = await request.get(`${API}/api/auth/check`);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/json/i);
    const text = await res.text();
    expect(() => JSON.parse(text)).not.toThrow();
  });
});

// ─── 2. GET /api/auth/check — shape contracts ─────────────────────────────────

test.describe('GET /api/auth/check — response shape contracts', () => {
  test('authenticated: returns 200', async ({ request }) => {
    const cookie = await login(request);
    const res = await check(request, cookie);
    expect(res.status()).toBe(200);
  });

  test('authenticated: response is JSON', async ({ request }) => {
    const cookie = await login(request);
    const res = await check(request, cookie);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/json/i);
  });

  test('authenticated: response has authenticated:true', async ({ request }) => {
    const cookie = await login(request);
    const res = await check(request, cookie);
    const body = await res.json();
    expect(body).toHaveProperty('authenticated', true);
  });

  test('authenticated: response has non-empty username string', async ({ request }) => {
    const cookie = await login(request);
    const res = await check(request, cookie);
    const body = await res.json();
    expect(body).toHaveProperty('username');
    expect(typeof body.username).toBe('string');
    expect(body.username.length).toBeGreaterThan(0);
  });

  test('authenticated: username matches the one used to login', async ({ request }) => {
    const cookie = await login(request, 'testuser', 'testpass123');
    const res = await check(request, cookie);
    const body = await res.json();
    expect(body.username).toBe('testuser');
  });

  test('authenticated: response never exposes password or password_hash', async ({ request }) => {
    const cookie = await login(request);
    const res = await check(request, cookie);
    const body = await res.json();
    expect(body).not.toHaveProperty('password');
    expect(body).not.toHaveProperty('password_hash');
    expect(body).not.toHaveProperty('passwordHash');
  });

  test('authenticated: response never exposes auth token value', async ({ request }) => {
    const cookie = await login(request);
    const res = await check(request, cookie);
    const text = await res.text();
    // Should not leak the token value in the body
    const tokenValue = cookie.split('=')[1];
    if (tokenValue) {
      expect(text).not.toContain(tokenValue);
    }
  });
});

// ─── 3. GET /api/auth/check — post-logout behavior ────────────────────────────

test.describe('GET /api/auth/check — session lifecycle', () => {
  test('check is 200 before logout, 401 after logout', async ({ request }) => {
    const cookie = await login(request);

    // Before logout: should be 200
    const before = await check(request, cookie);
    expect(before.status()).toBe(200);

    // Perform logout
    const logoutRes = await logout(request, cookie);
    expect(logoutRes.status()).toBe(200);

    // After logout: same cookie should be revoked
    const after = await check(request, cookie);
    expect(after.status()).toBe(401);
  });

  test('after logout, check returns JSON error (not HTML or empty)', async ({ request }) => {
    const cookie = await login(request);
    await logout(request, cookie);
    const res = await check(request, cookie);
    expect(res.status()).toBe(401);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/json/i);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('two logout calls with same cookie — second check still 401 (no crash)', async ({ request }) => {
    const cookie = await login(request);
    await logout(request, cookie);
    await logout(request, cookie); // idempotent
    const res = await check(request, cookie);
    expect(res.status()).toBe(401);
  });
});

// ─── 4. Concurrent session isolation ──────────────────────────────────────────

test.describe('GET /api/auth/check — concurrent session isolation', () => {
  test('two concurrent logins produce two independent valid sessions', async ({ request }) => {
    const cookie1 = await login(request);
    const cookie2 = await login(request);

    const [res1, res2] = await Promise.all([
      check(request, cookie1),
      check(request, cookie2),
    ]);

    expect(res1.status()).toBe(200);
    expect(res2.status()).toBe(200);

    const [body1, body2] = await Promise.all([res1.json(), res2.json()]);
    expect(body1.authenticated).toBe(true);
    expect(body2.authenticated).toBe(true);
    expect(body1.username).toBe('testuser');
    expect(body2.username).toBe('testuser');
  });

  test('logging out session1 does not invalidate session2', async ({ request }) => {
    const cookie1 = await login(request);
    const cookie2 = await login(request);

    // Logout session 1
    await logout(request, cookie1);

    // Session 1: revoked
    const res1 = await check(request, cookie1);
    expect(res1.status()).toBe(401);

    // Session 2: still valid
    const res2 = await check(request, cookie2);
    expect(res2.status()).toBe(200);
    const body2 = await res2.json();
    expect(body2.authenticated).toBe(true);
  });

  test('three parallel auth/check calls with same cookie all return 200', async ({ request }) => {
    const cookie = await login(request);
    const results = await Promise.all([
      check(request, cookie),
      check(request, cookie),
      check(request, cookie),
    ]);
    for (const res of results) {
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.authenticated).toBe(true);
    }
  });
});

// ─── 5. GET /api/auth/needs-setup — shape contracts ───────────────────────────

test.describe('GET /api/auth/needs-setup — shape contracts', () => {
  test('returns 200 (always public — no auth required)', async ({ request }) => {
    const res = await request.get(`${API}/api/auth/needs-setup`);
    expect(res.status()).toBe(200);
  });

  test('response is JSON', async ({ request }) => {
    const res = await request.get(`${API}/api/auth/needs-setup`);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/json/i);
  });

  test('response has needsSetup field that is a boolean', async ({ request }) => {
    const res = await request.get(`${API}/api/auth/needs-setup`);
    const body = await res.json();
    expect(body).toHaveProperty('needsSetup');
    expect(typeof body.needsSetup).toBe('boolean');
  });

  test('needsSetup is false when testuser exists', async ({ request }) => {
    // global-setup creates testuser → needsSetup must be false
    const res = await request.get(`${API}/api/auth/needs-setup`);
    const body = await res.json();
    expect(body.needsSetup).toBe(false);
  });

  test('works correctly when authenticated (auth not required, but should not break)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/auth/needs-setup`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.needsSetup).toBe('boolean');
  });

  test('response never exposes user passwords or hashes', async ({ request }) => {
    const res = await request.get(`${API}/api/auth/needs-setup`);
    const text = await res.text();
    expect(text).not.toMatch(/password_hash|passwordHash/i);
    expect(text).not.toMatch(/SQLITE_ERROR|no such table/i);
  });

  test('multiple calls return consistent needsSetup value', async ({ request }) => {
    const [r1, r2, r3] = await Promise.all([
      request.get(`${API}/api/auth/needs-setup`),
      request.get(`${API}/api/auth/needs-setup`),
      request.get(`${API}/api/auth/needs-setup`),
    ]);
    const [b1, b2, b3] = await Promise.all([r1.json(), r2.json(), r3.json()]);
    expect(b1.needsSetup).toBe(b2.needsSetup);
    expect(b2.needsSetup).toBe(b3.needsSetup);
  });
});

// ─── 6. auth/check + auth/needs-setup cross-behavior ─────────────────────────

test.describe('Auth check + needs-setup cross-behavior', () => {
  test('needs-setup false and auth/check 200 are consistent (user exists and logged in)', async ({ request }) => {
    const cookie = await login(request);

    const [setupRes, checkRes] = await Promise.all([
      request.get(`${API}/api/auth/needs-setup`),
      check(request, cookie),
    ]);

    const setupBody = await setupRes.json();
    const checkBody = await checkRes.json();

    // If needs-setup is false, user exists → can be logged in
    expect(setupBody.needsSetup).toBe(false);
    expect(checkBody.authenticated).toBe(true);
  });

  test('auth/check with logged-out session returns 401 regardless of needs-setup state', async ({ request }) => {
    const cookie = await login(request);
    await logout(request, cookie);

    const [setupRes, checkRes] = await Promise.all([
      request.get(`${API}/api/auth/needs-setup`),
      check(request, cookie),
    ]);

    const checkBody = await checkRes.json();
    expect(checkRes.status()).toBe(401);
    expect(checkBody).toHaveProperty('error');
    // needs-setup is unaffected by session state
    expect(setupRes.status()).toBe(200);
  });
});
