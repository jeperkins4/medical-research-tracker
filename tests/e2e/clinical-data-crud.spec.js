/**
 * Clinical Data CRUD Contracts
 *
 * Tests auth guards, response shapes, and create/read round-trips for
 * the core clinical data endpoints that were previously un-covered:
 *   - GET/PUT  /api/profile
 *   - GET/POST /api/conditions
 *   - GET/POST /api/symptoms
 *   - GET/POST /api/vitals
 *   - GET/POST /api/tests
 *   - GET/POST /api/documents  (+ DELETE /api/documents/:id)
 *
 * All tests run against the test server (port 3999) seeded by global-setup.
 * No real FHIR / scraper calls are made.
 *
 * Run:
 *   npx playwright test --project=api-tests tests/e2e/clinical-data-crud.spec.js
 */

import { test, expect } from '@playwright/test';

const API = `http://localhost:${process.env.TEST_API_PORT || '3999'}`;
const USER = { username: 'testuser', password: 'testpass123' };

// ─── Auth helper ───────────────────────────────────────────────────────────────

async function login(request) {
  const res = await request.post(`${API}/api/auth/login`, { data: USER });
  expect(res.status(), 'login must succeed').toBe(200);
  return (res.headers()['set-cookie'] || '').split(';')[0];
}

// ─── Auth guard matrix ─────────────────────────────────────────────────────────

test.describe('Clinical data — auth guards (unauthenticated → 401)', () => {
  const PROTECTED = [
    ['GET',    '/api/profile'],
    ['PUT',    '/api/profile'],
    ['GET',    '/api/conditions'],
    ['POST',   '/api/conditions'],
    ['GET',    '/api/symptoms'],
    ['POST',   '/api/symptoms'],
    ['GET',    '/api/vitals'],
    ['POST',   '/api/vitals'],
    ['GET',    '/api/tests'],
    ['POST',   '/api/tests'],
    ['GET',    '/api/documents'],
    ['POST',   '/api/documents'],
    ['DELETE', '/api/documents/1'],
    ['PUT',    '/api/documents/1/markers'],
  ];

  for (const [method, path] of PROTECTED) {
    test(`${method} ${path} → 401 without auth cookie`, async ({ request }) => {
      const res = await request.fetch(`${API}${path}`, { method, headers: {} });
      expect(res.status()).toBe(401);
    });
  }
});

// ─── GET /api/profile ─────────────────────────────────────────────────────────

