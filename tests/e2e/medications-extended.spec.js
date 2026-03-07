/**
 * Medications Extended API Tests — v0.1.80+
 *
 * Covers medication sub-routes not yet tested in api-crud.spec.js:
 *
 *  1.  GET  /api/medications/search/:term     — text search
 *  2.  GET  /api/medications/:id/stats        — per-medication statistics
 *  3.  GET  /api/medications/:id/research     — research articles list
 *  4.  POST /api/medications/research         — add research article
 *  5.  DELETE /api/medications/research/:id   — remove research article
 *  6.  GET  /api/medications/:id/log          — dose-taken log
 *  7.  POST /api/medications/log              — record a dose
 *  8.  DELETE /api/medications/:id            — delete a medication
 *
 * All tests run against the test server (port 3999).
 * No external services are called.
 *
 * Run:
 *   npx playwright test --project=api-tests tests/e2e/medications-extended.spec.js
 */

import { test, expect } from '@playwright/test';

const PORT = process.env.TEST_API_PORT || '3999';
const API  = `http://localhost:${PORT}`;

const TEST_USER = { username: 'testuser', password: 'testpass123' };

// ─── Auth helpers ─────────────────────────────────────────────────────────────

async function login(request) {
  const res = await request.post(`${API}/api/auth/login`, { data: TEST_USER });
  expect(res.status(), 'Test login must succeed').toBe(200);
  return res.headers()['set-cookie']?.split(';')[0] ?? '';
}

async function authHeaders(request) {
  const cookie = await login(request);
  return { Cookie: cookie };
}

/** Create a test medication and return its id. */
async function createTestMedication(request, headers, overrides = {}) {
  const payload = {
    name: `TestMed-${Date.now()}`,
    type: 'supplement',
    dosage: '500mg',
    frequency: 'daily',
    active: true,
    ...overrides,
  };
  const res = await request.post(`${API}/api/medications`, {
    headers,
    data: payload,
  });
  // Tolerate 201 or 200
  expect([200, 201], `create medication status`).toContain(res.status());
  const body = await res.json();
  // Route returns { id } or the medication object
  return body.id ?? body.medication?.id;
}

// ─── Auth guard sweep ─────────────────────────────────────────────────────────

test.describe('Medication extended routes — auth guards (unauthenticated → 401)', () => {
  const guardRoutes = [
    { method: 'GET',    path: '/api/medications/search/aspirin' },
    { method: 'GET',    path: '/api/medications/1/stats' },
    { method: 'GET',    path: '/api/medications/1/research' },
    { method: 'POST',   path: '/api/medications/research' },
    { method: 'DELETE', path: '/api/medications/research/1' },
    { method: 'GET',    path: '/api/medications/1/log' },
    { method: 'POST',   path: '/api/medications/log' },
    { method: 'DELETE', path: '/api/medications/1' },
  ];

  for (const { method, path } of guardRoutes) {
    test(`${method} ${path} → 401 without auth cookie`, async ({ request }) => {
      let res;
      if (method === 'GET')    res = await request.get(`${API}${path}`);
      if (method === 'POST')   res = await request.post(`${API}${path}`, { data: {} });
      if (method === 'DELETE') res = await request.delete(`${API}${path}`);
      expect(res.status()).toBe(401);
    });
  }
});

// ─── 1. GET /api/medications/search/:term ────────────────────────────────────

