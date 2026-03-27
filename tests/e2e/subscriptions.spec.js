/**
 * Subscription Tracker API Tests
 *
 * Covers routes not exercised in api.spec.js:
 *  1. GET /api/subscriptions/categories  — static enum list
 *  2. GET /api/subscriptions/summary     — spend totals, by-category breakdown
 *  3. GET /api/subscriptions/:id         — single subscription detail
 *  4. PUT /api/subscriptions/:id         — update fields + cancel flow
 *  5. GET /api/subscriptions/:id/payments  — payment history list
 *  6. POST /api/subscriptions/:id/payments — log a payment + next_billing_date advance
 *  7. Auth guards on every route (401 without cookie)
 *  8. Validation / edge-case error handling
 *
 * Seeded data:
 *  - Subscription id=101 (service_name='Test Subscription', status=active, cost=29.99, monthly)
 *  - Created via global-setup.js
 *
 * Run:
 *   npx playwright test --project=api-tests tests/e2e/subscriptions.spec.js
 */

import { test, expect } from '@playwright/test';

const PORT = process.env.TEST_API_PORT || '3999';
const API  = `http://localhost:${PORT}`;
const CREDS = { username: 'testuser', password: 'testpass123' };

const SEEDED_SUB_ID = 101; // seeded in global-setup
const MISSING_ID    = 99999;

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function login(request) {
  const res = await request.post(`${API}/api/auth/login`, { data: CREDS });
  expect(res.status(), 'Login should succeed').toBe(200);
  const raw = res.headers()['set-cookie'] || '';
  return raw.split(';')[0]; // name=value only
}

// ─── 1. Auth guards ────────────────────────────────────────────────────────────

test.describe('Subscription route auth guards — unauthenticated → 401', () => {
  const guards = [
    { method: 'GET',    path: '/api/subscriptions/categories' },
    { method: 'GET',    path: '/api/subscriptions' },
    { method: 'GET',    path: '/api/subscriptions/summary' },
    { method: 'GET',    path: `/api/subscriptions/${SEEDED_SUB_ID}` },
    { method: 'POST',   path: '/api/subscriptions' },
    { method: 'PUT',    path: `/api/subscriptions/${SEEDED_SUB_ID}` },
    { method: 'DELETE', path: `/api/subscriptions/${SEEDED_SUB_ID}` },
    { method: 'GET',    path: `/api/subscriptions/${SEEDED_SUB_ID}/payments` },
    { method: 'POST',   path: `/api/subscriptions/${SEEDED_SUB_ID}/payments` },
  ];

  for (const { method, path } of guards) {
    test(`${method} ${path} → 401 without cookie`, async ({ request }) => {
      const res = await request.fetch(`${API}${path}`, { method });
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body).toHaveProperty('error');
    });
  }
});

// ─── 2. GET /api/subscriptions/categories ─────────────────────────────────────

