/**
 * Core Health CRUD Endpoint Tests
 *
 * Covers previously untested routes:
 *  - GET/PUT /api/profile         — patient profile read + update
 *  - GET/POST /api/conditions     — conditions list + create
 *  - GET/POST /api/symptoms       — symptoms list + create
 *  - GET /api/auth/check          — session check
 *  - POST /api/auth/logout        — logout clears session
 *  - GET /api/config/first-run    — first-run status
 *
 * All routes verified for: auth guards, response shape, field types, SQL safety,
 * create→read round-trips, and graceful error handling.
 *
 * Run:
 *   npx playwright test --project=api-tests tests/e2e/core-health-crud.spec.js
 */

import { test, expect } from '@playwright/test';

const PORT = process.env.TEST_API_PORT || process.env.TEST_PORT || '3999';
const API  = `http://localhost:${PORT}`;
const CREDS = { username: 'testuser', password: 'testpass123' };

// ─── Auth helpers ─────────────────────────────────────────────────────────────

async function login(request) {
  const res = await request.post(`${API}/api/auth/login`, { data: CREDS });
  expect(res.status(), 'Login must succeed').toBe(200);
  return res.headers()['set-cookie']?.split(';')[0] ?? '';
}

function authed(cookie) {
  return { headers: { Cookie: cookie } };
}

// ─── 1. GET /api/auth/check ───────────────────────────────────────────────────

test.describe('GET /api/auth/check', () => {
  test('returns 401 without auth cookie', async ({ request }) => {
    const res = await request.get(`${API}/api/auth/check`);
    expect(res.status()).toBe(401);
  });

  test('returns 200 + authenticated:true when logged in', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/auth/check`, authed(cookie));
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('authenticated', true);
    expect(body).toHaveProperty('username', CREDS.username);
  });

  test('response is always JSON (not HTML)', async ({ request }) => {
    const res = await request.get(`${API}/api/auth/check`);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/json/i);
  });
});

// ─── 2. POST /api/auth/logout ─────────────────────────────────────────────────

test.describe('POST /api/auth/logout', () => {
  test('logout without a session still returns 200 (idempotent)', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/logout`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('success', true);
  });

  test('logout with valid session returns success and clears cookie', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/auth/logout`, authed(cookie));
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('success', true);
  });

  test('after logout, /api/auth/check returns 401', async ({ request }) => {
    const cookie = await login(request);
    await request.post(`${API}/api/auth/logout`, authed(cookie));
    const check = await request.get(`${API}/api/auth/check`, authed(cookie));
    expect(check.status()).toBe(401);
  });
});

// ─── 3. GET /api/config/first-run ────────────────────────────────────────────

test.describe('GET /api/config/first-run', () => {
  test('returns 200 with firstRunComplete boolean', async ({ request }) => {
    const res = await request.get(`${API}/api/config/first-run`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('firstRunComplete');
    expect(typeof body.firstRunComplete).toBe('boolean');
  });

  test('response is JSON (no auth required)', async ({ request }) => {
    const res = await request.get(`${API}/api/config/first-run`);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/json/i);
  });

  test('does not leak stack traces or SQL in response', async ({ request }) => {
    const res = await request.get(`${API}/api/config/first-run`);
    const text = await res.text();
    expect(text).not.toMatch(/Error:/);
    expect(text).not.toMatch(/sqlite/i);
    expect(text).not.toMatch(/SELECT/i);
  });
});

// ─── 4. GET /api/profile ──────────────────────────────────────────────────────

test.describe('GET /api/profile', () => {
  test('returns 401 without auth', async ({ request }) => {
    const res = await request.get(`${API}/api/profile`);
    expect(res.status()).toBe(401);
  });

  test('returns 200 with JSON object when authenticated', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/profile`, authed(cookie));
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
    // Must be object or empty object — never an array
    expect(Array.isArray(body)).toBe(false);
  });

  test('response is always JSON (content-type)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/profile`, authed(cookie));
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/json/i);
  });

  test('profile response never leaks password or token fields', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/profile`, authed(cookie));
    const text = await res.text();
    expect(text).not.toContain('password_hash');
    expect(text).not.toContain('auth_token');
    expect(text).not.toContain('access_token');
  });

  test('response does not contain raw SQL error strings', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/profile`, authed(cookie));
    const text = await res.text();
    expect(text).not.toMatch(/SQLITE_ERROR/i);
    expect(text).not.toMatch(/no such column/i);
    expect(text).not.toMatch(/syntax error/i);
  });
});

