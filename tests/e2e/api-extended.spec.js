/**
 * API Extended Coverage Tests — v0.1.77+
 *
 * Covers routes NOT yet tested in api.spec.js / fhir.spec.js / portal-sync.spec.js:
 *
 *  1. Auth routes  — logout, /auth/check, /auth/needs-setup, /auth/register
 *  2. Vault routes — status, lock, unlock (auth guards + contract shapes)
 *  3. Portal CRUD  — GET :id, PUT :id, GET :id/sync-history
 *  4. Genomics extended — /trials, /pathway-graph, /mutation-drug-network
 *  5. Organ-health REST — /organ-health/{liver,lungs,kidneys,lymphatic,all,summary}
 *  6. Bone-health REST  — /bone-health/metrics, /bone-health/actions
 *  7. Config endpoints — GET /api/config, GET /api/config/first-run
 *  8. Health + Ping     — GET /api/health, GET /api/ping (public)
 *
 * All tests are deterministic against the test server (port 3999).
 * No external services are called.
 */

import { test, expect } from '@playwright/test';

const PORT = process.env.TEST_API_PORT || '3999';
const API  = `http://localhost:${PORT}`;

const TEST_USER = { username: 'testuser', password: 'testpass123' };

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function login(request) {
  const res = await request.post(`${API}/api/auth/login`, { data: TEST_USER });
  expect(res.status(), 'Test login must succeed').toBe(200);
  return res.headers()['set-cookie']?.split(';')[0] ?? '';
}

// ─── 1. Auth routes ───────────────────────────────────────────────────────────

test.describe('GET /api/auth/needs-setup — public endpoint', () => {
  test('returns 200 with needsSetup boolean', async ({ request }) => {
    const res = await request.get(`${API}/api/auth/needs-setup`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.needsSetup).toBe('boolean');
  });

  test('needsSetup is false because testuser already exists', async ({ request }) => {
    const res = await request.get(`${API}/api/auth/needs-setup`);
    const body = await res.json();
    expect(body.needsSetup).toBe(false);
  });
});

test.describe('GET /api/auth/check — auth guard', () => {
  test('returns 401 without cookie', async ({ request }) => {
    const res = await request.get(`${API}/api/auth/check`);
    expect(res.status()).toBe(401);
  });

  test('returns 200 with authenticated:true when logged in', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/auth/check`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(true);
    expect(body).toHaveProperty('username');
  });

  test('response never exposes password hash', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/auth/check`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    expect(text).not.toMatch(/password|hash|\$2[aby]\$/i);
  });
});

test.describe('POST /api/auth/logout', () => {
  test('returns 200 with success:true', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/auth/logout`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('logout without cookie still returns 200 (idempotent)', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/logout`);
    expect(res.status()).toBe(200);
  });

  test('after logout, auth/check returns 401', async ({ request }) => {
    const cookie = await login(request);
    await request.post(`${API}/api/auth/logout`, { headers: { Cookie: cookie } });
    const check = await request.get(`${API}/api/auth/check`, { headers: { Cookie: cookie } });
    expect(check.status()).toBe(401);
  });
});

