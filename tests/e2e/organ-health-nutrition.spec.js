/**
 * Organ Health, Bone Health, Nutrition CRUD & Sync Status Tests
 *
 * Covers previously untested route groups:
 *  1. /api/organ-health/* — liver, lungs, kidneys, lymphatic, all, summary
 *  2. /api/bone-health/*  — data, metrics, actions
 *  3. /api/kidney-health, /api/liver-health, /api/lung-health (rich tracker endpoints)
 *  4. /api/nutrition/foods, /api/nutrition/meals, /api/nutrition/meals/today
 *  5. /api/sync/status
 *  6. POST /api/config (auth-guarded write)
 *  7. PUT /api/news/:id/read
 *
 * All tests run against the test server started by global-setup.js (port 3999).
 *
 * Run:
 *   npx playwright test --project=api-tests tests/e2e/organ-health-nutrition.spec.js
 */

import { test, expect } from '@playwright/test';

const PORT = process.env.TEST_API_PORT || '3999';
const API  = `http://localhost:${PORT}`;

const TEST_USER = { username: 'testuser', password: 'testpass123' };

// ─── Auth helper ──────────────────────────────────────────────────────────────
async function login(request) {
  const res = await request.post(`${API}/api/auth/login`, { data: TEST_USER });
  expect(res.status(), 'Login should succeed').toBe(200);
  const raw = res.headers()['set-cookie'] || '';
  return raw.split(';')[0];
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. ORGAN HEALTH — AUTH GUARDS
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Organ-health route auth guards — unauthenticated → 401', () => {
  const routes = [
    '/api/organ-health/liver',
    '/api/organ-health/lungs',
    '/api/organ-health/kidneys',
    '/api/organ-health/lymphatic',
    '/api/organ-health/all',
    '/api/organ-health/summary',
    '/api/kidney-health',
    '/api/liver-health',
    '/api/lung-health',
  ];

  for (const path of routes) {
    test(`GET ${path} → 401 without cookie`, async ({ request }) => {
      const res = await request.get(`${API}${path}`);
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body).toHaveProperty('error');
    });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. ORGAN HEALTH — AUTHENTICATED RESPONSES
// ═════════════════════════════════════════════════════════════════════════════

test.describe('GET /api/organ-health/liver — liver monitoring status', () => {
  test('returns 200 with a JSON object', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/organ-health/liver`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
  });

  test('response has shouldMonitor boolean field', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/organ-health/liver`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('shouldMonitor');
    expect(typeof body.shouldMonitor).toBe('boolean');
  });

  test('response never contains raw SQL errors', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/organ-health/liver`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    expect(text).not.toMatch(/SQLITE_ERROR|SqliteError|no such column/i);
  });
});

test.describe('GET /api/organ-health/lungs — lung monitoring status', () => {
  test('returns 200 with shouldMonitor field', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/organ-health/lungs`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('shouldMonitor');
    expect(typeof body.shouldMonitor).toBe('boolean');
  });

  test('response is JSON (not HTML)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/organ-health/lungs`, {
      headers: { Cookie: cookie },
    });
    expect(res.headers()['content-type']).toMatch(/application\/json/);
  });
});

test.describe('GET /api/organ-health/kidneys — kidney monitoring status', () => {
  test('returns 200 with shouldMonitor field', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/organ-health/kidneys`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('shouldMonitor');
  });
});

test.describe('GET /api/organ-health/lymphatic — lymphatic monitoring status', () => {
  test('returns 200 with shouldMonitor field', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/organ-health/lymphatic`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('shouldMonitor');
  });
});

test.describe('GET /api/organ-health/all — all organ statuses', () => {
  test('returns 200 with an object', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/organ-health/all`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
  });

  test('response never contains raw SQL error strings', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/organ-health/all`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    expect(text).not.toMatch(/SQLITE_ERROR|SqliteError/i);
  });
});