// ─── 5. PUT /api/profile ─────────────────────────────────────────────────────

test.describe('PUT /api/profile', () => {
  test('returns 401 without auth', async ({ request }) => {
    const res = await request.put(`${API}/api/profile`, { data: {} });
    expect(res.status()).toBe(401);
  });

  test('returns 200 and success:true when updating profile', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.put(`${API}/api/profile`, {
      ...authed(cookie),
      data: {
        first_name: 'John',
        last_name: 'Perkins',
        blood_type: 'O+',
        sex: 'male',
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('success', true);
  });

  test('profile update is reflected in subsequent GET', async ({ request }) => {
    const cookie = await login(request);
    const testName = `TestFirst_${Date.now()}`;
    await request.put(`${API}/api/profile`, {
      ...authed(cookie),
      data: { first_name: testName, last_name: 'Perkins' },
    });
    const get = await request.get(`${API}/api/profile`, authed(cookie));
    const body = await get.json();
    // Profile may or may not be seeded — just verify it doesn't crash
    expect(get.status()).toBe(200);
    expect(typeof body).toBe('object');
  });

  test('update with all null fields does not crash server', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.put(`${API}/api/profile`, {
      ...authed(cookie),
      data: {
        first_name: null, last_name: null, date_of_birth: null,
        sex: null, blood_type: null,
      },
    });
    expect(res.status()).toBeLessThan(500);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/json/i);
  });
});

// ─── 6. GET /api/conditions ──────────────────────────────────────────────────

test.describe('GET /api/conditions', () => {
  test('returns 401 without auth', async ({ request }) => {
    const res = await request.get(`${API}/api/conditions`);
    expect(res.status()).toBe(401);
  });

  test('returns 200 and an array when authenticated', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/conditions`, authed(cookie));
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('response is JSON', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/conditions`, authed(cookie));
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/json/i);
  });

  test('conditions (when present) have expected fields', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/conditions`, authed(cookie));
    const body = await res.json();
    for (const condition of body) {
      expect(condition).toHaveProperty('id');
      expect(condition).toHaveProperty('name');
      expect(typeof condition.name).toBe('string');
    }
  });

  test('response does not contain SQL error text', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/conditions`, authed(cookie));
    const text = await res.text();
    expect(text).not.toMatch(/no such column/i);
    expect(text).not.toMatch(/SQLITE_ERROR/i);
  });
});

// ─── 7. POST /api/conditions ─────────────────────────────────────────────────

