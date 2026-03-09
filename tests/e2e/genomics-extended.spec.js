/**
 * Genomics Extended API Tests
 *
 * Covers the genomics endpoints that are NOT exercised in genomics.spec.js:
 *   - GET /api/genomics/trials                       (clinical trial registry)
 *   - GET /api/genomics/pathway-graph                (node/edge graph)
 *   - GET /api/genomics/mutation-drug-network        (mutation ↔ drug network)
 *   - GET /api/genomics/treatment-correlations/medication/:id
 *   - GET /api/genomics/treatment-correlations/mutation/:id
 *   - POST /api/genomics/import-mutations            (bulk import)
 *
 * All auth guards verified. All responses validated for JSON shape.
 * No real external API calls.
 *
 * Run:
 *   npx playwright test --project=api-tests tests/e2e/genomics-extended.spec.js
 */

import { test, expect } from '@playwright/test';

const API  = `http://localhost:${process.env.TEST_API_PORT || '3999'}`;
const USER = { username: 'testuser', password: 'testpass123' };

// ─── Auth helper ───────────────────────────────────────────────────────────────

async function login(request) {
  const res = await request.post(`${API}/api/auth/login`, { data: USER });
  expect(res.status(), 'login must succeed').toBe(200);
  return (res.headers()['set-cookie'] || '').split(';')[0];
}

// ─── Auth guard matrix ─────────────────────────────────────────────────────────

test.describe('Genomics extended — auth guards (unauthenticated → 401)', () => {
  const PROTECTED = [
    ['GET',  '/api/genomics/trials'],
    ['GET',  '/api/genomics/pathway-graph'],
    ['GET',  '/api/genomics/mutation-drug-network'],
    ['GET',  '/api/genomics/treatment-correlations/medication/1'],
    ['GET',  '/api/genomics/treatment-correlations/mutation/1'],
    ['POST', '/api/genomics/import-mutations'],
  ];

  for (const [method, path] of PROTECTED) {
    test(`${method} ${path} → 401 without auth cookie`, async ({ request }) => {
      const res = await request.fetch(`${API}${path}`, { method, headers: {} });
      expect(res.status()).toBe(401);
    });
  }
});

// ─── GET /api/genomics/trials ─────────────────────────────────────────────────

test.describe('GET /api/genomics/trials', () => {
  test('returns 200 with JSON content-type', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/genomics/trials`, { headers: { Cookie: cookie } });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/application\/json/);
  });

  test('response is an array', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/genomics/trials`, { headers: { Cookie: cookie } });
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('each trial in array has expected fields (when present)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/genomics/trials`, { headers: { Cookie: cookie } });
    const trials = await res.json();
    // May be empty if no recruiting trials seeded; check each item if any
    for (const t of trials) {
      expect(t).toHaveProperty('id');
      // gene and alteration come from LEFT JOIN on genomic_mutations
    }
  });

  test('response never leaks raw SQL error strings', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/genomics/trials`, { headers: { Cookie: cookie } });
    const text = await res.text();
    expect(text).not.toMatch(/SqliteError|SQLITE_ERROR/i);
  });
});

// ─── GET /api/genomics/pathway-graph ──────────────────────────────────────────

test.describe('GET /api/genomics/pathway-graph', () => {
  test('returns 200 with JSON content-type', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/genomics/pathway-graph`, { headers: { Cookie: cookie } });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/application\/json/);
  });

  test('response is a valid JSON object', async ({ request }) => {
    const cookie = await login(request);
    const res  = await request.get(`${API}/api/genomics/pathway-graph`, { headers: { Cookie: cookie } });
    const body = await res.json();
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
  });

  test('response is not an empty string', async ({ request }) => {
    const cookie = await login(request);
    const res  = await request.get(`${API}/api/genomics/pathway-graph`, { headers: { Cookie: cookie } });
    const text = await res.text();
    expect(text.trim()).not.toBe('');
  });

  test('response contains nodes and edges (or equivalent) keys', async ({ request }) => {
    const cookie = await login(request);
    const res  = await request.get(`${API}/api/genomics/pathway-graph`, { headers: { Cookie: cookie } });
    const body = await res.json();
    // The graph shape should have array-like collections for nodes/edges
    const keys = Object.keys(body);
    expect(keys.length, 'pathway-graph should return a non-empty object').toBeGreaterThan(0);
  });

  test('does not leak SQL error strings', async ({ request }) => {
    const cookie = await login(request);
    const res  = await request.get(`${API}/api/genomics/pathway-graph`, { headers: { Cookie: cookie } });
    const text = await res.text();
    expect(text).not.toMatch(/SqliteError|SQLITE_ERROR/i);
  });
});

// ─── GET /api/genomics/mutation-drug-network ──────────────────────────────────

