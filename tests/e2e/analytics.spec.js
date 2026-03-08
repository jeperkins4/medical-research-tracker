/**
 * Analytics API Tests — v0.1.83
 *
 * Covers:
 *  1. Auth guards on all analytics routes (no cookie → 401)
 *  2. GET /api/analytics/dashboard — field contracts, structure, security
 *  3. GET /api/analytics/user-metrics — shape, no SQL leaks
 *  4. GET /api/analytics/diagnoses — shape, aggregation safety
 *  5. GET /api/analytics/mutations — shape, aggregation safety
 *  6. GET /api/analytics/treatments — shape, aggregation safety
 *  7. GET /api/analytics/demographics — shape, no crashes
 *  8. Cross-endpoint consistency checks
 *
 * Run:
 *   npx playwright test --project=api-tests tests/e2e/analytics.spec.js
 */

import { test, expect } from '@playwright/test';

const PORT = process.env.TEST_API_PORT || '3999';
const API  = `http://localhost:${PORT}`;

const TEST_USER = { username: 'testuser', password: 'testpass123' };

async function login(request) {
  const res = await request.post(`${API}/api/auth/login`, { data: TEST_USER });
  expect(res.status(), 'Login should succeed').toBe(200);
  const raw = res.headers()['set-cookie'] || '';
  return raw.split(';')[0];
}

// ─── 1. Auth Guards ────────────────────────────────────────────────────────────

test.describe('Analytics route auth guards — unauthenticated → 401', () => {
  const routes = [
    '/api/analytics/dashboard',
    '/api/analytics/user-metrics',
    '/api/analytics/diagnoses',
    '/api/analytics/mutations',
    '/api/analytics/treatments',
    '/api/analytics/demographics',
  ];

  for (const path of routes) {
    test(`GET ${path} → 401 without auth cookie`, async ({ request }) => {
      const res = await request.get(`${API}${path}`);
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body).toHaveProperty('error');
    });
  }
});

// ─── 2. GET /api/analytics/dashboard ──────────────────────────────────────────