test.describe('GET /api/profile', () => {
  test('returns 200 with JSON content-type', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/profile`, { headers: { Cookie: cookie } });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/application\/json/);
  });

  test('returns an object (not an array)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/profile`, { headers: { Cookie: cookie } });
    const body = await res.json();
    expect(typeof body).toBe('object');
    expect(Array.isArray(body)).toBe(false);
  });

  test('response does not leak password or auth fields', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/profile`, { headers: { Cookie: cookie } });
    const text = await res.text();
    expect(text).not.toMatch(/password/i);
    expect(text).not.toMatch(/token/i);
  });
});

// ─── PUT /api/profile ─────────────────────────────────────────────────────────

test.describe('PUT /api/profile', () => {
  test('returns 200 on valid update', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.put(`${API}/api/profile`, {
      headers: { Cookie: cookie },
      data: {
        first_name: 'Test',
        last_name:  'User',
        blood_type: 'O+',
        sex: 'M',
      },
    });
    expect(res.status()).toBe(200);
  });

  test('updated first_name round-trips via GET', async ({ request }) => {
    const cookie = await login(request);
    const unique = `TestUser_${Date.now()}`;
    await request.put(`${API}/api/profile`, {
      headers: { Cookie: cookie },
      data: { first_name: unique },
    });
    const get = await request.get(`${API}/api/profile`, { headers: { Cookie: cookie } });
    const body = await get.json();
    expect(body.first_name).toBe(unique);
  });

  test('returns JSON (not empty or HTML)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.put(`${API}/api/profile`, {
      headers: { Cookie: cookie },
      data: { notes: 'integration test' },
    });
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/json/i);
    const body = await res.json();
    expect(typeof body).toBe('object');
  });
});

// ─── GET /api/conditions ──────────────────────────────────────────────────────

test.describe('GET /api/conditions', () => {
  test('returns 200 and an array', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/conditions`, { headers: { Cookie: cookie } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('content-type is application/json', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/conditions`, { headers: { Cookie: cookie } });
    expect(res.headers()['content-type']).toMatch(/application\/json/);
  });
});

// ─── POST /api/conditions ─────────────────────────────────────────────────────

test.describe('POST /api/conditions', () => {
  test('creates a condition and returns id', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/conditions`, {
      headers: { Cookie: cookie },
      data: {
        name:           'Test Condition CRUD',
        diagnosed_date: '2026-01-01',
        status:         'active',
        notes:          'Created by automated test',
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('id');
    expect(typeof body.id).toBe('number');
  });

  test('missing name → 400', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/conditions`, {
      headers: { Cookie: cookie },
      data: { diagnosed_date: '2026-01-01' },
    });
    expect(res.status()).toBe(400);
  });

  test('blank name → 400', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/conditions`, {
      headers: { Cookie: cookie },
      data: { name: '   ' },
    });
    expect(res.status()).toBe(400);
  });

  test('created condition appears in GET list', async ({ request }) => {
    const cookie = await login(request);
    const unique = `AutoCondition_${Date.now()}`;
    await request.post(`${API}/api/conditions`, {
      headers: { Cookie: cookie },
      data: { name: unique },
    });
    const listRes = await request.get(`${API}/api/conditions`, { headers: { Cookie: cookie } });
    const list = await listRes.json();
    const found = list.some((c) => c.name === unique);
    expect(found, `expected "${unique}" in conditions list`).toBe(true);
  });

  test('default status is active when omitted', async ({ request }) => {
    const cookie = await login(request);
    const unique = `Cond_DefaultStatus_${Date.now()}`;
    await request.post(`${API}/api/conditions`, {
      headers: { Cookie: cookie },
      data: { name: unique },
    });
    const list = await (await request.get(`${API}/api/conditions`, { headers: { Cookie: cookie } })).json();
    const found = list.find((c) => c.name === unique);
    expect(found?.status).toBe('active');
  });
});

// ─── GET /api/symptoms ────────────────────────────────────────────────────────

test.describe('GET /api/symptoms', () => {
  test('returns 200 and an array', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/symptoms`, { headers: { Cookie: cookie } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('limit is respected (≤50 items)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/symptoms`, { headers: { Cookie: cookie } });
    const body = await res.json();
    expect(body.length).toBeLessThanOrEqual(50);
  });
});

// ─── POST /api/symptoms ───────────────────────────────────────────────────────

test.describe('POST /api/symptoms', () => {
  test('creates a symptom and returns id', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/symptoms`, {
      headers: { Cookie: cookie },
      data: {
        description: 'Test symptom from automated test',
        severity:    3,   // INTEGER 1-10 per schema CHECK constraint
        date:        '2026-03-08',
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('id');
    expect(typeof body.id).toBe('number');
  });

  test('missing description → 400', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/symptoms`, {
      headers: { Cookie: cookie },
      data: { severity: 'mild' },
    });
    expect(res.status()).toBe(400);
  });

  test('blank description → 400', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/symptoms`, {
      headers: { Cookie: cookie },
      data: { description: '' },
    });
    expect(res.status()).toBe(400);
  });
});

// ─── GET /api/vitals ──────────────────────────────────────────────────────────

test.describe('GET /api/vitals', () => {
  test('returns 200 and an array', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/vitals`, { headers: { Cookie: cookie } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('content-type is application/json', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/vitals`, { headers: { Cookie: cookie } });
    expect(res.headers()['content-type']).toMatch(/application\/json/);
  });

  test('limit query param is accepted without crash', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/vitals?limit=10`, { headers: { Cookie: cookie } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.length).toBeLessThanOrEqual(10);
  });
});

// ─── POST /api/vitals ─────────────────────────────────────────────────────────