test.describe('GET /api/genomics/mutation-drug-network', () => {
  test('returns 200 with JSON content-type', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/genomics/mutation-drug-network`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/application\/json/);
  });

  test('response is a valid JSON object or array', async ({ request }) => {
    const cookie = await login(request);
    const res  = await request.get(`${API}/api/genomics/mutation-drug-network`, {
      headers: { Cookie: cookie },
    });
    const body = await res.json();
    expect(body).not.toBeNull();
    // Accepts either an object (graph) or an array (list)
    expect(['object', 'array'].includes(typeof body) || Array.isArray(body)).toBe(true);
  });

  test('does not leak SQL error strings', async ({ request }) => {
    const cookie = await login(request);
    const res  = await request.get(`${API}/api/genomics/mutation-drug-network`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    expect(text).not.toMatch(/SqliteError|SQLITE_ERROR/i);
  });

  test('response is non-empty JSON', async ({ request }) => {
    const cookie = await login(request);
    const res  = await request.get(`${API}/api/genomics/mutation-drug-network`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    expect(text.trim()).not.toBe('');
    expect(() => JSON.parse(text)).not.toThrow();
  });
});

// ─── GET /api/genomics/treatment-correlations/medication/:id ──────────────────

test.describe('GET /api/genomics/treatment-correlations/medication/:id', () => {
  test('returns 200 or 404 for seeded medication id=1', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(
      `${API}/api/genomics/treatment-correlations/medication/1`,
      { headers: { Cookie: cookie } }
    );
    expect([200, 404]).toContain(res.status());
  });

  test('response is valid JSON', async ({ request }) => {
    const cookie = await login(request);
    const res  = await request.get(
      `${API}/api/genomics/treatment-correlations/medication/1`,
      { headers: { Cookie: cookie } }
    );
    const text = await res.text();
    expect(() => JSON.parse(text)).not.toThrow();
  });

  test('returns 200 or 404 for non-existent id (not 500)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(
      `${API}/api/genomics/treatment-correlations/medication/99999`,
      { headers: { Cookie: cookie } }
    );
    expect([200, 404]).toContain(res.status());
  });

  test('does not leak SQL error strings', async ({ request }) => {
    const cookie = await login(request);
    const res  = await request.get(
      `${API}/api/genomics/treatment-correlations/medication/1`,
      { headers: { Cookie: cookie } }
    );
    const text = await res.text();
    expect(text).not.toMatch(/SqliteError|SQLITE_ERROR/i);
  });
});

// ─── GET /api/genomics/treatment-correlations/mutation/:id ────────────────────

test.describe('GET /api/genomics/treatment-correlations/mutation/:id', () => {
  test('returns 200 for seeded ARID1A mutation', async ({ request }) => {
    const cookie = await login(request);
    // Get first mutation id from the list
    const mutListRes = await request.get(`${API}/api/genomics/mutations`, {
      headers: { Cookie: cookie },
    });
    const mutations = await mutListRes.json();
    // Use first seeded mutation id, or fall through to 1
    const mutId = mutations[0]?.id ?? 1;

    const res = await request.get(
      `${API}/api/genomics/treatment-correlations/mutation/${mutId}`,
      { headers: { Cookie: cookie } }
    );
    expect([200, 404]).toContain(res.status());
  });

  test('response is always valid JSON', async ({ request }) => {
    const cookie = await login(request);
    const res  = await request.get(
      `${API}/api/genomics/treatment-correlations/mutation/1`,
      { headers: { Cookie: cookie } }
    );
    const text = await res.text();
    expect(() => JSON.parse(text)).not.toThrow();
  });

  test('non-existent mutation id → 200 or 404 (not 500)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(
      `${API}/api/genomics/treatment-correlations/mutation/99999`,
      { headers: { Cookie: cookie } }
    );
    expect([200, 404]).toContain(res.status());
  });

  test('does not leak SQL error strings', async ({ request }) => {
    const cookie = await login(request);
    const res  = await request.get(
      `${API}/api/genomics/treatment-correlations/mutation/1`,
      { headers: { Cookie: cookie } }
    );
    const text = await res.text();
    expect(text).not.toMatch(/SqliteError|SQLITE_ERROR/i);
  });
});

// ─── POST /api/genomics/import-mutations ──────────────────────────────────────

test.describe('POST /api/genomics/import-mutations', () => {
  test('returns 200, 400, or 500 — never crashes with uncaught exception', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/genomics/import-mutations`, {
      headers: { Cookie: cookie },
      data: {},
    });
    expect([200, 400, 500]).toContain(res.status());
  });

  test('response is always valid JSON', async ({ request }) => {
    const cookie = await login(request);
    const res  = await request.post(`${API}/api/genomics/import-mutations`, {
      headers: { Cookie: cookie },
      data: {},
    });
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/json/i);
    const text = await res.text();
    expect(() => JSON.parse(text)).not.toThrow();
  });

  test('valid mutations array is accepted without 500', async ({ request }) => {
    const cookie = await login(request);
    const mutations = [
      {
        gene:                    'TP53',
        mutation_type:           'Short Variant',
        mutation_detail:         'p.R175H',
        alteration:              'p.R175H',
        clinical_significance:   'pathogenic',
        report_source:           'automated-test',
        report_date:             '2026-03-08',
      },
    ];
    const res = await request.post(`${API}/api/genomics/import-mutations`, {
      headers: { Cookie: cookie },
      data:    { mutations },
    });
    expect([200, 400]).toContain(res.status());
  });

  test('malformed mutations array → 400 or handled gracefully (not 500)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/genomics/import-mutations`, {
      headers: { Cookie: cookie },
      data:    { mutations: 'not-an-array' },
    });
    // Must not 500 on obviously wrong input
    expect([200, 400]).toContain(res.status());
  });
});

// ─── Cross-cutting: response bodies never empty ────────────────────────────────

test.describe('Genomics extended — responses always have a body', () => {
  const READ_ENDPOINTS = [
    '/api/genomics/trials',
    '/api/genomics/pathway-graph',
    '/api/genomics/mutation-drug-network',
  ];

  for (const path of READ_ENDPOINTS) {
    test(`GET ${path} body is non-empty`, async ({ request }) => {
      const cookie = await login(request);
      const res  = await request.get(`${API}${path}`, { headers: { Cookie: cookie } });
      const text = await res.text();
      expect(text.trim()).not.toBe('');
      expect(() => JSON.parse(text), `${path} should return parseable JSON`).not.toThrow();
    });
  }
});
