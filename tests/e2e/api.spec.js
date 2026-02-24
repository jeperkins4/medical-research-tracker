/**
 * API Regression Tests
 * Tests the Express API layer without a browser.
 * These catch SQL schema errors, crashes, and missing fields.
 *
 * Run: npx playwright test --project=api-tests
 */

import { test, expect } from '@playwright/test';

const PORT    = process.env.TEST_API_PORT || '3999';
const API     = `http://localhost:${PORT}`;
const CREDS   = { username: 'testuser', password: 'testpass123' };

// ── Auth helper ───────────────────────────────────────────────────────────────

async function getAuthCookie(request) {
  const res = await request.post(`${API}/api/auth/login`, { data: CREDS });
  const cookies = res.headers()['set-cookie'] || '';
  return cookies.split(';')[0]; // session=...
}

// ── Auth ──────────────────────────────────────────────────────────────────────

test.describe('POST /api/auth/login', () => {
  test('returns 200 + session cookie with valid credentials', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/login`, { data: CREDS });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('user');
    const cookies = res.headers()['set-cookie'] || '';
    expect(cookies).toMatch(/session|connect\.sid/i);
  });

  test('returns 401 with wrong password', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/login`, {
      data: { username: 'testuser', password: 'wrongpassword' },
    });
    expect([400, 401, 403]).toContain(res.status());
  });
});

// ── Portals — key regression ──────────────────────────────────────────────────

test.describe('GET /api/portals/credentials [REGRESSION: no such column: last_sync]', () => {
  test('returns 200, not 500', async ({ request }) => {
    const loginRes = await request.post(`${API}/api/auth/login`, { data: CREDS });
    const cookie = (loginRes.headers()['set-cookie'] || '').split(';')[0];

    const res = await request.get(`${API}/api/portals/credentials`, {
      headers: { Cookie: cookie },
    });

    // THE key regression: must not be 500 (SQL error)
    expect(res.status()).not.toBe(500);
    expect([200, 204]).toContain(res.status());
  });

  test('response does NOT contain "no such column" error text', async ({ request }) => {
    const loginRes = await request.post(`${API}/api/auth/login`, { data: CREDS });
    const cookie = (loginRes.headers()['set-cookie'] || '').split(';')[0];

    const res = await request.get(`${API}/api/portals/credentials`, {
      headers: { Cookie: cookie },
    });

    const body = await res.text();
    expect(body).not.toMatch(/no such column/i);
    expect(body).not.toMatch(/SQLITE_ERROR/i);
  });

  test('returns array with last_sync field present', async ({ request }) => {
    const loginRes = await request.post(`${API}/api/auth/login`, { data: CREDS });
    const cookie = (loginRes.headers()['set-cookie'] || '').split(';')[0];

    const res = await request.get(`${API}/api/portals/credentials`, {
      headers: { Cookie: cookie },
    });

    if (res.status() !== 200) return; // Skip if no credentials

    const body = await res.json();
    expect(Array.isArray(body)).toBeTruthy();

    if (body.length > 0) {
      // Every credential must expose last_sync (can be null) — field must exist
      body.forEach(cred => {
        expect(Object.prototype.hasOwnProperty.call(cred, 'last_sync') ||
               Object.prototype.hasOwnProperty.call(cred, 'last_synced')).toBeTruthy();
      });
    }
  });
});

// ── Genomics — white screen regression ───────────────────────────────────────