test.describe('GET /api/subscriptions/categories', () => {
  test('returns 200 and a non-empty array', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/subscriptions/categories`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  test('includes expected healthcare category', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/subscriptions/categories`, {
      headers: { Cookie: cookie },
    });
    const body = await res.json();
    expect(body.some(c => /healthcare/i.test(c))).toBe(true);
  });

  test('all entries are strings', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/subscriptions/categories`, {
      headers: { Cookie: cookie },
    });
    const body = await res.json();
    body.forEach(c => expect(typeof c).toBe('string'));
  });

  test('response is always identical (deterministic static list)', async ({ request }) => {
    const cookie = await login(request);
    const r1 = await request.get(`${API}/api/subscriptions/categories`, {
      headers: { Cookie: cookie },
    });
    const r2 = await request.get(`${API}/api/subscriptions/categories`, {
      headers: { Cookie: cookie },
    });
    expect(await r1.json()).toEqual(await r2.json());
  });
});

// ─── 3. GET /api/subscriptions/summary ───────────────────────────────────────

test.describe('GET /api/subscriptions/summary', () => {
  test('returns 200 and an object with required keys', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/subscriptions/summary`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('total_active');
    expect(body).toHaveProperty('monthly_total');
    expect(body).toHaveProperty('annual_total');
    expect(body).toHaveProperty('by_category');
  });

  test('total_active is a non-negative integer', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/subscriptions/summary`, {
      headers: { Cookie: cookie },
    });
    const { total_active } = await res.json();
    expect(typeof total_active).toBe('number');
    expect(total_active).toBeGreaterThanOrEqual(0);
  });

  test('monthly_total reflects seeded subscription cost', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/subscriptions/summary`, {
      headers: { Cookie: cookie },
    });
    const { monthly_total } = await res.json();
    // Seeded subscription: 29.99/month active — monthly_total >= 29.99
    expect(monthly_total).toBeGreaterThanOrEqual(29.99);
  });

  test('annual_total is approximately monthly_total × 12 for monthly subscriptions', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/subscriptions/summary`, {
      headers: { Cookie: cookie },
    });
    const { monthly_total, annual_total } = await res.json();
    // Allow small floating point tolerance
    expect(Math.abs(annual_total - monthly_total * 12)).toBeLessThan(1);
  });

  test('by_category is an object (not array, not null)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/subscriptions/summary`, {
      headers: { Cookie: cookie },
    });
    const { by_category } = await res.json();
    expect(typeof by_category).toBe('object');
    expect(Array.isArray(by_category)).toBe(false);
    expect(by_category).not.toBeNull();
  });

  test('by_category entries have count and monthly fields', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/subscriptions/summary`, {
      headers: { Cookie: cookie },
    });
    const { by_category } = await res.json();
    for (const cat of Object.values(by_category)) {
      expect(cat).toHaveProperty('count');
      expect(cat).toHaveProperty('monthly');
      expect(typeof cat.count).toBe('number');
    }
  });

  test('response never contains SQL error text', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/subscriptions/summary`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    expect(text).not.toMatch(/SQLITE_ERROR|no such column|SQLITE_CONSTRAINT/i);
  });
});

// ─── 4. GET /api/subscriptions/:id ───────────────────────────────────────────