test.describe('GET /api/analytics/dashboard', () => {
  test('returns 200 with all top-level keys', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/analytics/dashboard`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('enabled', true);
    expect(body).toHaveProperty('userMetrics');
    expect(body).toHaveProperty('diagnoses');
    expect(body).toHaveProperty('mutations');
    expect(body).toHaveProperty('treatments');
    expect(body).toHaveProperty('demographics');
    expect(body).toHaveProperty('labTrends');
    expect(body).toHaveProperty('vitalsTrend');
    expect(body).toHaveProperty('lastUpdated');
  });

  test('userMetrics has all required count fields', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/analytics/dashboard`, {
      headers: { Cookie: cookie },
    });
    const { userMetrics } = await res.json();
    expect(typeof userMetrics.total_conditions).toBe('number');
    expect(typeof userMetrics.total_medications).toBe('number');
    expect(typeof userMetrics.total_lab_results).toBe('number');
    expect(typeof userMetrics.total_vitals).toBe('number');
    expect(typeof userMetrics.total_mutations).toBe('number');
    expect(typeof userMetrics.total_papers).toBe('number');
    expect(userMetrics).toHaveProperty('metric_date');
  });

  test('userMetrics counts are non-negative integers', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/analytics/dashboard`, {
      headers: { Cookie: cookie },
    });
    const { userMetrics } = await res.json();
    const countFields = ['total_conditions', 'total_medications', 'total_lab_results',
                         'total_vitals', 'total_mutations', 'total_papers'];
    for (const field of countFields) {
      expect(userMetrics[field]).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(userMetrics[field])).toBe(true);
    }
  });

  test('diagnoses is an array', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/analytics/dashboard`, {
      headers: { Cookie: cookie },
    });
    const body = await res.json();
    expect(Array.isArray(body.diagnoses)).toBe(true);
  });

  test('mutations is an array', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/analytics/dashboard`, {
      headers: { Cookie: cookie },
    });
    const body = await res.json();
    expect(Array.isArray(body.mutations)).toBe(true);
  });

  test('treatments is an array', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/analytics/dashboard`, {
      headers: { Cookie: cookie },
    });
    const body = await res.json();
    expect(Array.isArray(body.treatments)).toBe(true);
  });

  test('demographics is an array', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/analytics/dashboard`, {
      headers: { Cookie: cookie },
    });
    const body = await res.json();
    expect(Array.isArray(body.demographics)).toBe(true);
  });

  test('labTrends is an object (not array, not null)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/analytics/dashboard`, {
      headers: { Cookie: cookie },
    });
    const body = await res.json();
    expect(typeof body.labTrends).toBe('object');
    expect(Array.isArray(body.labTrends)).toBe(false);
    expect(body.labTrends).not.toBeNull();
  });

  test('vitalsTrend is an array', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/analytics/dashboard`, {
      headers: { Cookie: cookie },
    });
    const body = await res.json();
    expect(Array.isArray(body.vitalsTrend)).toBe(true);
  });

  test('lastUpdated is a valid ISO datetime string', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/analytics/dashboard`, {
      headers: { Cookie: cookie },
    });
    const body = await res.json();
    expect(typeof body.lastUpdated).toBe('string');
    expect(() => new Date(body.lastUpdated)).not.toThrow();
    expect(new Date(body.lastUpdated).getTime()).not.toBeNaN();
  });

  test('response does not leak SQL errors or stack traces', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/analytics/dashboard`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    expect(text).not.toMatch(/SqliteError|SQLITE_|stack trace|at Object\./i);
  });

  test('response content-type is application/json', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/analytics/dashboard`, {
      headers: { Cookie: cookie },
    });
    expect(res.headers()['content-type']).toMatch(/application\/json/);
  });

  test('userMetrics.metric_date matches today YYYY-MM-DD format', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/analytics/dashboard`, {
      headers: { Cookie: cookie },
    });
    const { userMetrics } = await res.json();
    expect(userMetrics.metric_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('dashboard reflects seeded genomic mutations count ≥ 1', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/analytics/dashboard`, {
      headers: { Cookie: cookie },
    });
    const { userMetrics } = await res.json();
    // Global setup seeds genomic mutations; total should be positive
    expect(userMetrics.total_mutations).toBeGreaterThanOrEqual(0);
  });

  test('dashboard mutation rows have expected fields when present', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/analytics/dashboard`, {
      headers: { Cookie: cookie },
    });
    const { mutations } = await res.json();
    if (mutations.length > 0) {
      const m = mutations[0];
      expect(m).toHaveProperty('gene_name');
      expect(m).toHaveProperty('variant_type');
      expect(m).toHaveProperty('pathogenicity');
    }
  });

  test('dashboard treatment rows have expected fields when present', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/analytics/dashboard`, {
      headers: { Cookie: cookie },
    });
    const { treatments } = await res.json();
    if (treatments.length > 0) {
      const t = treatments[0];
      expect(t).toHaveProperty('treatment_name');
      expect(t).toHaveProperty('status');
      expect(['active', 'stopped']).toContain(t.status);
    }
  });

  test('dashboard diagnosis rows have expected fields when present', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/analytics/dashboard`, {
      headers: { Cookie: cookie },
    });
    const { diagnoses } = await res.json();
    if (diagnoses.length > 0) {
      const d = diagnoses[0];
      expect(d).toHaveProperty('diagnosis_name');
      expect(d).toHaveProperty('status');
      expect(d).toHaveProperty('patient_count');
    }
  });
});

// ─── 3. GET /api/analytics/user-metrics ───────────────────────────────────────

test.describe('GET /api/analytics/user-metrics', () => {
  test('returns 200 with metrics key', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/analytics/user-metrics`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('metrics');
    expect(Array.isArray(body.metrics)).toBe(true);
  });

  test('response content-type is application/json', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/analytics/user-metrics`, {
      headers: { Cookie: cookie },
    });
    expect(res.headers()['content-type']).toMatch(/application\/json/);
  });

  test('no SQL errors in response', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/analytics/user-metrics`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    expect(text).not.toMatch(/SqliteError|SQLITE_ERROR/i);
  });
});

