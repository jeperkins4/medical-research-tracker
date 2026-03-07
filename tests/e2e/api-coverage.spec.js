/**
 * API Coverage — Documents, Papers, News, Audit Log
 *
 * Fills gaps not covered by api.spec.js / api-crud.spec.js / api-extended.spec.js.
 * All tests run deterministically against the test server started by global-setup.
 *
 * Run: npx playwright test --project=api-tests tests/e2e/api-coverage.spec.js
 */

import { test, expect } from '@playwright/test';

const API      = process.env.TEST_API_PORT ? `http://localhost:${process.env.TEST_API_PORT}` : 'http://localhost:3999';
const CREDS    = { username: 'testuser', password: 'testpass123' };

async function login(request) {
  const res = await request.post(`${API}/api/auth/login`, { data: CREDS });
  const cookies = res.headers()['set-cookie'] || '';
  const match = cookies.match(/token=[^;]+/);
  return match ? match[0] : '';
}

// ── Documents ─────────────────────────────────────────────────────────────────

test.describe('GET /api/documents — document list', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.get(`${API}/api/documents`);
    expect(res.status()).toBe(401);
  });

  test('returns 200 and an array when authenticated', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/documents`, { headers: { Cookie: cookie } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('response is JSON — never HTML', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/documents`, { headers: { Cookie: cookie } });
    expect(res.headers()['content-type']).toMatch(/application\/json/);
  });

  test('response does not contain raw SQL errors', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/documents`, { headers: { Cookie: cookie } });
    const text = await res.text();
    expect(text).not.toMatch(/SQLITE_ERROR|no such column|syntax error/i);
  });

  test('documents (when present) have required schema fields', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/documents`, { headers: { Cookie: cookie } });
    const docs = await res.json();
    for (const doc of docs.slice(0, 5)) {
      expect(doc).toHaveProperty('id');
      // At minimum, id must be a number
      expect(typeof doc.id).toBe('number');
    }
  });
});