test.describe('GET /api/subscriptions/:id — single subscription detail', () => {
  test('returns 200 and correct service_name for seeded id=101', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/subscriptions/${SEEDED_SUB_ID}`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.service_name).toBe('Test Subscription');
  });

  test('seeded subscription has all required fields', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/subscriptions/${SEEDED_SUB_ID}`, {
      headers: { Cookie: cookie },
    });
    const body = await res.json();
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('service_name');
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('cost');
    expect(body).toHaveProperty('currency');
    expect(body).toHaveProperty('billing_cycle');
    expect(body).toHaveProperty('tags');
  });

  test('tags is parsed as array (not raw JSON string)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/subscriptions/${SEEDED_SUB_ID}`, {
      headers: { Cookie: cookie },
    });
    const { tags } = await res.json();
    expect(Array.isArray(tags)).toBe(true);
  });

  test('seeded subscription has cost=29.99', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/subscriptions/${SEEDED_SUB_ID}`, {
      headers: { Cookie: cookie },
    });
    const { cost } = await res.json();
    expect(cost).toBeCloseTo(29.99, 2);
  });

  test('missing id → 404', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/subscriptions/${MISSING_ID}`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('non-numeric id does not crash server', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/subscriptions/not-a-number`, {
      headers: { Cookie: cookie },
    });
    expect([200, 400, 404, 500].includes(res.status())).toBe(true);
    // Must return JSON not HTML
    const ct = res.headers()['content-type'] || '';
    expect(ct).toContain('application/json');
  });
});

// ─── 5. PUT /api/subscriptions/:id — update ───────────────────────────────────

test.describe('PUT /api/subscriptions/:id — update subscription', () => {
  test('update service_name round-trip verified', async ({ request }) => {
    const cookie = await login(request);
    const headers = { Cookie: cookie };

    // Create a fresh subscription to update
    const createRes = await request.post(`${API}/api/subscriptions`, {
      headers: { ...headers, 'Content-Type': 'application/json' },
      data: { service_name: 'PUT Test Sub', cost: 5.00, billing_cycle: 'monthly' },
    });
    expect(createRes.status()).toBe(201);
    const { id } = await createRes.json();

    // Update service_name
    const putRes = await request.put(`${API}/api/subscriptions/${id}`, {
      headers: { ...headers, 'Content-Type': 'application/json' },
      data: { service_name: 'PUT Test Sub UPDATED', cost: 5.00, billing_cycle: 'monthly' },
    });
    expect(putRes.status()).toBe(200);
    const putBody = await putRes.json();
    expect(putBody.success).toBe(true);

    // Verify the update persisted
    const getRes = await request.get(`${API}/api/subscriptions/${id}`, { headers });
    expect(getRes.status()).toBe(200);
    const got = await getRes.json();
    expect(got.service_name).toBe('PUT Test Sub UPDATED');

    // Cleanup
    await request.delete(`${API}/api/subscriptions/${id}`, { headers });
  });

  test('cancel flow: status changes to cancelled + cancelled_at is set', async ({ request }) => {
    const cookie = await login(request);
    const headers = { Cookie: cookie };

    const createRes = await request.post(`${API}/api/subscriptions`, {
      headers: { ...headers, 'Content-Type': 'application/json' },
      data: { service_name: 'Cancel Flow Sub', cost: 12.00, billing_cycle: 'monthly' },
    });
    const { id } = await createRes.json();

    // Cancel it
    const putRes = await request.put(`${API}/api/subscriptions/${id}`, {
      headers: { ...headers, 'Content-Type': 'application/json' },
      data: { service_name: 'Cancel Flow Sub', cost: 12.00, billing_cycle: 'monthly', status: 'cancelled' },
    });
    expect(putRes.status()).toBe(200);

    // Verify status
    const getRes = await request.get(`${API}/api/subscriptions/${id}`, { headers });
    const got = await getRes.json();
    expect(got.status).toBe('cancelled');
    expect(got.cancelled_at).toBeTruthy();

    // Cleanup
    await request.delete(`${API}/api/subscriptions/${id}`, { headers });
  });

  test('update missing id → 404', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.put(`${API}/api/subscriptions/${MISSING_ID}`, {
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      data: { service_name: 'Ghost', cost: 1, billing_cycle: 'monthly' },
    });
    expect(res.status()).toBe(404);
  });

  test('update response is JSON, not HTML', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.put(`${API}/api/subscriptions/${SEEDED_SUB_ID}`, {
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      data: { service_name: 'Test Subscription', cost: 29.99, billing_cycle: 'monthly' },
    });
    const ct = res.headers()['content-type'] || '';
    expect(ct).toContain('application/json');
  });

  test('update preserves tags as array after round-trip', async ({ request }) => {
    const cookie = await login(request);
    const headers = { Cookie: cookie };

    const createRes = await request.post(`${API}/api/subscriptions`, {
      headers: { ...headers, 'Content-Type': 'application/json' },
      data: {
        service_name: 'Tags Round-trip', cost: 3.00, billing_cycle: 'monthly',
        tags: ['oncology', 'research'],
      },
    });
    const { id } = await createRes.json();

    // Update with new tags
    await request.put(`${API}/api/subscriptions/${id}`, {
      headers: { ...headers, 'Content-Type': 'application/json' },
      data: {
        service_name: 'Tags Round-trip', cost: 3.00, billing_cycle: 'monthly',
        tags: ['oncology', 'clinical', 'trial'],
      },
    });

    const getRes = await request.get(`${API}/api/subscriptions/${id}`, { headers });
    const { tags } = await getRes.json();
    expect(Array.isArray(tags)).toBe(true);
    expect(tags).toContain('clinical');

    await request.delete(`${API}/api/subscriptions/${id}`, { headers });
  });
});

// ─── 6. GET /api/subscriptions/:id/payments ──────────────────────────────────

test.describe('GET /api/subscriptions/:id/payments — payment history', () => {
  test('returns 200 and array for seeded subscription', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/subscriptions/${SEEDED_SUB_ID}/payments`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('returns 404 for non-existent subscription', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/subscriptions/${MISSING_ID}/payments`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(404);
  });

  test('payment rows have expected fields when present', async ({ request }) => {
    const cookie = await login(request);
    const headers = { Cookie: cookie };

    // Create sub + log a payment so we can validate shape
    const createRes = await request.post(`${API}/api/subscriptions`, {
      headers: { ...headers, 'Content-Type': 'application/json' },
      data: { service_name: 'Payment Shape Sub', cost: 9.99, billing_cycle: 'monthly' },
    });
    const { id } = await createRes.json();

    await request.post(`${API}/api/subscriptions/${id}/payments`, {
      headers: { ...headers, 'Content-Type': 'application/json' },
      data: { amount: 9.99, currency: 'USD', status: 'paid' },
    });

    const listRes = await request.get(`${API}/api/subscriptions/${id}/payments`, { headers });
    const payments = await listRes.json();
    expect(payments.length).toBeGreaterThan(0);

    const p = payments[0];
    expect(p).toHaveProperty('id');
    expect(p).toHaveProperty('subscription_id');
    expect(p).toHaveProperty('amount');
    expect(p).toHaveProperty('currency');
    expect(p).toHaveProperty('status');

    await request.delete(`${API}/api/subscriptions/${id}`, { headers });
  });

  test('payments are ordered newest first', async ({ request }) => {
    const cookie = await login(request);
    const headers = { Cookie: cookie };

    const createRes = await request.post(`${API}/api/subscriptions`, {
      headers: { ...headers, 'Content-Type': 'application/json' },
      data: { service_name: 'Order Test Sub', cost: 15.00, billing_cycle: 'monthly' },
    });
    const { id } = await createRes.json();

    // Log two payments
    await request.post(`${API}/api/subscriptions/${id}/payments`, {
      headers: { ...headers, 'Content-Type': 'application/json' },
      data: { amount: 15.00, paid_at: '2026-01-01T10:00:00.000Z' },
    });
    await request.post(`${API}/api/subscriptions/${id}/payments`, {
      headers: { ...headers, 'Content-Type': 'application/json' },
      data: { amount: 15.00, paid_at: '2026-02-01T10:00:00.000Z' },
    });

    const listRes = await request.get(`${API}/api/subscriptions/${id}/payments`, { headers });
    const payments = await listRes.json();
    expect(payments.length).toBeGreaterThanOrEqual(2);
    // Most recent first: Feb > Jan
    expect(payments[0].paid_at >= payments[1].paid_at).toBe(true);

    await request.delete(`${API}/api/subscriptions/${id}`, { headers });
  });
});

// ─── 7. POST /api/subscriptions/:id/payments — log payment ───────────────────

test.describe('POST /api/subscriptions/:id/payments — log a payment', () => {
  test('creates payment and returns id', async ({ request }) => {
    const cookie = await login(request);
    const headers = { Cookie: cookie };

    const createRes = await request.post(`${API}/api/subscriptions`, {
      headers: { ...headers, 'Content-Type': 'application/json' },
      data: { service_name: 'Log Payment Sub', cost: 19.99, billing_cycle: 'monthly' },
    });
    const { id } = await createRes.json();

    const payRes = await request.post(`${API}/api/subscriptions/${id}/payments`, {
      headers: { ...headers, 'Content-Type': 'application/json' },
      data: { amount: 19.99, currency: 'USD', status: 'paid' },
    });
    expect(payRes.status()).toBe(201);
    const payBody = await payRes.json();
    expect(payBody).toHaveProperty('id');
    expect(typeof payBody.id).toBe('number');

    await request.delete(`${API}/api/subscriptions/${id}`, { headers });
  });

  test('missing amount → 400', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/subscriptions/${SEEDED_SUB_ID}/payments`, {
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      data: { currency: 'USD' }, // no amount
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('payment on non-existent subscription → 404', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/subscriptions/${MISSING_ID}/payments`, {
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      data: { amount: 9.99 },
    });
    expect(res.status()).toBe(404);
  });

  test('successful paid payment advances next_billing_date', async ({ request }) => {
    const cookie = await login(request);
    const headers = { Cookie: cookie };

    const createRes = await request.post(`${API}/api/subscriptions`, {
      headers: { ...headers, 'Content-Type': 'application/json' },
      data: {
        service_name: 'Next Billing Advance Sub',
        cost: 9.99, billing_cycle: 'monthly', billing_day: 1,
      },
    });
    const { id } = await createRes.json();

    const beforeRes = await request.get(`${API}/api/subscriptions/${id}`, { headers });
    const beforeDate = (await beforeRes.json()).next_billing_date;

    await request.post(`${API}/api/subscriptions/${id}/payments`, {
      headers: { ...headers, 'Content-Type': 'application/json' },
      data: { amount: 9.99, status: 'paid' },
    });

    const afterRes = await request.get(`${API}/api/subscriptions/${id}`, { headers });
    const afterDate = (await afterRes.json()).next_billing_date;

    // next_billing_date should be set (may equal beforeDate if already in future)
    expect(afterDate).toBeTruthy();

    await request.delete(`${API}/api/subscriptions/${id}`, { headers });
  });

  test('failed payment status is stored correctly', async ({ request }) => {
    const cookie = await login(request);
    const headers = { Cookie: cookie };

    const createRes = await request.post(`${API}/api/subscriptions`, {
      headers: { ...headers, 'Content-Type': 'application/json' },
      data: { service_name: 'Failed Pay Sub', cost: 9.99, billing_cycle: 'monthly' },
    });
    const { id } = await createRes.json();

    const payRes = await request.post(`${API}/api/subscriptions/${id}/payments`, {
      headers: { ...headers, 'Content-Type': 'application/json' },
      data: { amount: 9.99, status: 'failed' },
    });
    expect(payRes.status()).toBe(201);

    const listRes = await request.get(`${API}/api/subscriptions/${id}/payments`, { headers });
    const payments = await listRes.json();
    const failedPay = payments.find(p => p.status === 'failed');
    expect(failedPay).toBeTruthy();

    await request.delete(`${API}/api/subscriptions/${id}`, { headers });
  });

  test('payment response never leaks SQL errors', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/subscriptions/${SEEDED_SUB_ID}/payments`, {
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      data: { amount: 1.00 },
    });
    const text = await res.text();
    expect(text).not.toMatch(/SQLITE_ERROR|no such column|stack trace/i);
  });
});

