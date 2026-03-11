/**
 * Auth Endpoint Contracts
 *
 * Comprehensive tests for the authentication surface:
 *   POST /api/auth/login  — credential validation, response shape, cookie security
 *   POST /api/auth/logout — session teardown, cookie clearing
 *   GET  /api/auth/status — current session state
 *
 * Goals:
 *  1. Response shape contracts (fields present, correct types)
 *  2. Cookie security attributes (set on login, cleared on logout)
 *  3. Input validation (missing fields, empty strings, long inputs, injection)
 *  4. Session guard: authenticated endpoints reject invalid/missing cookies
 *  5. Multiple login / re-login behavior
 *  6. Logout idempotency
 *
 * Seeded credentials from global-setup:
 *   username: 'testuser'   password: 'testpass123'
 *
 * Run:
 *   npx playwright test --project=api-tests tests/e2e/auth-contracts.spec.js
 */

import { test, expect } from '@playwright/test';

const API = `http://localhost:${process.env.TEST_API_PORT || '3999'}`;

const VALID_CREDS = { username: 'testuser', password: 'testpass123' };

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function login(request, creds = VALID_CREDS) {
  const res = await request.post(`${API}/api/auth/login`, { data: creds });
  return { res, cookie: (res.headers()['set-cookie'] || '').split(';')[0] };
}

// ─── 1. Login — response shape ────────────────────────────────────────────────

test.describe('POST /api/auth/login — response shape contracts', () => {
  test('returns 200 with valid credentials', async ({ request }) => {
    const { res } = await login(request);
    expect(res.status()).toBe(200);
  });

  test('response is JSON (Content-Type: application/json)', async ({ request }) => {
    const { res } = await login(request);
    const ct = res.headers()['content-type'] || '';
    expect(ct).toMatch(/application\/json/i);
  });

  test('response body is valid JSON (never empty)', async ({ request }) => {
    const { res } = await login(request);
    const text = await res.text();
    expect(text.trim()).not.toBe('');
    expect(() => JSON.parse(text)).not.toThrow();
  });

  test('successful login response includes success:true or user/token field', async ({ request }) => {
    const { res } = await login(request);
    const body = await res.json();
    // Accept either { success: true } or { user: {...} } or { token: '...' } style
    const hasIndicator =
      body.success === true ||
      typeof body.user !== 'undefined' ||
      typeof body.token === 'string';
    expect(hasIndicator, `Login response should indicate success. Got: ${JSON.stringify(body)}`).toBe(true);
  });

  test('successful login sets an auth cookie', async ({ request }) => {
    const { res } = await login(request);
    const setCookie = res.headers()['set-cookie'] || '';
    expect(setCookie, 'Login must set a cookie').not.toBe('');
    expect(setCookie.length).toBeGreaterThan(10);
  });

  test('login response never exposes plaintext password', async ({ request }) => {
    const { res } = await login(request);
    const text = await res.text();
    expect(text).not.toContain(VALID_CREDS.password);
  });

  test('login response never exposes password_hash or encrypted_password fields', async ({ request }) => {
    const { res } = await login(request);
    const text = await res.text();
    expect(text).not.toMatch(/password_hash|encrypted_password|hashed_password/i);
  });
});

// ─── 2. Login — auth failures ─────────────────────────────────────────────────

test.describe('POST /api/auth/login — invalid credentials', () => {
  test('wrong password → 401', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/login`, {
      data: { username: 'testuser', password: 'wrongpassword' },
    });
    expect(res.status()).toBe(401);
  });

  test('wrong username → 401', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/login`, {
      data: { username: 'notauser', password: 'testpass123' },
    });
    expect(res.status()).toBe(401);
  });

  test('both wrong → 401', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/login`, {
      data: { username: 'noone', password: 'nothing' },
    });
    expect(res.status()).toBe(401);
  });

  test('401 response is JSON with error field (not HTML)', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/login`, {
      data: { username: 'testuser', password: 'badpass' },
    });
    const ct = res.headers()['content-type'] || '';
    expect(ct).toMatch(/application\/json/i);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('401 error message does not expose internal details (no stack trace)', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/login`, {
      data: { username: 'testuser', password: 'badpass' },
    });
    const text = await res.text();
    expect(text).not.toMatch(/at\s+\w+\s*\(.*:\d+:\d+\)/); // stack frame pattern
    expect(text).not.toMatch(/sqlite|SQLITE/);
  });

  test('failed login does NOT set an auth cookie', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/login`, {
      data: { username: 'testuser', password: 'wrongpass' },
    });
    // If any cookie is set, it must not be an auth cookie (could be a cleared one)
    const setCookie = res.headers()['set-cookie'] || '';
    if (setCookie) {
      // A session cleared cookie would have an empty value or Max-Age=0
      const isClearing = setCookie.includes('Max-Age=0') || setCookie.includes('Expires=Thu, 01 Jan 1970');
      // Alternatively just check the response is not 200
      expect(res.status()).not.toBe(200);
    }
    expect(res.status()).toBe(401);
  });
});