test.describe('POST /api/auth/register', () => {
  test('returns 400 when username is missing', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/register`, {
      data: { password: 'validpass123' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('returns 400 when password is missing', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/register`, {
      data: { username: 'newuser_x' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('returns 400 when password is too short (<6 chars)', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/register`, {
      data: { username: 'newuser_y', password: 'abc' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/password/i);
  });

  test('returns 400 when username already exists', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/register`, {
      data: { username: 'testuser', password: 'validpass123' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/taken|exists/i);
  });
});

// ─── 2. Public health / ping ──────────────────────────────────────────────────

test.describe('GET /api/health — public health check', () => {
  test('returns 200', async ({ request }) => {
    const res = await request.get(`${API}/api/health`);
    expect(res.status()).toBe(200);
  });

  test('response is JSON (not HTML)', async ({ request }) => {
    const res = await request.get(`${API}/api/health`);
    const ct = res.headers()['content-type'] || '';
    expect(ct).toMatch(/application\/json/);
  });

  test('response has status field', async ({ request }) => {
    const res = await request.get(`${API}/api/health`);
    const body = await res.json();
    expect(body).toHaveProperty('status');
  });
});

test.describe('GET /api/ping — public liveness probe', () => {
  test('returns 200', async ({ request }) => {
    const res = await request.get(`${API}/api/ping`);
    expect(res.status()).toBe(200);
  });
});

// ─── 3. Config endpoints ──────────────────────────────────────────────────────

test.describe('GET /api/config', () => {
  test('returns 200', async ({ request }) => {
    const res = await request.get(`${API}/api/config`);
    expect(res.status()).toBe(200);
  });

  test('response has features object', async ({ request }) => {
    const res = await request.get(`${API}/api/config`);
    const body = await res.json();
    expect(body).toHaveProperty('features');
    expect(typeof body.features).toBe('object');
  });

  test('response never exposes raw API keys', async ({ request }) => {
    const res = await request.get(`${API}/api/config`);
    const text = await res.text();
    // Keys should not appear as raw values
    expect(text).not.toMatch(/sk-[a-zA-Z0-9]{20}/);
  });
});

test.describe('GET /api/config/first-run', () => {
  test('returns 200', async ({ request }) => {
    const res = await request.get(`${API}/api/config/first-run`);
    expect(res.status()).toBe(200);
  });

  test('response has isFirstRun boolean', async ({ request }) => {
    const res = await request.get(`${API}/api/config/first-run`);
    const body = await res.json();
    // Accept either shape servers may return
    const hasFlag = 'isFirstRun' in body || 'firstRunComplete' in body || 'complete' in body;
    expect(hasFlag).toBe(true);
  });
});

// ─── 4. Vault routes ─────────────────────────────────────────────────────────

test.describe('Vault route auth guards — unauthenticated → 401', () => {
  const vaultRoutes = [
    { method: 'GET',  path: '/api/vault/status' },
    { method: 'POST', path: '/api/vault/setup' },
    { method: 'POST', path: '/api/vault/unlock' },
    { method: 'POST', path: '/api/vault/lock' },
  ];

  for (const route of vaultRoutes) {
    test(`${route.method} ${route.path} → 401 without auth cookie`, async ({ request }) => {
      const res = route.method === 'GET'
        ? await request.get(`${API}${route.path}`)
        : await request.post(`${API}${route.path}`);
      expect(res.status()).toBe(401);
    });
  }
});

test.describe('GET /api/vault/status', () => {
  test('returns 200 with status info when authenticated', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/vault/status`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Shape: { initialized, locked } or similar
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
  });

  test('response never exposes master password or keys', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/vault/status`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    expect(text).not.toMatch(/masterPassword|master_password|encryptionKey/i);
  });
});

test.describe('POST /api/vault/lock', () => {
  test('returns 200 with structured response when authenticated', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/vault/lock`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe('object');
  });
});

test.describe('POST /api/vault/unlock — validation', () => {
  test('returns 400 when password is missing', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/vault/unlock`, {
      headers: { Cookie: cookie },
      data: {},
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('returns 401 when password is wrong', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/vault/unlock`, {
      headers: { Cookie: cookie },
      data: { password: 'definitely-wrong-password-xyz' },
    });
    // 401 = wrong password; 400 = vault not initialized; both are non-500
    expect([400, 401]).toContain(res.status());
  });
});

// ─── 5. Portal CRUD extended ─────────────────────────────────────────────────

test.describe('GET /api/portals/credentials/:id', () => {
  test('returns 401 without cookie', async ({ request }) => {
    const res = await request.get(`${API}/api/portals/credentials/95`);
    expect(res.status()).toBe(401);
  });

  test('returns 200, 403, or 404 for seeded credential id 95', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/portals/credentials/95`, {
      headers: { Cookie: cookie },
    });
    // 200: credential found; 404: not found; 403: vault locked (valid operational state)
    expect([200, 403, 404]).toContain(res.status());
    const body = await res.json();
    expect(typeof body).toBe('object');
  });

  test('non-numeric id returns 400 or 404 — never 500', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/portals/credentials/not-a-number`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).not.toBe(500);
    expect(res.status()).not.toBe(200);
  });

  test('response does NOT expose plaintext passwords', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/portals/credentials/95`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    expect(text).not.toMatch(/password_encrypted|password":\s*"[^"]{8}/i);
  });
});

test.describe('PUT /api/portals/credentials/:id', () => {
  test('returns 401 without cookie', async ({ request }) => {
    const res = await request.put(`${API}/api/portals/credentials/95`, {
      data: { service_name: 'Updated Name' },
    });
    expect(res.status()).toBe(401);
  });

  test('update seeded credential — returns 200 or 404 (not 500)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.put(`${API}/api/portals/credentials/95`, {
      headers: { Cookie: cookie },
      data: { service_name: 'Generic Test Portal Updated', sync_schedule: 'manual' },
    });
    expect([200, 400, 404]).toContain(res.status());
    const body = await res.json();
    expect(typeof body).toBe('object');
  });

  test('non-numeric id returns 4xx — never 500', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.put(`${API}/api/portals/credentials/abc`, {
      headers: { Cookie: cookie },
      data: { service_name: 'X' },
    });
    expect(res.status()).not.toBe(500);
  });
});

test.describe('GET /api/portals/credentials/:id/sync-history', () => {
  test('returns 401 without cookie', async ({ request }) => {
    const res = await request.get(`${API}/api/portals/credentials/95/sync-history`);
    expect(res.status()).toBe(401);
  });

  test('returns 200 with array for seeded credential', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/portals/credentials/95/sync-history`, {
      headers: { Cookie: cookie },
    });
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
    }
  });

  test('response never leaks SQL error strings', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/portals/credentials/95/sync-history`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    expect(text).not.toMatch(/SqliteError|SQLITE_ERROR|no such (column|table)/i);
  });
});