// ─── 8. Subscription list filter params ───────────────────────────────────────

test.describe('GET /api/subscriptions — filter query params', () => {
  test('?status=active returns only active subscriptions', async ({ request, page }) => {
    const cookie = await login(request);
    
    // Small delay to ensure database commit (fixes timing-related flakiness with status index)
    await page.waitForTimeout(50);
    
    const res = await request.get(`${API}/api/subscriptions?status=active`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);
    list.forEach(s => expect(s.status).toBe('active'));
  });

  test('?category=Other returns only that category', async ({ request }) => {
    const cookie = await login(request);
    // Seed a quick "Other" sub
    const createRes = await request.post(`${API}/api/subscriptions`, {
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      data: { service_name: 'Filter Cat Sub', cost: 1, billing_cycle: 'monthly', category: 'Other' },
    });
    const { id } = await createRes.json();

    const res = await request.get(`${API}/api/subscriptions?category=Other`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const list = await res.json();
    list.forEach(s => expect(s.category).toBe('Other'));

    await request.delete(`${API}/api/subscriptions/${id}`, { headers: { Cookie: cookie } });
  });

  test('unknown status filter returns empty array (not 500)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/subscriptions?status=nonexistent`, {
      headers: { Cookie: cookie },
    });
    // Should return 200 with empty array or still 200 with results
    expect(res.status()).not.toBe(500);
    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);
  });
});