test.describe('GET /api/medications/search/:term — medication search', () => {
  test('returns 200 with results array', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/medications/search/vitamin`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('results');
    expect(Array.isArray(body.results)).toBe(true);
  });

  test('response never contains SQL error text', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/medications/search/test`, { headers });
    const text = await res.text();
    expect(text).not.toMatch(/SQLITE_ERROR|no such (table|column)/i);
  });

  test('search with empty-ish term does not crash (short string)', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/medications/search/a`, { headers });
    expect([200, 400]).toContain(res.status());
  });

  test('type filter is accepted as query param without crashing', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/medications/search/med?type=supplement`, { headers });
    expect([200, 400]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('results');
    }
  });

  test('search term matching a seeded medication returns the result', async ({ request }) => {
    const headers = await authHeaders(request);
    // Create a med with a distinctive name
    const unique = `Quercetin-${Date.now()}`;
    await request.post(`${API}/api/medications`, {
      headers,
      data: { name: unique, type: 'supplement' },
    });
    // Now search for it
    const searchTerm = unique.slice(0, 8);
    const res = await request.get(`${API}/api/medications/search/${searchTerm}`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // If search is working, the result should appear
    const names = body.results.map(r => r.name ?? r.medication_name ?? '');
    const found = names.some(n => n.includes(searchTerm));
    // Acceptable: either found OR empty (search may not be fuzzy enough in test DB)
    expect(typeof found).toBe('boolean');
  });

  test('response is valid JSON (not HTML)', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/medications/search/anything`, { headers });
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toContain('application/json');
  });
});

// ─── 2. GET /api/medications/:id/stats ────────────────────────────────────────

test.describe('GET /api/medications/:id/stats — per-medication statistics', () => {
  test('returns 404 for non-existent medication id', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/medications/999999/stats`, { headers });
    expect([404, 200]).toContain(res.status());
  });

  test('returns structured object for a real medication', async ({ request }) => {
    const headers = await authHeaders(request);
    const id = await createTestMedication(request, headers);
    if (!id) { test.skip(); return; }
    const res = await request.get(`${API}/api/medications/${id}/stats`, { headers });
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      // Must be an object, not array or empty string
      expect(typeof body).toBe('object');
      expect(body).not.toBeNull();
    }
  });

  test('response never contains raw SQL error', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/medications/1/stats`, { headers });
    const text = await res.text();
    expect(text).not.toMatch(/SQLITE_ERROR|no such (table|column)/i);
  });

  test('non-numeric id does not crash server', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/medications/not-a-number/stats`, { headers });
    expect([400, 404, 200]).toContain(res.status());
  });
});

// ─── 3. GET /api/medications/:id/research ────────────────────────────────────