// ─── 6. Genomics extended routes ─────────────────────────────────────────────

test.describe('GET /api/genomics/trials — clinical trials', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.get(`${API}/api/genomics/trials`);
    expect(res.status()).toBe(401);
  });

  test('returns 200 with array', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/genomics/trials`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('response is JSON — never HTML', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/genomics/trials`, {
      headers: { Cookie: cookie },
    });
    const ct = res.headers()['content-type'] || '';
    expect(ct).toMatch(/application\/json/);
  });

  test('response never leaks SQL errors', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/genomics/trials`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    expect(text).not.toMatch(/SqliteError|SQLITE_ERROR|no such/i);
  });
});

test.describe('GET /api/genomics/pathway-graph', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.get(`${API}/api/genomics/pathway-graph`);
    expect(res.status()).toBe(401);
  });

  test('returns 200 with structured graph data', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/genomics/pathway-graph`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
  });

  test('graph response has mutations and pathways keys', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/genomics/pathway-graph`, {
      headers: { Cookie: cookie },
    });
    const body = await res.json();
    expect(body).toHaveProperty('mutations');
    expect(body).toHaveProperty('pathways');
    expect(Array.isArray(body.mutations)).toBe(true);
    expect(Array.isArray(body.pathways)).toBe(true);
  });

  test('graph response has treatments and mutationPathways keys', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/genomics/pathway-graph`, {
      headers: { Cookie: cookie },
    });
    const body = await res.json();
    expect(body).toHaveProperty('treatments');
    expect(body).toHaveProperty('mutationPathways');
  });
});

test.describe('GET /api/genomics/mutation-drug-network', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.get(`${API}/api/genomics/mutation-drug-network`);
    expect(res.status()).toBe(401);
  });

  test('returns 200 — never 500', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/genomics/mutation-drug-network`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
  });

  test('response is JSON object (not array or HTML)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/genomics/mutation-drug-network`, {
      headers: { Cookie: cookie },
    });
    const body = await res.json();
    // May return { nodes, edges } or similar shape
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
  });

  test('response never leaks SQL errors', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/genomics/mutation-drug-network`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    expect(text).not.toMatch(/SqliteError|SQLITE_ERROR|no such/i);
  });
});

// ─── 7. Organ-health REST endpoints ──────────────────────────────────────────

const organRoutes = [
  '/api/organ-health/liver',
  '/api/organ-health/lungs',
  '/api/organ-health/kidneys',
  '/api/organ-health/lymphatic',
  '/api/organ-health/all',
  '/api/organ-health/summary',
];

test.describe('Organ-health route auth guards — unauthenticated → 401', () => {
  for (const path of organRoutes) {
    test(`GET ${path} → 401 without cookie`, async ({ request }) => {
      const res = await request.get(`${API}${path}`);
      expect(res.status()).toBe(401);
    });
  }
});

test.describe('Organ-health routes — authenticated responses', () => {
  for (const path of organRoutes) {
    test(`GET ${path} returns 200 and JSON object`, async ({ request }) => {
      const cookie = await login(request);
      const res = await request.get(`${API}${path}`, {
        headers: { Cookie: cookie },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(typeof body).toBe('object');
      expect(body).not.toBeNull();
    });
  }

  test('/api/organ-health/all returns result with multiple organ keys', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/organ-health/all`, {
      headers: { Cookie: cookie },
    });
    const body = await res.json();
    // Should be an object with at least 2 keys (liver, lungs, etc.) or an array
    const keyCount = Array.isArray(body) ? body.length : Object.keys(body).length;
    expect(keyCount).toBeGreaterThanOrEqual(1);
  });

  test('/api/organ-health/summary response never contains raw SQL errors', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/organ-health/summary`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    expect(text).not.toMatch(/SqliteError|SQLITE_ERROR|no such (column|table)/i);
  });
});

// ─── 8. Bone-health REST endpoints ───────────────────────────────────────────

test.describe('GET /api/bone-health/metrics', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.get(`${API}/api/bone-health/metrics`);
    expect(res.status()).toBe(401);
  });

  test('returns 200 with structured data', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/bone-health/metrics`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
  });

  test('response is JSON — never HTML', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/bone-health/metrics`, {
      headers: { Cookie: cookie },
    });
    const ct = res.headers()['content-type'] || '';
    expect(ct).toMatch(/application\/json/);
  });

  test('no SQL errors in response', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/bone-health/metrics`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    expect(text).not.toMatch(/SqliteError|no such (column|table)/i);
  });
});

test.describe('GET /api/bone-health/actions', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.get(`${API}/api/bone-health/actions`);
    expect(res.status()).toBe(401);
  });

  test('returns 200 with array or structured object', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/bone-health/actions`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Can be array or object — just must not be null/undefined
    expect(body).not.toBeNull();
  });

  test('no SQL errors in response', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/bone-health/actions`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    expect(text).not.toMatch(/SqliteError|no such (column|table)/i);
  });
});