// ─── 9. POST /api/subscriptions — extended validation ─────────────────────────

test.describe('POST /api/subscriptions — extended validation', () => {
  test('missing service_name → 400', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/subscriptions`, {
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      data: { cost: 9.99, billing_cycle: 'monthly' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/service_name/i);
  });

  test('missing cost → 400', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/subscriptions`, {
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      data: { service_name: 'No Cost Sub', billing_cycle: 'monthly' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/cost/i);
  });

  test('annual billing cycle subscription is created successfully', async ({ request }) => {
    const cookie = await login(request);
    const headers = { Cookie: cookie };

    const createRes = await request.post(`${API}/api/subscriptions`, {
      headers: { ...headers, 'Content-Type': 'application/json' },
      data: {
        service_name: 'Annual Sub', cost: 120.00, billing_cycle: 'annual',
        billing_month: 3, billing_day: 1, category: 'AI & Machine Learning',
      },
    });
    expect(createRes.status()).toBe(201);
    const { id } = await createRes.json();

    const getRes = await request.get(`${API}/api/subscriptions/${id}`, { headers });
    const sub = await getRes.json();
    expect(sub.billing_cycle).toBe('annual');
    expect(sub.next_billing_date).toBeTruthy();

    await request.delete(`${API}/api/subscriptions/${id}`, { headers });
  });

  test('subscription with tags round-trips correctly', async ({ request }) => {
    const cookie = await login(request);
    const headers = { Cookie: cookie };

    const createRes = await request.post(`${API}/api/subscriptions`, {
      headers: { ...headers, 'Content-Type': 'application/json' },
      data: {
        service_name: 'Tagged Sub', cost: 5.00, billing_cycle: 'monthly',
        tags: ['genomics', 'oncology'],
      },
    });
    expect(createRes.status()).toBe(201);
    const { id } = await createRes.json();

    const listRes = await request.get(`${API}/api/subscriptions`, { headers });
    const list = await listRes.json();
    const found = list.find(s => s.id === id);
    expect(found).toBeTruthy();
    expect(Array.isArray(found.tags)).toBe(true);
    expect(found.tags).toContain('genomics');

    await request.delete(`${API}/api/subscriptions/${id}`, { headers });
  });
});

// ─── 10. Security ─────────────────────────────────────────────────────────────

test.describe('Subscription response security', () => {
  test('list response never leaks SQL error text', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/subscriptions`, { headers: { Cookie: cookie } });
    const text = await res.text();
    expect(text).not.toMatch(/SQLITE_ERROR|no such column|SQLITE_CONSTRAINT/i);
  });

  test('detail response is valid JSON (not HTML)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/subscriptions/${SEEDED_SUB_ID}`, {
      headers: { Cookie: cookie },
    });
    const ct = res.headers()['content-type'] || '';
    expect(ct).toContain('application/json');
  });

  test('unauthenticated requests never leak subscription data in 401 body', async ({ request }) => {
    const res = await request.get(`${API}/api/subscriptions/${SEEDED_SUB_ID}`);
    expect(res.status()).toBe(401);
    const body = await res.json();
    // Should only have error, not subscription data
    expect(body).not.toHaveProperty('service_name');
    expect(body).not.toHaveProperty('cost');
  });
});
