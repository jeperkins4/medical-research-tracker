/**
 * Health Data CRUD API Tests — v0.1.78+
 *
 * Covers core health-data routes not yet tested in api.spec.js or api-extended.spec.js:
 *
 *  1.  Conditions     — GET/POST /api/conditions
 *  2.  Symptoms       — GET/POST /api/symptoms
 *  3.  Medications    — GET/POST /api/medications, PUT /api/medications/:id
 *  4.  Vitals         — GET/POST /api/vitals
 *  5.  Test Results   — GET/POST /api/tests
 *  6.  Papers         — GET/POST /api/papers
 *  7.  Profile        — GET/PUT /api/profile
 *  8.  Analytics sub  — GET /api/analytics/{user-metrics,diagnoses,mutations,treatments,demographics}
 *  9.  Nutrition read  — GET /api/nutrition/dashboard, /api/nutrition/recommendations
 * 10.  Auth guard sweep — all write routes require auth
 *
 * All tests run deterministically against the test server (port 3999).
 * No external services are called.
 *
 * Run:
 *   npx playwright test --project=api-tests tests/e2e/api-crud.spec.js
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

async function authHeaders(request) {
  const cookie = await login(request);
  return { Cookie: cookie };
}

// ─── 1. Conditions ────────────────────────────────────────────────────────────

test.describe('GET /api/conditions', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.get(`${API}/api/conditions`);
    expect(res.status()).toBe(401);
  });

  test('returns 200 with an array', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/conditions`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('no SQL errors in response', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/conditions`, { headers });
    const text = await res.text();
    expect(text).not.toMatch(/SqliteError|no such (column|table)/i);
  });
});

test.describe('POST /api/conditions', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.post(`${API}/api/conditions`, {
      data: { name: 'Test', status: 'active' },
    });
    expect(res.status()).toBe(401);
  });

  test('creates a condition and returns id', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.post(`${API}/api/conditions`, {
      headers,
      data: { name: 'Urothelial Carcinoma', status: 'active', diagnosed_date: '2025-01-15' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('id');
    expect(typeof body.id).toBe('number');
  });

  test('created condition appears in GET list', async ({ request }) => {
    const headers = await authHeaders(request);
    const uniqueName = `Condition-${Date.now()}`;
    await request.post(`${API}/api/conditions`, {
      headers,
      data: { name: uniqueName, status: 'active' },
    });
    const listRes = await request.get(`${API}/api/conditions`, { headers });
    const list = await listRes.json();
    const found = list.find(c => c.name === uniqueName);
    expect(found).toBeDefined();
    expect(found.status).toBe('active');
  });
});

// ─── 2. Symptoms ──────────────────────────────────────────────────────────────

test.describe('GET /api/symptoms', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.get(`${API}/api/symptoms`);
    expect(res.status()).toBe(401);
  });

  test('returns 200 with an array', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/symptoms`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('no SQL errors in response', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/symptoms`, { headers });
    const text = await res.text();
    expect(text).not.toMatch(/SqliteError|no such (column|table)/i);
  });
});

test.describe('POST /api/symptoms', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.post(`${API}/api/symptoms`, {
      data: { name: 'Fatigue', severity: 3 },
    });
    expect(res.status()).toBe(401);
  });

  test('creates a symptom and returns id', async ({ request }) => {
    const headers = await authHeaders(request);
    // Server expects 'description' field (not 'name') for symptoms
    const res = await request.post(`${API}/api/symptoms`, {
      headers,
      data: { description: 'Fatigue', severity: 3, date: '2025-11-01' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('id');
  });
});

// ─── 3. Medications ───────────────────────────────────────────────────────────

test.describe('GET /api/medications', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.get(`${API}/api/medications`);
    expect(res.status()).toBe(401);
  });

  test('returns 200 with medications data', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/medications`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Enhanced route returns { medications: [...] }; basic route returns raw array
    expect(body).not.toBeNull();
    const meds = Array.isArray(body) ? body : body.medications;
    expect(Array.isArray(meds)).toBe(true);
  });

  test('no SQL errors in response', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/medications`, { headers });
    const text = await res.text();
    expect(text).not.toMatch(/SqliteError|no such (column|table)/i);
  });
});

test.describe('POST /api/medications', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.post(`${API}/api/medications`, {
      data: { name: 'Erdafitinib' },
    });
    expect(res.status()).toBe(401);
  });

  test('creates a medication and returns id', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.post(`${API}/api/medications`, {
      headers,
      data: {
        name: 'Erdafitinib',
        type: 'prescription',
        dosage: '8mg',
        frequency: 'daily',
        started_date: '2025-09-01',
      },
    });
    // Enhanced route returns 201; basic index.js route returns 200
    expect([200, 201]).toContain(res.status());
    const body = await res.json();
    expect(body).toHaveProperty('id');
  });

  test('created medication visible in GET list', async ({ request }) => {
    const headers = await authHeaders(request);
    const uniqueName = `Med-${Date.now()}`;
    await request.post(`${API}/api/medications`, {
      headers,
      data: { name: uniqueName, type: 'supplement' },
    });
    const listRes = await request.get(`${API}/api/medications`, { headers });
    const listBody = await listRes.json();
    // Enhanced route returns { medications: [...] }; basic route returns raw array
    const list = Array.isArray(listBody) ? listBody : (listBody.medications ?? []);
    const found = list.find(m => m.name === uniqueName);
    expect(found).toBeDefined();
  });
});

test.describe('PUT /api/medications/:id', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.put(`${API}/api/medications/1`, {
      data: { name: 'Updated' },
    });
    expect(res.status()).toBe(401);
  });

  test('updates an existing medication', async ({ request }) => {
    const headers = await authHeaders(request);
    // Create first (type required by enhanced route)
    const createRes = await request.post(`${API}/api/medications`, {
      headers,
      data: { name: `UpdateTarget-${Date.now()}`, type: 'supplement' },
    });
    expect([200, 201]).toContain(createRes.status());
    const { id } = await createRes.json();

    // Update it
    const updateRes = await request.put(`${API}/api/medications/${id}`, {
      headers,
      data: { name: 'Updated Medication', dosage: '200mg', active: false },
    });
    expect([200, 204]).toContain(updateRes.status());
  });

  test('handles non-existent medication gracefully (no crash)', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.put(`${API}/api/medications/999999`, {
      headers,
      data: { name: 'Ghost' },
    });
    // Server returns 404 if not found, or 200 with 0 rows changed — either is acceptable
    expect([200, 400, 404, 422]).toContain(res.status());
  });
});

// ─── 4. Vitals ────────────────────────────────────────────────────────────────

test.describe('GET /api/vitals', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.get(`${API}/api/vitals`);
    expect(res.status()).toBe(401);
  });

  test('returns 200 with an array', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/vitals`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('no SQL errors in response', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/vitals`, { headers });
    const text = await res.text();
    expect(text).not.toMatch(/SqliteError|no such (column|table)/i);
  });
});

test.describe('POST /api/vitals', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.post(`${API}/api/vitals`, {
      data: { date: '2025-11-01', weight_lbs: 185 },
    });
    expect(res.status()).toBe(401);
  });

  test('creates a vital record and returns id', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.post(`${API}/api/vitals`, {
      headers,
      data: {
        date: '2025-11-15',
        time: '08:00',
        systolic: 120,
        diastolic: 78,
        heart_rate: 62,
        weight_lbs: 182,
        pain_level: 2,
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('id');
  });

  test('created vital appears in GET list', async ({ request }) => {
    const headers = await authHeaders(request);
    const uniqueDate = '2025-12-31';
    await request.post(`${API}/api/vitals`, {
      headers,
      data: { date: uniqueDate, weight_lbs: 180 },
    });
    const listRes = await request.get(`${API}/api/vitals`, { headers });
    const list = await listRes.json();
    const found = list.find(v => v.date === uniqueDate);
    expect(found).toBeDefined();
  });
});

// ─── 5. Test Results (/api/tests) ─────────────────────────────────────────────

test.describe('GET /api/tests', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.get(`${API}/api/tests`);
    expect(res.status()).toBe(401);
  });

  test('returns 200 with an array', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/tests`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('no SQL errors in response', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/tests`, { headers });
    const text = await res.text();
    expect(text).not.toMatch(/SqliteError|no such (column|table)/i);
  });
});

test.describe('POST /api/tests', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.post(`${API}/api/tests`, {
      data: { test_name: 'CBC', result: 'normal', date: '2025-11-01' },
    });
    expect(res.status()).toBe(401);
  });

  test('creates a test result and returns id', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.post(`${API}/api/tests`, {
      headers,
      data: {
        test_name: 'Creatinine',
        result: '0.9',
        unit: 'mg/dL',
        reference_range: '0.7-1.2',
        date: '2025-11-01',
        status: 'normal',
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('id');
  });

  test('created test result appears in GET list', async ({ request }) => {
    const headers = await authHeaders(request);
    const uniqueName = `LabTest-${Date.now()}`;
    await request.post(`${API}/api/tests`, {
      headers,
      data: { test_name: uniqueName, result: '42', date: '2025-11-01' },
    });
    const listRes = await request.get(`${API}/api/tests`, { headers });
    const list = await listRes.json();
    const found = list.find(t => t.test_name === uniqueName);
    expect(found).toBeDefined();
  });
});

// ─── 6. Papers ────────────────────────────────────────────────────────────────

test.describe('GET /api/papers', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.get(`${API}/api/papers`);
    expect(res.status()).toBe(401);
  });

  test('returns 200 with an array', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/papers`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('no SQL errors in response', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/papers`, { headers });
    const text = await res.text();
    expect(text).not.toMatch(/SqliteError|no such (column|table)/i);
  });
});

test.describe('POST /api/papers', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.post(`${API}/api/papers`, {
      data: { title: 'FGFR3 Inhibition in Bladder Cancer' },
    });
    expect(res.status()).toBe(401);
  });

  test('creates a paper and returns id', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.post(`${API}/api/papers`, {
      headers,
      data: {
        title: `ARID1A Synthetic Lethality - ${Date.now()}`,
        authors: 'Varambally S, et al.',
        journal: 'Cancer Research',
        year: 2025,
        url: 'https://pubmed.ncbi.nlm.nih.gov/example',
        relevance: 'high',
        summary: 'EZH2 inhibitor sensitivity in ARID1A-deficient tumors.',
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('id');
  });
});

// ─── 7. Profile ───────────────────────────────────────────────────────────────

test.describe('GET /api/profile', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.get(`${API}/api/profile`);
    expect(res.status()).toBe(401);
  });

  test('returns 200 with profile object', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/profile`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).not.toBeNull();
    expect(typeof body).toBe('object');
  });

  test('no SQL errors in response', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/profile`, { headers });
    const text = await res.text();
    expect(text).not.toMatch(/SqliteError|no such (column|table)/i);
  });
});

test.describe('PUT /api/profile', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.put(`${API}/api/profile`, {
      data: { first_name: 'John' },
    });
    expect(res.status()).toBe(401);
  });

  test('updates profile fields successfully', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.put(`${API}/api/profile`, {
      headers,
      data: {
        first_name: 'John',
        last_name: 'Perkins',
        date_of_birth: '1968-01-01',
        primary_diagnosis: 'Urothelial Carcinoma',
      },
    });
    expect([200, 204]).toContain(res.status());
  });
});

// ─── 8. Analytics sub-routes ──────────────────────────────────────────────────

const analyticsSubRoutes = [
  '/api/analytics/user-metrics',
  '/api/analytics/diagnoses',
  '/api/analytics/mutations',
  '/api/analytics/treatments',
  '/api/analytics/demographics',
];

test.describe('Analytics sub-routes — auth guards', () => {
  for (const route of analyticsSubRoutes) {
    test(`GET ${route} → 401 without auth`, async ({ request }) => {
      const res = await request.get(`${API}${route}`);
      expect(res.status()).toBe(401);
    });
  }
});

test.describe('Analytics sub-routes — authenticated responses', () => {
  for (const route of analyticsSubRoutes) {
    test(`GET ${route} → 200 with object/array`, async ({ request }) => {
      const headers = await authHeaders(request);
      const res = await request.get(`${API}${route}`, { headers });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).not.toBeNull();
    });

    test(`GET ${route} → no SQL errors`, async ({ request }) => {
      const headers = await authHeaders(request);
      const res = await request.get(`${API}${route}`, { headers });
      const text = await res.text();
      expect(text).not.toMatch(/SqliteError|no such (column|table)/i);
    });

    test(`GET ${route} → returns JSON content-type`, async ({ request }) => {
      const headers = await authHeaders(request);
      const res = await request.get(`${API}${route}`, { headers });
      const ct = res.headers()['content-type'] || '';
      expect(ct).toMatch(/application\/json/);
    });
  }
});

// ─── 9. Nutrition read routes ─────────────────────────────────────────────────

test.describe('GET /api/nutrition/dashboard', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.get(`${API}/api/nutrition/dashboard`);
    expect(res.status()).toBe(401);
  });

  test('returns 200 with a non-null object', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/nutrition/dashboard`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).not.toBeNull();
  });

  test('no SQL errors in response', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/nutrition/dashboard`, { headers });
    const text = await res.text();
    expect(text).not.toMatch(/SqliteError|no such (column|table)/i);
  });
});

test.describe('GET /api/nutrition/recommendations', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.get(`${API}/api/nutrition/recommendations`);
    expect(res.status()).toBe(401);
  });

  test('returns 200 with an array or object', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/nutrition/recommendations`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).not.toBeNull();
  });

  test('accepts optional date query param without crashing', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/nutrition/recommendations?date=2025-11-15`, { headers });
    expect(res.status()).toBe(200);
  });

  test('no SQL errors in response', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/nutrition/recommendations`, { headers });
    const text = await res.text();
    expect(text).not.toMatch(/SqliteError|no such (column|table)/i);
  });
});

// ─── 10. Condition-Vitals association ─────────────────────────────────────────

test.describe('POST /api/conditions/:conditionId/vitals/:vitalId', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.post(`${API}/api/conditions/1/vitals/1`);
    expect(res.status()).toBe(401);
  });

  test('associates a vital with a condition (idempotent)', async ({ request }) => {
    const headers = await authHeaders(request);

    // Create condition + vital first
    const condRes = await request.post(`${API}/api/conditions`, {
      headers,
      data: { name: `AssocCond-${Date.now()}`, status: 'active' },
    });
    const { id: condId } = await condRes.json();

    const vitalRes = await request.post(`${API}/api/vitals`, {
      headers,
      data: { date: '2025-11-01', weight_lbs: 180 },
    });
    const { id: vitalId } = await vitalRes.json();

    const assocRes = await request.post(
      `${API}/api/conditions/${condId}/vitals/${vitalId}`,
      { headers },
    );
    expect(assocRes.status()).toBe(200);
    const body = await assocRes.json();
    expect(body.success).toBe(true);
  });
});

test.describe('GET /api/conditions/:id/vitals', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.get(`${API}/api/conditions/1/vitals`);
    expect(res.status()).toBe(401);
  });

  test('returns an array (possibly empty) for a valid condition id', async ({ request }) => {
    const headers = await authHeaders(request);
    // Use a known seeded condition or a freshly created one
    const condRes = await request.post(`${API}/api/conditions`, {
      headers,
      data: { name: `VitalsCond-${Date.now()}`, status: 'active' },
    });
    const { id: condId } = await condRes.json();

    const res = await request.get(`${API}/api/conditions/${condId}/vitals`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});