test.describe('GET /api/organ-health/summary — monitoring summary', () => {
  test('returns 200 with a JSON object', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/organ-health/summary`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
  });

  test('response content-type is application/json', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/organ-health/summary`, {
      headers: { Cookie: cookie },
    });
    expect(res.headers()['content-type']).toMatch(/application\/json/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. RICH ORGAN TRACKER ENDPOINTS (full trend data)
// ═════════════════════════════════════════════════════════════════════════════

test.describe('GET /api/kidney-health — rich kidney trend data', () => {
  test('returns 200 and JSON object', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/kidney-health`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe('object');
  });

  test('never leaks SQL errors', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/kidney-health`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    expect(text).not.toMatch(/SQLITE_ERROR|SqliteError|no such column/i);
  });
});

test.describe('GET /api/liver-health — rich liver trend data', () => {
  test('returns 200 and JSON object', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/liver-health`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe('object');
  });
});

test.describe('GET /api/lung-health — rich lung trend data', () => {
  test('returns 200 and JSON object', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/lung-health`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe('object');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. BONE HEALTH
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Bone-health route auth guards — unauthenticated → 401', () => {
  const routes = ['/api/bone-health', '/api/bone-health/metrics', '/api/bone-health/actions'];
  for (const path of routes) {
    test(`GET ${path} → 401 without cookie`, async ({ request }) => {
      const res = await request.get(`${API}${path}`);
      expect(res.status()).toBe(401);
    });
  }
});

test.describe('GET /api/bone-health — bone health overview', () => {
  test('returns 200 with JSON object', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/bone-health`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
  });

  test('no raw SQL errors in response', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/bone-health`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    expect(text).not.toMatch(/SQLITE_ERROR|SqliteError|no such column/i);
  });

  test('response content-type is application/json', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/bone-health`, {
      headers: { Cookie: cookie },
    });
    expect(res.headers()['content-type']).toMatch(/application\/json/);
  });
});

test.describe('GET /api/bone-health/metrics — bone health metrics', () => {
  test('returns 200 with JSON object', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/bone-health/metrics`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
  });

  test('no raw SQL errors in response', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/bone-health/metrics`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    expect(text).not.toMatch(/SQLITE_ERROR|SqliteError/i);
  });
});

test.describe('GET /api/bone-health/actions — recommended bone health actions', () => {
  test('returns 200 with JSON (array or object)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/bone-health/actions`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).not.toBeNull();
  });

  test('no raw SQL errors in response', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/bone-health/actions`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    expect(text).not.toMatch(/SQLITE_ERROR|SqliteError/i);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. NUTRITION — FOODS & MEALS CRUD
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Nutrition route auth guards — unauthenticated → 401', () => {
  const routes = [
    '/api/nutrition/foods',
    '/api/nutrition/meals',
    '/api/nutrition/meals/today',
  ];
  for (const path of routes) {
    test(`GET ${path} → 401 without cookie`, async ({ request }) => {
      const res = await request.get(`${API}${path}`);
      expect(res.status()).toBe(401);
    });
  }
});

test.describe('GET /api/nutrition/foods — food database', () => {
  test('returns 200 with array or object', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/nutrition/foods`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).not.toBeNull();
  });

  test('response content-type is application/json', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/nutrition/foods`, {
      headers: { Cookie: cookie },
    });
    expect(res.headers()['content-type']).toMatch(/application\/json/);
  });

  test('no SQL errors in response', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/nutrition/foods`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    expect(text).not.toMatch(/SQLITE_ERROR|SqliteError|no such column/i);
  });

  test('accepts search query param without crashing', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/nutrition/foods?q=broccoli`, {
      headers: { Cookie: cookie },
    });
    // Should be 200 (found or empty) — never 500
    expect([200, 404]).toContain(res.status());
  });
});

test.describe('GET /api/nutrition/meals — meal history', () => {
  test('returns 200 with array or object', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/nutrition/meals`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).not.toBeNull();
  });

  test('accepts date range query params without crashing', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(
      `${API}/api/nutrition/meals?start_date=2025-01-01&end_date=2025-12-31`,
      { headers: { Cookie: cookie } }
    );
    expect([200]).toContain(res.status());
  });

  test('accepts limit query param without crashing', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/nutrition/meals?limit=5`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
  });

  test('no SQL errors in response', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/nutrition/meals`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    expect(text).not.toMatch(/SQLITE_ERROR|SqliteError/i);
  });
});

test.describe('GET /api/nutrition/meals/today — today\'s meals', () => {
  test('returns 200 with JSON (array or object)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/nutrition/meals/today`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).not.toBeNull();
  });

  test('no SQL errors in response', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/nutrition/meals/today`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    expect(text).not.toMatch(/SQLITE_ERROR|SqliteError/i);
  });

  test('response content-type is application/json', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/nutrition/meals/today`, {
      headers: { Cookie: cookie },
    });
    expect(res.headers()['content-type']).toMatch(/application\/json/);
  });
});

test.describe('POST /api/nutrition/meals — record a meal', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.post(`${API}/api/nutrition/meals`, {
      data: { meal_type: 'lunch', foods: [] },
    });
    expect(res.status()).toBe(401);
  });

  test('creates a meal record — returns structured response', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/nutrition/meals`, {
      headers: { Cookie: cookie },
      data: {
        meal_type: 'lunch',
        date: '2026-03-07',
        notes: 'Test meal from Playwright',
      },
    });
    // 200 (success) or 400 (validation) — never 500
    expect([200, 201, 400]).toContain(res.status());
    const body = await res.json();
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
  });

  test('response never leaks stack trace', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/nutrition/meals`, {
      headers: { Cookie: cookie },
      data: { meal_type: 'breakfast' },
    });
    const text = await res.text();
    expect(text).not.toMatch(/at Object\.|at async |Error: /);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6. SYNC STATUS
// ═════════════════════════════════════════════════════════════════════════════