test.describe('POST /api/documents — upload document', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.post(`${API}/api/documents`, {
      data: { name: 'test.pdf', document_type: 'lab', content: 'x' },
    });
    expect(res.status()).toBe(401);
  });

  test('missing required fields returns 400', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/documents`, {
      headers: { Cookie: cookie },
      data: {},
    });
    // Should be 400 validation error, not 500
    expect(res.status()).toBeLessThan(500);
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe('DELETE /api/documents/:id — document deletion', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.delete(`${API}/api/documents/1`);
    expect(res.status()).toBe(401);
  });

  test('non-numeric id does not crash server', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.delete(`${API}/api/documents/notanumber`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).not.toBe(500);
  });

  test('deleting non-existent document returns 200 or 404 (never crashes)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.delete(`${API}/api/documents/99999`, {
      headers: { Cookie: cookie },
    });
    expect([200, 404]).toContain(res.status());
  });
});

// ── Papers / Research ─────────────────────────────────────────────────────────

test.describe('GET /api/papers — research papers', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.get(`${API}/api/papers`);
    expect(res.status()).toBe(401);
  });

  test('returns 200 and an array when authenticated', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/papers`, { headers: { Cookie: cookie } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('response does not contain SQL errors', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/papers`, { headers: { Cookie: cookie } });
    const text = await res.text();
    expect(text).not.toMatch(/SQLITE_ERROR|no such column|syntax error/i);
  });
});

test.describe('GET /api/papers/detailed — papers with tags', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.get(`${API}/api/papers/detailed`);
    expect(res.status()).toBe(401);
  });

  test('returns 200 and array when authenticated', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/papers/detailed`, { headers: { Cookie: cookie } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});

test.describe('POST /api/papers — create research paper', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.post(`${API}/api/papers`, {
      data: { title: 'Test Paper', authors: 'A. Smith', url: 'https://example.com' },
    });
    expect(res.status()).toBe(401);
  });

  test('creates a paper and returns an id', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.post(`${API}/api/papers`, {
      headers: { Cookie: cookie },
      data: {
        title: 'ARID1A Loss in Bladder Cancer: A Systematic Review',
        authors: 'Smith J, Jones A',
        url: 'https://pubmed.ncbi.nlm.nih.gov/test-mrt',
        journal: 'J Oncology',
        year: 2025,
        abstract: 'Test abstract for MRT coverage spec.',
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('id');
    expect(typeof body.id).toBe('number');
  });
});

test.describe('GET /api/tags — tag list', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.get(`${API}/api/tags`);
    expect(res.status()).toBe(401);
  });

  test('returns 200 and array when authenticated', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/tags`, { headers: { Cookie: cookie } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});

// ── News ──────────────────────────────────────────────────────────────────────

test.describe('GET /api/news — news feed', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.get(`${API}/api/news`);
    expect(res.status()).toBe(401);
  });

  test('returns 200 and array when authenticated', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/news`, { headers: { Cookie: cookie } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('response does not contain SQL errors', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/news`, { headers: { Cookie: cookie } });
    const text = await res.text();
    expect(text).not.toMatch(/SQLITE_ERROR|no such column|syntax error/i);
  });

  test('accepts category query param without crashing', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/news?category=research`, { headers: { Cookie: cookie } });
    expect(res.status()).toBe(200);
  });

  test('accepts unread=1 query param without crashing', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/news?unread=1`, { headers: { Cookie: cookie } });
    expect(res.status()).toBe(200);
  });
});

test.describe('GET /api/news/stats — news statistics', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.get(`${API}/api/news/stats`);
    expect(res.status()).toBe(401);
  });

  test('returns 200 with object containing stats', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/news/stats`, { headers: { Cookie: cookie } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe('object');
  });

  test('news stats response is JSON — never HTML', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/news/stats`, { headers: { Cookie: cookie } });
    expect(res.headers()['content-type']).toMatch(/application\/json/);
  });
});

test.describe('PUT /api/news/mark-all-read — bulk mark read', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.put(`${API}/api/news/mark-all-read`);
    expect(res.status()).toBe(401);
  });

  test('returns 200 when authenticated (idempotent)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.put(`${API}/api/news/mark-all-read`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
  });
});

// ── Audit Log ─────────────────────────────────────────────────────────────────

test.describe('GET /api/audit/logs — audit log entries', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.get(`${API}/api/audit/logs`);
    expect(res.status()).toBe(401);
  });

  test('returns 200 and an array when authenticated', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/audit/logs`, { headers: { Cookie: cookie } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('response is JSON — never HTML', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/audit/logs`, { headers: { Cookie: cookie } });
    expect(res.headers()['content-type']).toMatch(/application\/json/);
  });

  test('response does not contain SQL errors', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/audit/logs`, { headers: { Cookie: cookie } });
    const text = await res.text();
    expect(text).not.toMatch(/SQLITE_ERROR|no such column|syntax error/i);
  });

  test('audit log response never contains stack traces', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/audit/logs`, { headers: { Cookie: cookie } });
    const text = await res.text();
    expect(text).not.toMatch(/at Object\.|at Function\.|at Module\./);
  });

  test('accepts limit query param without crashing', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/audit/logs?limit=10`, { headers: { Cookie: cookie } });
    expect(res.status()).toBe(200);
  });

  test('accepts action filter query param without crashing', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/audit/logs?action=login`, { headers: { Cookie: cookie } });
    expect(res.status()).toBe(200);
  });

  test('audit log entries (when present) have id and action fields', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/audit/logs`, { headers: { Cookie: cookie } });
    const logs = await res.json();
    for (const entry of logs.slice(0, 5)) {
      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('action');
    }
  });

  test('audit log does NOT expose passwords or session tokens', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/audit/logs`, { headers: { Cookie: cookie } });
    const text = await res.text();
    expect(text).not.toContain('testpass123');
    expect(text).not.toMatch(/"password"\s*:/i);
  });
});

test.describe('GET /api/audit/stats — audit log statistics', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.get(`${API}/api/audit/stats`);
    expect(res.status()).toBe(401);
  });

  test('returns 200 with statistics object', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/audit/stats`, { headers: { Cookie: cookie } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
  });

  test('audit stats response is JSON — never HTML', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/audit/stats`, { headers: { Cookie: cookie } });
    expect(res.headers()['content-type']).toMatch(/application\/json/);
  });
});

// ── Search/Research ───────────────────────────────────────────────────────────

test.describe('GET /api/search/research — research search', () => {
  test('requires auth — 401 without cookie', async ({ request }) => {
    const res = await request.get(`${API}/api/search/research?q=FGFR3`);
    expect(res.status()).toBe(401);
  });

  test('returns 200 or 503 (external API may be down in test env)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/search/research?q=ARID1A+bladder`, {
      headers: { Cookie: cookie },
    });
    // External search may fail in CI/test env — accept 200 or 503/504
    expect([200, 400, 503, 504]).toContain(res.status());
  });

  test('response is JSON — never HTML', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/search/research?q=bladder`, {
      headers: { Cookie: cookie },
    });
    expect(res.headers()['content-type']).toMatch(/application\/json/);
  });
});