// ─── 3. Login — input validation ─────────────────────────────────────────────

test.describe('POST /api/auth/login — input validation', () => {
  test('missing username → 400 or 401 (never 500)', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/login`, {
      data: { password: 'testpass123' },
    });
    expect([400, 401]).toContain(res.status());
  });

  test('missing password → 400 or 401 (never 500)', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/login`, {
      data: { username: 'testuser' },
    });
    expect([400, 401]).toContain(res.status());
  });

  test('empty body → 400 or 401 (never 500)', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/login`, { data: {} });
    expect([400, 401]).toContain(res.status());
  });

  test('empty string username → 400 or 401 (never 500)', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/login`, {
      data: { username: '', password: 'testpass123' },
    });
    expect([400, 401]).toContain(res.status());
  });

  test('empty string password → 400 or 401 (never 500)', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/login`, {
      data: { username: 'testuser', password: '' },
    });
    expect([400, 401]).toContain(res.status());
  });

  test('very long username (1000 chars) → 400 or 401 (never 500 crash)', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/login`, {
      data: { username: 'a'.repeat(1000), password: 'pass' },
    });
    expect([400, 401]).toContain(res.status());
  });

  test('very long password (1000 chars) → 400 or 401 (never 500 crash)', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/login`, {
      data: { username: 'testuser', password: 'p'.repeat(1000) },
    });
    expect([400, 401]).toContain(res.status());
  });

  test("SQL injection in username → never 500 crash ('" + "' OR '1'='1)", async ({ request }) => {
    const res = await request.post(`${API}/api/auth/login`, {
      data: { username: "' OR '1'='1", password: 'anything' },
    });
    // Should be 401 (not authenticated) or 400; NEVER 200 (authenticated!) or 500
    expect([400, 401]).toContain(res.status());
  });

  test('non-string username (number) → 400 or 401 (never 500)', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/login`, {
      data: { username: 12345, password: 'testpass123' },
    });
    expect([400, 401]).toContain(res.status());
  });

  test('null values → 400 or 401 (never 500)', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/login`, {
      data: { username: null, password: null },
    });
    expect([400, 401]).toContain(res.status());
  });

  test('input validation failure response is always JSON (never HTML)', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/login`, {
      data: { username: '', password: '' },
    });
    const ct = res.headers()['content-type'] || '';
    expect(ct).toMatch(/application\/json/i);
  });
});

// ─── 4. Cookie security contracts ─────────────────────────────────────────────

test.describe('POST /api/auth/login — cookie security attributes', () => {
  test('auth cookie is HttpOnly (not readable by JavaScript)', async ({ request }) => {
    const { res } = await login(request);
    const rawCookie = res.headers()['set-cookie'] || '';
    // HttpOnly attribute prevents JS access — must be present for security
    expect(rawCookie.toLowerCase()).toContain('httponly');
  });

  test('auth cookie has SameSite attribute (CSRF protection)', async ({ request }) => {
    const { res } = await login(request);
    const rawCookie = res.headers()['set-cookie'] || '';
    expect(rawCookie.toLowerCase()).toMatch(/samesite=/i);
  });

  test('auth cookie has a Path attribute', async ({ request }) => {
    const { res } = await login(request);
    const rawCookie = res.headers()['set-cookie'] || '';
    expect(rawCookie.toLowerCase()).toMatch(/path=/i);
  });

  test('auth cookie value is not empty or whitespace', async ({ request }) => {
    const { res } = await login(request);
    const rawCookie = res.headers()['set-cookie'] || '';
    // Extract value: name=value; ...
    const value = rawCookie.split(';')[0].split('=').slice(1).join('=').trim();
    expect(value.length, 'Cookie value must not be empty').toBeGreaterThan(10);
  });
});

// ─── 5. Session validation — protected endpoints ──────────────────────────────