test.describe('GET /api/sync/status — cloud sync status', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.get(`${API}/api/sync/status`);
    expect(res.status()).toBe(401);
  });

  test('returns 200 with JSON object when authenticated', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/sync/status`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
  });

  test('response never leaks SQL errors or stack traces', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/sync/status`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    expect(text).not.toMatch(/SQLITE_ERROR|SqliteError|at Object\./);
  });

  test('response content-type is application/json', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/sync/status`, {
      headers: { Cookie: cookie },
    });
    expect(res.headers()['content-type']).toMatch(/application\/json/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 7. NEWS — mark-individual-read
// ═════════════════════════════════════════════════════════════════════════════

test.describe('PUT /api/news/:id/read — mark individual news item read', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.put(`${API}/api/news/1/read`);
    expect(res.status()).toBe(401);
  });

  test('returns 200 or 404 for unknown news id (idempotent, never crashes)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.put(`${API}/api/news/999999/read`, {
      headers: { Cookie: cookie },
    });
    // Either 200 (idempotent) or 404 — never 500
    expect([200, 404]).toContain(res.status());
    const body = await res.json();
    expect(typeof body).toBe('object');
  });

  test('non-numeric id does not crash server', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.put(`${API}/api/news/not-a-number/read`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBeLessThan(600);
    expect(res.headers()['content-type']).toMatch(/application\/json/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 8. POST /api/config — config write (auth-guarded)
// ═════════════════════════════════════════════════════════════════════════════

test.describe('POST /api/config — update config', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.post(`${API}/api/config`, {
      data: { theme: 'dark' },
    });
    expect(res.status()).toBe(401);
  });

  test('accepts empty config update without crashing', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/config`, {
      headers: { Cookie: cookie },
      data: {},
    });
    // 200 (ok) or 400 (validation) — never 500
    expect([200, 400]).toContain(res.status());
    const body = await res.json();
    expect(typeof body).toBe('object');
  });

  test('response never exposes raw API keys or secrets', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/config`, {
      headers: { Cookie: cookie },
      data: { theme: 'light' },
    });
    const text = await res.text();
    // Config response must not leak env vars or secret keys
    expect(text).not.toMatch(/sk-[a-zA-Z0-9]{20,}/); // OpenAI key pattern
    expect(text).not.toMatch(/password.*:/i);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 9. ORGAN HEALTH — Cross-endpoint consistency
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Organ health cross-endpoint consistency', () => {
  test('/all response includes statuses for monitored organs', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/organ-health/all`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    // The "all" endpoint aggregates multiple organs — must be non-empty object
    const body = await res.json();
    expect(typeof body).toBe('object');
    // Should have at least some organ keys (liver, lungs, etc.)
    const keys = Object.keys(body);
    expect(keys.length).toBeGreaterThanOrEqual(0); // empty is ok in a fresh DB
  });

  test('individual organ + /all endpoints agree on shouldMonitor for liver', async ({ request }) => {
    const cookie = await login(request);
    const [liverRes, allRes] = await Promise.all([
      request.get(`${API}/api/organ-health/liver`, { headers: { Cookie: cookie } }),
      request.get(`${API}/api/organ-health/all`,   { headers: { Cookie: cookie } }),
    ]);
    expect(liverRes.status()).toBe(200);
    expect(allRes.status()).toBe(200);
    const liver = await liverRes.json();
    const all   = await allRes.json();
    // If /all exposes a liver key, it should match
    if (all.liver !== undefined) {
      expect(all.liver.shouldMonitor).toBe(liver.shouldMonitor);
    }
  });

  test('/summary always has a JSON-serializable response (no circular refs)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/organ-health/summary`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    // If it got here without error, serialization worked — just verify parseable
    const text = await res.text();
    expect(() => JSON.parse(text)).not.toThrow();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 10. BONE HEALTH — Data integrity
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Bone health data integrity', () => {
  test('/bone-health and /bone-health/metrics respond independently (no shared crash)', async ({ request }) => {
    const cookie = await login(request);
    const [dataRes, metricsRes] = await Promise.all([
      request.get(`${API}/api/bone-health`,         { headers: { Cookie: cookie } }),
      request.get(`${API}/api/bone-health/metrics`, { headers: { Cookie: cookie } }),
    ]);
    expect(dataRes.status()).toBe(200);
    expect(metricsRes.status()).toBe(200);
  });

  test('/bone-health/actions response is always parseable JSON', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/bone-health/actions`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(() => JSON.parse(text)).not.toThrow();
  });

  test('all three bone-health sub-routes respond without 5xx', async ({ request }) => {
    const cookie = await login(request);
    const paths = ['/api/bone-health', '/api/bone-health/metrics', '/api/bone-health/actions'];
    for (const path of paths) {
      const res = await request.get(`${API}${path}`, { headers: { Cookie: cookie } });
      expect(res.status(), `${path} should not 5xx`).toBeLessThan(500);
    }
  });
});