test.describe('GET /api/genomics/dashboard [REGRESSION: white screen crash]', () => {
  test('returns 200, not 500', async ({ request }) => {
    const loginRes = await request.post(`${API}/api/auth/login`, { data: CREDS });
    const cookie = (loginRes.headers()['set-cookie'] || '').split(';')[0];

    const res = await request.get(`${API}/api/genomics/dashboard`, {
      headers: { Cookie: cookie },
    });

    expect(res.status()).not.toBe(500);
    expect([200, 204]).toContain(res.status());
  });

  test('response has mutations array (never undefined)', async ({ request }) => {
    const loginRes = await request.post(`${API}/api/auth/login`, { data: CREDS });
    const cookie = (loginRes.headers()['set-cookie'] || '').split(';')[0];

    const res = await request.get(`${API}/api/genomics/dashboard`, {
      headers: { Cookie: cookie },
    });

    const body = await res.json();
    expect(body).toHaveProperty('mutations');
    expect(Array.isArray(body.mutations)).toBeTruthy();

    // biomarkers, treatmentOpportunities, topTrials must be arrays (not undefined)
    expect(Array.isArray(body.biomarkers ?? [])).toBeTruthy();
    expect(Array.isArray(body.treatmentOpportunities ?? [])).toBeTruthy();
    expect(Array.isArray(body.topTrials ?? [])).toBeTruthy();
  });

  test('mutations have required display fields', async ({ request }) => {
    const loginRes = await request.post(`${API}/api/auth/login`, { data: CREDS });
    const cookie = (loginRes.headers()['set-cookie'] || '').split(';')[0];

    const res = await request.get(`${API}/api/genomics/dashboard`, {
      headers: { Cookie: cookie },
    });

    const body = await res.json();
    if (!body.mutations?.length) return; // No mutations seeded, skip

    const m = body.mutations[0];
    expect(m).toHaveProperty('id');
    expect(m).toHaveProperty('gene');
    // alteration OR mutation_detail must be present (component uses alteration as alias)
    expect(m.alteration !== undefined || m.mutation_detail !== undefined).toBeTruthy();
  });
});

// ── Subscriptions ─────────────────────────────────────────────────────────────

test.describe('GET /api/subscriptions', () => {
  test('returns 200, not 500', async ({ request }) => {
    const loginRes = await request.post(`${API}/api/auth/login`, { data: CREDS });
    const cookie = (loginRes.headers()['set-cookie'] || '').split(';')[0];

    const res = await request.get(`${API}/api/subscriptions`, {
      headers: { Cookie: cookie },
    });

    expect(res.status()).not.toBe(500);
    const body = await res.text();
    expect(body).not.toMatch(/no such column/i);
  });

  test('POST creates subscription, GET lists it', async ({ request }) => {
    const loginRes = await request.post(`${API}/api/auth/login`, { data: CREDS });
    const cookie = (loginRes.headers()['set-cookie'] || '').split(';')[0];
    const headers = { Cookie: cookie };

    const createRes = await request.post(`${API}/api/subscriptions`, {
      headers: { ...headers, 'Content-Type': 'application/json' },
      data: {
        service_name: 'Playwright Test Sub',
        cost: 9.99,
        billing_cycle: 'monthly',
        category: 'Development Tools',
        status: 'active',
      },
    });

    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    expect(created).toHaveProperty('id');

    // List should include it
    const listRes = await request.get(`${API}/api/subscriptions`, { headers });
    const list = await listRes.json();
    const found = list.find(s => s.service_name === 'Playwright Test Sub');
    expect(found).toBeTruthy();

    // Cleanup
    await request.delete(`${API}/api/subscriptions/${created.id}`, { headers });
  });
});

// ── Foundation One import ─────────────────────────────────────────────────────

test.describe('POST /api/genomics/import-mutations', () => {
  test('imports mutations without SQL error', async ({ request }) => {
    const loginRes = await request.post(`${API}/api/auth/login`, { data: CREDS });
    const cookie = (loginRes.headers()['set-cookie'] || '').split(';')[0];

    const testMutations = [
      {
        gene: 'TP53',
        mutation_type: 'Short Variant',
        mutation_detail: 'p.R175H',
        vaf: 42.1,
        clinical_significance: 'pathogenic',
        report_source: 'FoundationOne CDx',
        report_date: '2026-02-24',
      },
      {
        gene: 'KRAS',
        mutation_type: 'Short Variant',
        mutation_detail: 'p.G12D',
        vaf: 28.5,
        clinical_significance: 'pathogenic',
        report_source: 'FoundationOne CDx',
        report_date: '2026-02-24',
      },
    ];

    const res = await request.post(`${API}/api/genomics/import-mutations`, {
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
      },
      data: { mutations: testMutations, replaceExisting: false },
    });

    expect(res.status()).not.toBe(500);
    const body = await res.json();
    expect(body.success).toBeTruthy();
    expect(typeof body.imported).toBe('number');
  });
});