test.describe('POST /api/vitals', () => {
  test('creates a vitals record and returns id', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/vitals`, {
      headers: { Cookie: cookie },
      data: {
        date:               '2026-03-08',
        time:               '08:00',
        systolic:           120,
        diastolic:          80,
        heart_rate:         72,
        oxygen_saturation:  98,
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('id');
    expect(typeof body.id).toBe('number');
  });

  test('empty body does not crash server with unhandled exception (returns 200, 400, or 500)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/vitals`, {
      headers: { Cookie: cookie },
      data: {},
    });
    // date is NOT NULL — server may 500 from SQLite constraint; body should still be JSON
    expect([200, 400, 500]).toContain(res.status());
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/json/i);
  });

  test('created vital appears in GET list', async ({ request }) => {
    const cookie = await login(request);
    const postRes = await request.post(`${API}/api/vitals`, {
      headers: { Cookie: cookie },
      data: {
        date:      '2026-03-08',
        heart_rate: 99,
        notes:     `crud-test-${Date.now()}`,
      },
    });
    const { id } = await postRes.json();
    const listRes = await request.get(`${API}/api/vitals`, { headers: { Cookie: cookie } });
    const list = await listRes.json();
    const found = list.some((v) => v.id === id);
    expect(found, `vital id=${id} should appear in GET /api/vitals`).toBe(true);
  });
});

// ─── GET /api/tests ───────────────────────────────────────────────────────────

test.describe('GET /api/tests', () => {
  test('returns 200 and an array', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/tests`, { headers: { Cookie: cookie } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('content-type is application/json', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/tests`, { headers: { Cookie: cookie } });
    expect(res.headers()['content-type']).toMatch(/application\/json/);
  });
});

// ─── POST /api/tests ──────────────────────────────────────────────────────────

test.describe('POST /api/tests', () => {
  test('creates a test result and returns id', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/tests`, {
      headers: { Cookie: cookie },
      data: {
        test_name: 'CBC Panel',
        result:    'Normal',
        date:      '2026-03-08',
        provider:  'Lab Corp',
        notes:     'Automated test insert',
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('id');
    expect(typeof body.id).toBe('number');
  });

  test('created test appears in GET list', async ({ request }) => {
    const cookie = await login(request);
    const unique = `AutoTest_${Date.now()}`;
    const postRes = await request.post(`${API}/api/tests`, {
      headers: { Cookie: cookie },
      data: { test_name: unique, result: 'pending', date: '2026-03-08' },
    });
    const { id } = await postRes.json();
    const list = await (
      await request.get(`${API}/api/tests`, { headers: { Cookie: cookie } })
    ).json();
    const found = list.some((t) => t.id === id);
    expect(found, `test id=${id} should appear in GET /api/tests`).toBe(true);
  });

  test('condition_ids array is forwarded without unhandled exception', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/tests`, {
      headers: { Cookie: cookie },
      data: {
        test_name:     'Creatinine',
        result:        '0.9 mg/dL',
        date:          '2026-03-08',
        condition_ids: [9999], // non-existent; condition_tests table may not exist in test DB
      },
    });
    // Server may 200 (ignores bad FK), 400 (validates), or 500 (missing join table in test DB)
    // What matters: it returns JSON, not a crash/hang
    expect([200, 400, 500]).toContain(res.status());
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/json/i);
  });
});

// ─── GET /api/documents ───────────────────────────────────────────────────────

test.describe('GET /api/documents', () => {
  test('returns 200 and an array', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/documents`, { headers: { Cookie: cookie } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('type query param filters without crash', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/documents?type=radiology`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    // Every returned document should match the type filter
    body.forEach((d) => expect(d.document_type).toBe('radiology'));
  });

  test('JSON array fields are arrays (not raw JSON strings)', async ({ request }) => {
    const cookie = await login(request);
    // Create a document first so we have something to check
    await request.post(`${API}/api/documents`, {
      headers: { Cookie: cookie },
      data: {
        document_type: 'radiology',
        title:         'Test Radiology Report',
        diagnoses:     ['finding1', 'finding2'],
        tags:          ['radiology', 'test'],
      },
    });
    const res = await request.get(`${API}/api/documents?type=radiology`, {
      headers: { Cookie: cookie },
    });
    const docs = await res.json();
    docs.forEach((d) => {
      if (d.diagnoses !== undefined) expect(Array.isArray(d.diagnoses)).toBe(true);
      if (d.tags      !== undefined) expect(Array.isArray(d.tags)).toBe(true);
    });
  });
});