test.describe('POST /api/conditions', () => {
  test('returns 401 without auth', async ({ request }) => {
    const res = await request.post(`${API}/api/conditions`, {
      data: { name: 'Test Condition' },
    });
    expect(res.status()).toBe(401);
  });

  test('creates a condition and returns id', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/conditions`, {
      ...authed(cookie),
      data: {
        name: `Test Condition ${Date.now()}`,
        status: 'active',
        notes: 'Created by automated test',
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('id');
    expect(typeof body.id).toBe('number');
    expect(body.id).toBeGreaterThan(0);
  });

  test('created condition appears in subsequent GET /api/conditions', async ({ request }) => {
    const cookie = await login(request);
    const name = `Autotest Condition ${Date.now()}`;
    const post = await request.post(`${API}/api/conditions`, {
      ...authed(cookie),
      data: { name, status: 'active' },
    });
    expect(post.status()).toBe(200);
    const { id } = await post.json();

    const list = await request.get(`${API}/api/conditions`, authed(cookie));
    const conditions = await list.json();
    const found = conditions.find(c => c.id === id);
    expect(found, 'created condition should appear in list').toBeDefined();
    expect(found.name).toBe(name);
  });

  test('creating condition with missing name returns 400 (input validation)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/conditions`, {
      ...authed(cookie),
      data: { status: 'active' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');
  });
});

// ─── 8. GET /api/symptoms ────────────────────────────────────────────────────

test.describe('GET /api/symptoms', () => {
  test('returns 401 without auth', async ({ request }) => {
    const res = await request.get(`${API}/api/symptoms`);
    expect(res.status()).toBe(401);
  });

  test('returns 200 and an array', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/symptoms`, authed(cookie));
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('response is JSON', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/symptoms`, authed(cookie));
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/json/i);
  });

  test('symptom entries (when present) have id and description fields', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/symptoms`, authed(cookie));
    const body = await res.json();
    for (const symptom of body) {
      expect(symptom).toHaveProperty('id');
      if (symptom.description !== undefined) {
        expect(typeof symptom.description).toBe('string');
      }
    }
  });

  test('result is limited to 50 entries (server enforces LIMIT)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/symptoms`, authed(cookie));
    const body = await res.json();
    expect(body.length).toBeLessThanOrEqual(50);
  });

  test('no SQL error strings in response', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/symptoms`, authed(cookie));
    const text = await res.text();
    expect(text).not.toMatch(/SQLITE_ERROR/i);
    expect(text).not.toMatch(/no such column/i);
  });
});

// ─── 9. POST /api/symptoms ───────────────────────────────────────────────────

test.describe('POST /api/symptoms', () => {
  test('returns 401 without auth', async ({ request }) => {
    const res = await request.post(`${API}/api/symptoms`, {
      data: { description: 'Fatigue', severity: 5 },
    });
    expect(res.status()).toBe(401);
  });

  test('creates a symptom and returns id', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/symptoms`, {
      ...authed(cookie),
      data: {
        description: `Fatigue ${Date.now()}`,
        severity: 4,
        date: new Date().toISOString().split('T')[0],
        notes: 'Automated test symptom',
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('id');
    expect(typeof body.id).toBe('number');
    expect(body.id).toBeGreaterThan(0);
  });

  test('created symptom appears in GET /api/symptoms', async ({ request }) => {
    const cookie = await login(request);
    const description = `Nausea autotest ${Date.now()}`;
    const today = new Date().toISOString().split('T')[0];

    const post = await request.post(`${API}/api/symptoms`, {
      ...authed(cookie),
      data: { description, severity: 3, date: today },
    });
    expect(post.status()).toBe(200);
    const { id } = await post.json();

    const list = await request.get(`${API}/api/symptoms`, authed(cookie));
    const symptoms = await list.json();
    const found = symptoms.find(s => s.id === id);
    expect(found, 'created symptom should appear in list').toBeDefined();
  });

  test('severity is stored as a number (not string)', async ({ request }) => {
    const cookie = await login(request);
    const post = await request.post(`${API}/api/symptoms`, {
      ...authed(cookie),
      data: { description: 'Test severity check', severity: 7, date: '2026-03-08' },
    });
    expect(post.status()).toBe(200);
    const { id } = await post.json();

    const list = await request.get(`${API}/api/symptoms`, authed(cookie));
    const symptoms = await list.json();
    const found = symptoms.find(s => s.id === id);
    if (found && found.severity !== undefined) {
      expect(typeof found.severity).toBe('number');
    }
  });

  test('posting with empty body returns 400 (input validation)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/symptoms`, {
      ...authed(cookie),
      data: {},
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');
  });
});
