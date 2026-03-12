/**
 * Genomic Therapy Suggestions API Contracts
 *
 * Focused coverage for:
 *   1. auth guard
 *   2. response JSON + top-level shape
 *   3. seeded DB-backed therapy suggestions (ARID1A / FGFR3 / PIK3CA)
 *   4. gene filtering
 *   5. cancer_profile filtering
 *   6. min_evidence filtering
 *   7. invalid query validation
 *   8. error safety (no SQL / token leakage)
 */

import { test, expect } from '@playwright/test';

const API = `http://localhost:${process.env.TEST_API_PORT || process.env.TEST_PORT || 3999}`;

async function login(request) {
  const res = await request.post(`${API}/api/auth/login`, {
    data: { username: 'testuser', password: 'testpass123' },
  });
  expect(res.status()).toBe(200);
  return (res.headers()['set-cookie'] || '').split(';')[0];
}

test.describe('GET /api/genomics/therapy-suggestions', () => {
  test('requires auth', async ({ request }) => {
    const res = await request.get(`${API}/api/genomics/therapy-suggestions`);
    expect(res.status()).toBe(401);
  });

  test('returns JSON object with suggestions[] and summary', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/genomics/therapy-suggestions`, {
      headers: { Cookie: cookie },
    });

    expect(res.status()).toBe(200);
    const ct = res.headers()['content-type'] || '';
    expect(ct).toMatch(/application\/json/i);

    const body = await res.json();
    expect(Array.isArray(body.suggestions)).toBe(true);
    expect(body.summary).toBeTruthy();
    expect(typeof body.summary.total).toBe('number');
    expect(typeof body.summary.actionable).toBe('number');
    expect(typeof body.summary.fda_approved).toBe('number');
    expect(typeof body.summary.db_sourced).toBe('number');
  });

  test('includes seeded DB-backed suggestions for FGFR3, ARID1A, and PIK3CA', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/genomics/therapy-suggestions?genes=FGFR3,ARID1A,PIK3CA`, {
      headers: { Cookie: cookie },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();

    const genes = body.suggestions.map(s => s.gene);
    expect(genes).toContain('FGFR3');
    expect(genes).toContain('ARID1A');
    expect(genes).toContain('PIK3CA');

    const erdafitinib = body.suggestions.find(s => s.gene === 'FGFR3' && s.drug_name === 'Erdafitinib');
    expect(erdafitinib).toBeTruthy();
    expect(erdafitinib.suggestion_source).toBe('db');
    expect(erdafitinib.evidence_level).toBe('A');
  });

  test('gene filter narrows results to requested genes only', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/genomics/therapy-suggestions?genes=FGFR3`, {
      headers: { Cookie: cookie },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.suggestions.length).toBeGreaterThan(0);
    for (const row of body.suggestions) {
      expect(row.gene).toBe('FGFR3');
    }
  });

  test('cancer_profile filter excludes profile-mismatched static suggestions', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/genomics/therapy-suggestions?genes=EGFR&cancer_profile=urothelial_carcinoma`, {
      headers: { Cookie: cookie },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.suggestions).toEqual([]);
  });

  test('min_evidence=A only returns highest-evidence rows', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/genomics/therapy-suggestions?genes=FGFR3,ARID1A,PIK3CA&min_evidence=A`, {
      headers: { Cookie: cookie },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.suggestions.length).toBeGreaterThan(0);
    for (const row of body.suggestions) {
      expect(row.evidence_level).toBe('A');
    }
  });

  test('invalid cancer_profile returns 400 with structured error', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/genomics/therapy-suggestions?cancer_profile=not_real`, {
      headers: { Cookie: cookie },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });

  test('invalid min_evidence returns 400 with structured error', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/genomics/therapy-suggestions?min_evidence=Z`, {
      headers: { Cookie: cookie },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });

  test('response never leaks raw SQL errors or token material', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/genomics/therapy-suggestions`, {
      headers: { Cookie: cookie },
    });

    const text = await res.text();
    expect(text).not.toMatch(/SQLITE_|no such table|syntax error/i);
    expect(text).not.toContain('test-access-token');
    expect(text).not.toContain('test-refresh-token');
  });
});