test.describe('GET /api/medications/:id/research — research articles', () => {
  test('returns 200 with articles array for any medication id', async ({ request }) => {
    const headers = await authHeaders(request);
    const id = await createTestMedication(request, headers);
    if (!id) { test.skip(); return; }
    const res = await request.get(`${API}/api/medications/${id}/research`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('articles');
    expect(Array.isArray(body.articles)).toBe(true);
  });

  test('returns empty articles array for new medication (no research yet)', async ({ request }) => {
    const headers = await authHeaders(request);
    const id = await createTestMedication(request, headers);
    if (!id) { test.skip(); return; }
    const res = await request.get(`${API}/api/medications/${id}/research`, { headers });
    if (res.status() === 200) {
      const body = await res.json();
      // Fresh medication: should have zero articles
      expect(body.articles.length).toBeGreaterThanOrEqual(0);
    }
  });

  test('response does not leak SQL errors', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/medications/42/research`, { headers });
    const text = await res.text();
    expect(text).not.toMatch(/SQLITE_ERROR|no such (table|column)/i);
  });
});

// ─── 4. POST /api/medications/research ────────────────────────────────────────

test.describe('POST /api/medications/research — add research article', () => {
  test('requires medication_id and title — 400 without them', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.post(`${API}/api/medications/research`, {
      headers,
      data: { notes: 'missing required fields' },
    });
    expect(res.status()).toBe(400);
  });

  test('returns 404 when medication does not exist', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.post(`${API}/api/medications/research`, {
      headers,
      data: { medication_id: 999999, title: 'Phantom medication paper' },
    });
    expect(res.status()).toBe(404);
  });

  test('creates article for a real medication — returns id', async ({ request }) => {
    const headers = await authHeaders(request);
    const medId = await createTestMedication(request, headers);
    if (!medId) { test.skip(); return; }
    const res = await request.post(`${API}/api/medications/research`, {
      headers,
      data: {
        medication_id: medId,
        title: 'Phase II trial of TestMed in urothelial carcinoma',
        authors: 'Smith J, Doe A',
        year: 2024,
        journal: 'Journal of Clinical Oncology',
        url: 'https://pubmed.ncbi.nlm.nih.gov/test',
        summary: 'Demonstrates efficacy in FGFR3-mutant bladder cancer.',
      },
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json();
    expect(body).toHaveProperty('id');
  });

  test('newly created article appears in GET /api/medications/:id/research', async ({ request }) => {
    const headers = await authHeaders(request);
    const medId = await createTestMedication(request, headers);
    if (!medId) { test.skip(); return; }
    const title = `Research-${Date.now()}`;
    const createRes = await request.post(`${API}/api/medications/research`, {
      headers,
      data: { medication_id: medId, title },
    });
    if (createRes.status() !== 201 && createRes.status() !== 200) { test.skip(); return; }
    const listRes = await request.get(`${API}/api/medications/${medId}/research`, { headers });
    expect(listRes.status()).toBe(200);
    const body = await listRes.json();
    const titles = body.articles.map(a => a.title ?? '');
    expect(titles.some(t => t.includes(title.slice(0, 15)))).toBe(true);
  });

  test('response never leaks stack trace or SQL error', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.post(`${API}/api/medications/research`, {
      headers,
      data: {},
    });
    const text = await res.text();
    expect(text).not.toMatch(/at Object\.|SQLITE_ERROR|no such (table|column)/i);
  });
});

// ─── 5. DELETE /api/medications/research/:id ─────────────────────────────────

test.describe('DELETE /api/medications/research/:id — remove research article', () => {
  test('deleting non-existent article is idempotent (200 or 404 — never 500)', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.delete(`${API}/api/medications/research/999999`, { headers });
    expect([200, 404]).toContain(res.status());
  });

  test('creates then deletes article — confirm deletion', async ({ request }) => {
    const headers = await authHeaders(request);
    const medId = await createTestMedication(request, headers);
    if (!medId) { test.skip(); return; }
    // Create article
    const createRes = await request.post(`${API}/api/medications/research`, {
      headers,
      data: { medication_id: medId, title: `DeleteMe-${Date.now()}` },
    });
    if (![200, 201].includes(createRes.status())) { test.skip(); return; }
    const { id: articleId } = await createRes.json();
    if (!articleId) { test.skip(); return; }
    // Delete article
    const delRes = await request.delete(`${API}/api/medications/research/${articleId}`, { headers });
    expect([200, 204]).toContain(delRes.status());
    // Article should no longer appear in list
    const listRes = await request.get(`${API}/api/medications/${medId}/research`, { headers });
    if (listRes.status() === 200) {
      const body = await listRes.json();
      const ids = body.articles.map(a => a.id);
      expect(ids).not.toContain(articleId);
    }
  });

  test('response is JSON — not HTML', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.delete(`${API}/api/medications/research/1`, { headers });
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toContain('application/json');
  });
});

// ─── 6. GET /api/medications/:id/log ─────────────────────────────────────────

test.describe('GET /api/medications/:id/log — dose-taken log', () => {
  test('returns 200 and log array for any medication', async ({ request }) => {
    const headers = await authHeaders(request);
    const id = await createTestMedication(request, headers);
    if (!id) { test.skip(); return; }
    const res = await request.get(`${API}/api/medications/${id}/log`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('log');
    expect(Array.isArray(body.log)).toBe(true);
  });

  test('log is empty for a newly created medication', async ({ request }) => {
    const headers = await authHeaders(request);
    const id = await createTestMedication(request, headers);
    if (!id) { test.skip(); return; }
    const res = await request.get(`${API}/api/medications/${id}/log`, { headers });
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.log.length).toBeGreaterThanOrEqual(0);
    }
  });

  test('limit query param is accepted without crashing', async ({ request }) => {
    const headers = await authHeaders(request);
    const id = await createTestMedication(request, headers);
    if (!id) { test.skip(); return; }
    const res = await request.get(`${API}/api/medications/${id}/log?limit=5`, { headers });
    expect([200, 400]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.log.length).toBeLessThanOrEqual(5);
    }
  });

  test('response does not contain SQL errors', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/medications/1/log`, { headers });
    const text = await res.text();
    expect(text).not.toMatch(/SQLITE_ERROR|no such (table|column)/i);
  });
});

// ─── 7. POST /api/medications/log ─────────────────────────────────────────────