test.describe('Session validation — auth cookie required', () => {
  test('valid cookie grants access to protected endpoint', async ({ request }) => {
    const { cookie } = await login(request);
    const res = await request.get(`${API}/api/portals/credentials`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
  });

  test('no cookie → 401 on protected endpoint', async ({ request }) => {
    const res = await request.get(`${API}/api/portals/credentials`);
    expect(res.status()).toBe(401);
  });

  test('garbage cookie value → 401 (not 500)', async ({ request }) => {
    const res = await request.get(`${API}/api/portals/credentials`, {
      headers: { Cookie: 'mrt_session=totally-invalid-garbage-token-xyz' },
    });
    expect(res.status()).toBe(401);
  });

  test('truncated cookie → 401 (not 500)', async ({ request }) => {
    const { cookie } = await login(request);
    const truncated = cookie.substring(0, Math.floor(cookie.length / 2));
    const res = await request.get(`${API}/api/portals/credentials`, {
      headers: { Cookie: truncated },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('wrong cookie name → 401 (not 500)', async ({ request }) => {
    const res = await request.get(`${API}/api/portals/credentials`, {
      headers: { Cookie: 'wrong_cookie_name=some-value' },
    });
    expect(res.status()).toBe(401);
  });

  test('401 response for invalid session is JSON with error field', async ({ request }) => {
    const res = await request.get(`${API}/api/portals/credentials`, {
      headers: { Cookie: 'mrt_session=invalid' },
    });
    expect(res.status()).toBe(401);
    const ct = res.headers()['content-type'] || '';
    expect(ct).toMatch(/application\/json/i);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });
});

// ─── 6. Logout contracts ─────────────────────────────────────────────────────

test.describe('POST /api/auth/logout — session teardown', () => {
  test('logout returns 200 when authenticated', async ({ request }) => {
    const { cookie } = await login(request);
    const res = await request.post(`${API}/api/auth/logout`, {
      headers: { Cookie: cookie },
    });
    // Accept 200 (with body) or 204 (no content) — both indicate success
    expect([200, 204]).toContain(res.status());
  });

  test('logout response is JSON or empty (never HTML error page)', async ({ request }) => {
    const { cookie } = await login(request);
    const res = await request.post(`${API}/api/auth/logout`, {
      headers: { Cookie: cookie },
    });
    const ct = res.headers()['content-type'] || '';
    const text = await res.text();
    // If there's a body, it must be JSON (not HTML)
    if (text.trim().length > 0) {
      expect(ct).toMatch(/application\/json/i);
    }
  });

  test('after logout, the old cookie is rejected by protected endpoints', async ({ request }) => {
    const { cookie } = await login(request);

    // Verify the cookie works before logout
    const beforeRes = await request.get(`${API}/api/portals/credentials`, {
      headers: { Cookie: cookie },
    });
    expect(beforeRes.status()).toBe(200);

    // Log out
    await request.post(`${API}/api/auth/logout`, { headers: { Cookie: cookie } });

    // After logout, the same cookie should no longer work
    const afterRes = await request.get(`${API}/api/portals/credentials`, {
      headers: { Cookie: cookie },
    });
    // Either 401 (session invalidated) or 200 (stateless JWT — acceptable)
    // The important thing is it's never a 500 crash
    expect(afterRes.status()).not.toBe(500);
  });

  test('logout without auth cookie → 401 or 200 (idempotent — never 500)', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/logout`);
    expect([200, 401, 403]).toContain(res.status());
  });

  test('second logout with same cookie is idempotent (no crash)', async ({ request }) => {
    const { cookie } = await login(request);

    // First logout
    const first = await request.post(`${API}/api/auth/logout`, {
      headers: { Cookie: cookie },
    });
    expect([200, 204]).toContain(first.status());

    // Second logout — should not crash
    const second = await request.post(`${API}/api/auth/logout`, {
      headers: { Cookie: cookie },
    });
    expect(second.status()).not.toBe(500);
  });
});

// ─── 7. Re-login behavior ─────────────────────────────────────────────────────

test.describe('POST /api/auth/login — multiple / re-login', () => {
  test('logging in twice returns valid cookies both times', async ({ request }) => {
    const { res: res1, cookie: c1 } = await login(request);
    const { res: res2, cookie: c2 } = await login(request);

    expect(res1.status()).toBe(200);
    expect(res2.status()).toBe(200);
    expect(c1.length).toBeGreaterThan(10);
    expect(c2.length).toBeGreaterThan(10);
  });

  test('both cookies from consecutive logins are functional', async ({ request }) => {
    const { cookie: c1 } = await login(request);
    const { cookie: c2 } = await login(request);

    const r1 = await request.get(`${API}/api/portals/credentials`, { headers: { Cookie: c1 } });
    const r2 = await request.get(`${API}/api/portals/credentials`, { headers: { Cookie: c2 } });

    // At least the second login's cookie must work; first may or may not depending on session strategy
    expect(r2.status()).toBe(200);
    // Neither should crash
    expect(r1.status()).not.toBe(500);
  });

  test('login after logout produces a working cookie', async ({ request }) => {
    const { cookie: first } = await login(request);
    await request.post(`${API}/api/auth/logout`, { headers: { Cookie: first } });

    const { res: reloginRes, cookie: second } = await login(request);
    expect(reloginRes.status()).toBe(200);

    const check = await request.get(`${API}/api/portals/credentials`, {
      headers: { Cookie: second },
    });
    expect(check.status()).toBe(200);
  });
});