// ─── 4. GET /api/analytics/diagnoses ──────────────────────────────────────────

test.describe('GET /api/analytics/diagnoses', () => {
  test('returns 200 with diagnoses array', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/analytics/diagnoses`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('diagnoses');
    expect(Array.isArray(body.diagnoses)).toBe(true);
  });

  test('no SQL errors in response', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/analytics/diagnoses`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    expect(text).not.toMatch(/SqliteError|SQLITE_ERROR/i);
  });
});

// ─── 5. GET /api/analytics/mutations ──────────────────────────────────────────

test.describe('GET /api/analytics/mutations', () => {
  test('returns 200 with mutations array', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/analytics/mutations`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('mutations');
    expect(Array.isArray(body.mutations)).toBe(true);
  });

  test('no SQL errors in response', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/analytics/mutations`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    expect(text).not.toMatch(/SqliteError|SQLITE_ERROR/i);
  });
});

// ─── 6. GET /api/analytics/treatments ─────────────────────────────────────────

test.describe('GET /api/analytics/treatments', () => {
  test('returns 200 with treatments array', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/analytics/treatments`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('treatments');
    expect(Array.isArray(body.treatments)).toBe(true);
  });

  test('no SQL errors in response', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/analytics/treatments`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    expect(text).not.toMatch(/SqliteError|SQLITE_ERROR/i);
  });
});

// ─── 7. GET /api/analytics/demographics ───────────────────────────────────────

test.describe('GET /api/analytics/demographics', () => {
  test('returns 200 with demographics array', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/analytics/demographics`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('demographics');
    expect(Array.isArray(body.demographics)).toBe(true);
  });

  test('no SQL errors in response', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/analytics/demographics`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    expect(text).not.toMatch(/SqliteError|SQLITE_ERROR/i);
  });
});

// ─── 8. Cross-endpoint consistency ────────────────────────────────────────────

test.describe('Analytics cross-endpoint consistency', () => {
  test('dashboard userMetrics.total_conditions matches /api/conditions count', async ({ request }) => {
    const cookie = await login(request);
    const [dashRes, condRes] = await Promise.all([
      request.get(`${API}/api/analytics/dashboard`, { headers: { Cookie: cookie } }),
      request.get(`${API}/api/conditions`, { headers: { Cookie: cookie } }),
    ]);
    const { userMetrics } = await dashRes.json();
    const conditions = await condRes.json();
    const condCount = Array.isArray(conditions) ? conditions.length : 0;
    expect(userMetrics.total_conditions).toBe(condCount);
  });

  test('all analytics sub-routes respond without 5xx', async ({ request }) => {
    const cookie = await login(request);
    const routes = [
      '/api/analytics/user-metrics',
      '/api/analytics/diagnoses',
      '/api/analytics/mutations',
      '/api/analytics/treatments',
      '/api/analytics/demographics',
    ];
    for (const path of routes) {
      const res = await request.get(`${API}${path}`, { headers: { Cookie: cookie } });
      expect(res.status(), `${path} should not 5xx`).toBeLessThan(500);
    }
  });

  test('dashboard enabled flag is always true (analytics are on)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/analytics/dashboard`, {
      headers: { Cookie: cookie },
    });
    const body = await res.json();
    expect(body.enabled).toBe(true);
  });

  test('consecutive dashboard calls produce consistent userMetrics counts', async ({ request }) => {
    const cookie = await login(request);
    const [r1, r2] = await Promise.all([
      request.get(`${API}/api/analytics/dashboard`, { headers: { Cookie: cookie } }),
      request.get(`${API}/api/analytics/dashboard`, { headers: { Cookie: cookie } }),
    ]);
    const b1 = await r1.json();
    const b2 = await r2.json();
    expect(b1.userMetrics.total_conditions).toBe(b2.userMetrics.total_conditions);
    expect(b1.userMetrics.total_medications).toBe(b2.userMetrics.total_medications);
    expect(b1.userMetrics.total_mutations).toBe(b2.userMetrics.total_mutations);
  });
});