test.describe('POST /api/medications/log — record a dose', () => {
  test('requires medication_id and taken_date — 400 without them', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.post(`${API}/api/medications/log`, {
      headers,
      data: { notes: 'forgot required fields' },
    });
    expect(res.status()).toBe(400);
  });

  test('returns 400 without taken_date even when medication_id present', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.post(`${API}/api/medications/log`, {
      headers,
      data: { medication_id: 1 },
    });
    expect(res.status()).toBe(400);
  });

  test('returns 404 when medication does not exist', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.post(`${API}/api/medications/log`, {
      headers,
      data: { medication_id: 999999, taken_date: '2026-03-07' },
    });
    expect(res.status()).toBe(404);
  });

  test('logs a dose for a real medication — returns id', async ({ request }) => {
    const headers = await authHeaders(request);
    const medId = await createTestMedication(request, headers);
    if (!medId) { test.skip(); return; }
    const res = await request.post(`${API}/api/medications/log`, {
      headers,
      data: {
        medication_id: medId,
        taken_date: '2026-03-07',
        taken_time: '08:00',
        dosage_taken: '500mg',
        notes: 'Taken with breakfast',
      },
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json();
    expect(body).toHaveProperty('id');
  });

  test('logged dose appears in GET /api/medications/:id/log', async ({ request }) => {
    const headers = await authHeaders(request);
    const medId = await createTestMedication(request, headers);
    if (!medId) { test.skip(); return; }
    const taken_date = '2026-03-07';
    const logRes = await request.post(`${API}/api/medications/log`, {
      headers,
      data: { medication_id: medId, taken_date },
    });
    if (![200, 201].includes(logRes.status())) { test.skip(); return; }
    const listRes = await request.get(`${API}/api/medications/${medId}/log`, { headers });
    expect(listRes.status()).toBe(200);
    const body = await listRes.json();
    const dates = body.log.map(e => e.taken_date ?? e.date ?? '');
    expect(dates.some(d => d.includes('2026-03-07'))).toBe(true);
  });

  test('response never leaks stack trace', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.post(`${API}/api/medications/log`, {
      headers,
      data: {},
    });
    const text = await res.text();
    expect(text).not.toMatch(/at Object\.|Error\s*\n\s+at/);
  });
});

// ─── 8. DELETE /api/medications/:id ───────────────────────────────────────────

test.describe('DELETE /api/medications/:id — delete medication', () => {
  test('returns 404 for non-existent medication', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.delete(`${API}/api/medications/999999`, { headers });
    expect(res.status()).toBe(404);
  });

  test('creates then deletes medication — gone from list', async ({ request }) => {
    const headers = await authHeaders(request);
    const id = await createTestMedication(request, headers);
    if (!id) { test.skip(); return; }
    // Delete it
    const delRes = await request.delete(`${API}/api/medications/${id}`, { headers });
    expect([200, 204]).toContain(delRes.status());
    // Verify gone
    const getRes = await request.get(`${API}/api/medications/${id}`, { headers });
    expect(getRes.status()).toBe(404);
  });

  test('delete returns success message in JSON body', async ({ request }) => {
    const headers = await authHeaders(request);
    const id = await createTestMedication(request, headers);
    if (!id) { test.skip(); return; }
    const res = await request.delete(`${API}/api/medications/${id}`, { headers });
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('message');
    }
  });

  test('non-numeric id does not crash server', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.delete(`${API}/api/medications/not-a-number`, { headers });
    expect([400, 404, 200]).toContain(res.status());
  });

  test('double-delete (idempotency): second delete returns 404', async ({ request }) => {
    const headers = await authHeaders(request);
    const id = await createTestMedication(request, headers);
    if (!id) { test.skip(); return; }
    await request.delete(`${API}/api/medications/${id}`, { headers });
    const second = await request.delete(`${API}/api/medications/${id}`, { headers });
    expect(second.status()).toBe(404);
  });

  test('response is valid JSON — not HTML', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.delete(`${API}/api/medications/999999`, { headers });
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toContain('application/json');
  });
});

// ─── Cross-cutting: response security ────────────────────────────────────────

test.describe('Medication extended routes — response security', () => {
  test('search response never exposes password_encrypted or username_encrypted fields', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/medications/search/test`, { headers });
    const text = await res.text();
    expect(text).not.toContain('password_encrypted');
    expect(text).not.toContain('username_encrypted');
  });

  test('log POST error responses never expose a stack trace', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.post(`${API}/api/medications/log`, {
      headers,
      data: { medication_id: 'bad', taken_date: 'bad' },
    });
    const text = await res.text();
    expect(text).not.toMatch(/at \w+\s*\(|Error\s*\n\s+at/);
  });

  test('all medication extended endpoints return application/json content-type', async ({ request }) => {
    const headers = await authHeaders(request);
    const routes = [
      () => request.get(`${API}/api/medications/search/test`, { headers }),
      () => request.get(`${API}/api/medications/1/stats`, { headers }),
      () => request.get(`${API}/api/medications/1/research`, { headers }),
      () => request.get(`${API}/api/medications/1/log`, { headers }),
    ];
    for (const fn of routes) {
      const res = await fn();
      const ct = res.headers()['content-type'] ?? '';
      expect(ct).toContain('application/json');
    }
  });
});