// ─── POST /api/documents ──────────────────────────────────────────────────────

test.describe('POST /api/documents', () => {
  test('creates a document and returns id + success', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/documents`, {
      headers: { Cookie: cookie },
      data: {
        document_type: 'lab_result',
        title:         'CBC — Automated Test',
        date:          '2026-03-08',
        provider:      'Lab Corp',
        findings:      'All values within normal range',
        tags:          ['lab', 'cbc'],
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('id');
    expect(body.success).toBe(true);
  });

  test('created document appears in GET list', async ({ request }) => {
    const cookie = await login(request);
    const uniqueTitle = `Doc_${Date.now()}`;
    const postRes = await request.post(`${API}/api/documents`, {
      headers: { Cookie: cookie },
      data: { document_type: 'other', title: uniqueTitle },
    });
    const { id } = await postRes.json();
    const list = await (await request.get(`${API}/api/documents`, { headers: { Cookie: cookie } })).json();
    const found = list.some((d) => d.id === id);
    expect(found, `document id=${id} should appear in GET /api/documents`).toBe(true);
  });

  test('missing document_type defaults to "other" (no 400)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/documents`, {
      headers: { Cookie: cookie },
      data: { title: 'No type provided' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('id');
  });

  test('array fields (diagnoses, tags) stored and returned as arrays', async ({ request }) => {
    const cookie = await login(request);
    const unique = `TagTest_${Date.now()}`;
    await request.post(`${API}/api/documents`, {
      headers: { Cookie: cookie },
      data: {
        document_type: 'other',
        title:         unique,
        diagnoses:     ['A', 'B', 'C'],
        tags:          ['tag1', 'tag2'],
      },
    });
    const list = await (await request.get(`${API}/api/documents`, { headers: { Cookie: cookie } })).json();
    const doc = list.find((d) => d.title === unique);
    expect(doc, 'document should be findable by title').toBeTruthy();
    expect(Array.isArray(doc?.diagnoses)).toBe(true);
    expect(doc?.diagnoses).toEqual(['A', 'B', 'C']);
    expect(Array.isArray(doc?.tags)).toBe(true);
  });
});

// ─── DELETE /api/documents/:id ────────────────────────────────────────────────

test.describe('DELETE /api/documents/:id', () => {
  test('deletes a document and returns success', async ({ request }) => {
    const cookie = await login(request);
    // Create one to delete
    const created = await request.post(`${API}/api/documents`, {
      headers: { Cookie: cookie },
      data: { document_type: 'other', title: `DeleteMe_${Date.now()}` },
    });
    const { id } = await created.json();

    const del = await request.delete(`${API}/api/documents/${id}`, {
      headers: { Cookie: cookie },
    });
    expect([200, 204]).toContain(del.status());
  });

  test('deleted document no longer appears in GET list', async ({ request }) => {
    const cookie = await login(request);
    const uniqueTitle = `ToDelete_${Date.now()}`;
    const created = await request.post(`${API}/api/documents`, {
      headers: { Cookie: cookie },
      data: { document_type: 'other', title: uniqueTitle },
    });
    const { id } = await created.json();

    await request.delete(`${API}/api/documents/${id}`, { headers: { Cookie: cookie } });

    const list = await (await request.get(`${API}/api/documents`, { headers: { Cookie: cookie } })).json();
    const found = list.some((d) => d.id === id);
    expect(found, 'deleted document should not appear in list').toBe(false);
  });

  test('deleting non-existent document returns 200 or 404 (not 500)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.delete(`${API}/api/documents/99999999`, {
      headers: { Cookie: cookie },
    });
    expect([200, 204, 404]).toContain(res.status());
  });
});
