/**
 * Cancer Profiles API — Data Contract Tests
 *
 * Covers deep data shape validation for the multi-cancer profile registry:
 *  1. GET /api/cancer-profiles — list shape, count, field contracts
 *  2. GET /api/cancer-profiles/:id — detail shape for all 8 profiles
 *  3. GET /api/cancer-profiles/biomarkers/:gene — cross-reference correctness
 *  4. Input validation edge cases (invalid gene, too-long name, unknown profile id)
 *  5. Urothelial/John's cancer profile — FGFR3 / ARID1A / PIK3CA in keyBiomarkers
 *
 * All tests run against the test server (port 3999) seeded by global-setup.
 * No real Epic/FHIR calls.
 *
 * Run:
 *   npx playwright test --project=api-tests tests/e2e/cancer-profiles.spec.js
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

// ─── Known profiles registry ───────────────────────────────────────────────────

const ALL_PROFILE_IDS = [
  'urothelial_carcinoma',
  'breast_cancer',
  'lung_nsclc',
  'colorectal_cancer',
  'prostate_cancer',
  'ovarian_cancer',
  'pancreatic_cancer',
  'melanoma',
];

// ─── 1. GET /api/cancer-profiles — list endpoint ──────────────────────────────

test.describe('GET /api/cancer-profiles — list shape', () => {
  test('returns 200 with JSON content-type', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/cancer-profiles`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/application\/json/);
  });

  test('response shape is { profiles: [...] }', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/cancer-profiles`, {
      headers: { Cookie: cookie },
    });
    const body = await res.json();
    expect(body).toHaveProperty('profiles');
    expect(Array.isArray(body.profiles)).toBe(true);
  });

  test('registry contains exactly 8 cancer profiles', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/cancer-profiles`, {
      headers: { Cookie: cookie },
    });
    const { profiles } = await res.json();
    expect(profiles).toHaveLength(8);
  });

  test('every profile in list has id and label fields', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/cancer-profiles`, {
      headers: { Cookie: cookie },
    });
    const { profiles } = await res.json();
    for (const p of profiles) {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('label');
      expect(typeof p.id).toBe('string');
      expect(typeof p.label).toBe('string');
      expect(p.id.length).toBeGreaterThan(0);
      expect(p.label.length).toBeGreaterThan(0);
    }
  });

  test('all 8 expected profile IDs are present in the list', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/cancer-profiles`, {
      headers: { Cookie: cookie },
    });
    const { profiles } = await res.json();
    const ids = profiles.map((p) => p.id);
    for (const expected of ALL_PROFILE_IDS) {
      expect(ids).toContain(expected);
    }
  });

  test('list does not contain SQL error strings', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/cancer-profiles`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    expect(text).not.toMatch(/SQLITE_ERROR|no such table|syntax error/i);
  });
});

// ─── 2. GET /api/cancer-profiles/:id — detail for all 8 profiles ──────────────

test.describe('GET /api/cancer-profiles/:id — detail shape', () => {
  for (const id of ALL_PROFILE_IDS) {
    test(`${id} returns 200 with required fields`, async ({ request }) => {
      const cookie = await login(request);
      const res = await request.get(`${API}/api/cancer-profiles/${id}`, {
        headers: { Cookie: cookie },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('id', id);
      expect(body).toHaveProperty('label');
      expect(body).toHaveProperty('keyBiomarkers');
      expect(Array.isArray(body.keyBiomarkers)).toBe(true);
      expect(body.keyBiomarkers.length).toBeGreaterThan(0);
      expect(body).toHaveProperty('aliases');
      expect(Array.isArray(body.aliases)).toBe(true);
    });
  }

  test('unknown profile id → 404', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/cancer-profiles/unknown_cancer_xyz`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('profile id with spaces/special chars → 400 or 404 (never 500)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/cancer-profiles/bad%20id`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBeLessThan(500);
  });
});

// ─── 3. Urothelial profile — John's cancer, key biomarkers must be present ────

test.describe('GET /api/cancer-profiles/urothelial_carcinoma — clinical correctness', () => {
  test('FGFR3 is in keyBiomarkers', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/cancer-profiles/urothelial_carcinoma`, {
      headers: { Cookie: cookie },
    });
    const { keyBiomarkers } = await res.json();
    expect(keyBiomarkers).toContain('FGFR3');
  });

  test('ARID1A is in keyBiomarkers', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/cancer-profiles/urothelial_carcinoma`, {
      headers: { Cookie: cookie },
    });
    const { keyBiomarkers } = await res.json();
    expect(keyBiomarkers).toContain('ARID1A');
  });

  test('PIK3CA is in keyBiomarkers', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/cancer-profiles/urothelial_carcinoma`, {
      headers: { Cookie: cookie },
    });
    const { keyBiomarkers } = await res.json();
    expect(keyBiomarkers).toContain('PIK3CA');
  });

  test('ERBB2 is in keyBiomarkers (for antibody-drug conjugate context)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/cancer-profiles/urothelial_carcinoma`, {
      headers: { Cookie: cookie },
    });
    const { keyBiomarkers } = await res.json();
    expect(keyBiomarkers).toContain('ERBB2');
  });

  test('label is Urothelial Carcinoma', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/cancer-profiles/urothelial_carcinoma`, {
      headers: { Cookie: cookie },
    });
    const { label } = await res.json();
    expect(label).toBe('Urothelial Carcinoma');
  });

  test('aliases include bladder cancer', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/cancer-profiles/urothelial_carcinoma`, {
      headers: { Cookie: cookie },
    });
    const { aliases } = await res.json();
    expect(aliases.map((a) => a.toLowerCase())).toContain('bladder cancer');
  });
});

// ─── 4. GET /api/cancer-profiles/biomarkers/:gene — cross-reference ───────────

test.describe('GET /api/cancer-profiles/biomarkers/:gene — cross-reference', () => {
  test('FGFR3 appears in exactly 1 profile (urothelial only)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/cancer-profiles/biomarkers/FGFR3`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.gene).toBe('FGFR3');
    expect(body.count).toBe(1);
    expect(body.matches[0].id).toBe('urothelial_carcinoma');
  });

  test('ARID1A appears in exactly 1 profile (urothelial only)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/cancer-profiles/biomarkers/ARID1A`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(1);
    expect(body.matches[0].id).toBe('urothelial_carcinoma');
  });

  test('KRAS appears in at least 3 profiles (CRC, NSCLC, pancreatic, melanoma)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/cancer-profiles/biomarkers/KRAS`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.count).toBeGreaterThanOrEqual(3);
    const matchIds = body.matches.map((m) => m.id);
    expect(matchIds).toContain('colorectal_cancer');
  });

  test('BRCA1 appears in at least 3 profiles (breast, ovarian, prostate)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/cancer-profiles/biomarkers/BRCA1`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.count).toBeGreaterThanOrEqual(3);
    const matchIds = body.matches.map((m) => m.id);
    expect(matchIds).toContain('breast_cancer');
    expect(matchIds).toContain('ovarian_cancer');
    expect(matchIds).toContain('prostate_cancer');
  });

  test('BRAF appears in at least 2 profiles (melanoma, CRC)', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/cancer-profiles/biomarkers/BRAF`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.count).toBeGreaterThanOrEqual(2);
    const matchIds = body.matches.map((m) => m.id);
    expect(matchIds).toContain('melanoma');
    expect(matchIds).toContain('colorectal_cancer');
  });

  test('gene matching is case-insensitive (fgfr3 === FGFR3)', async ({ request }) => {
    const cookie = await login(request);
    const upperRes = await request.get(`${API}/api/cancer-profiles/biomarkers/FGFR3`, {
      headers: { Cookie: cookie },
    });
    const lowerRes = await request.get(`${API}/api/cancer-profiles/biomarkers/fgfr3`, {
      headers: { Cookie: cookie },
    });
    const upper = await upperRes.json();
    const lower = await lowerRes.json();
    // Both should return the same count (case-insensitive matching)
    expect(upper.count).toBe(lower.count);
  });

  test('gene normalised to uppercase in response', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/cancer-profiles/biomarkers/kras`, {
      headers: { Cookie: cookie },
    });
    const body = await res.json();
    expect(body.gene).toBe('KRAS');
  });

  test('unknown gene returns 200 with count=0 and empty matches', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/cancer-profiles/biomarkers/UNKNOWNGENE99`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(0);
    expect(Array.isArray(body.matches)).toBe(true);
    expect(body.matches).toHaveLength(0);
  });

  test('each match has id, label, and keyBiomarkers array', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/cancer-profiles/biomarkers/BRCA2`, {
      headers: { Cookie: cookie },
    });
    const body = await res.json();
    for (const m of body.matches) {
      expect(m).toHaveProperty('id');
      expect(m).toHaveProperty('label');
      expect(m).toHaveProperty('keyBiomarkers');
      expect(Array.isArray(m.keyBiomarkers)).toBe(true);
    }
  });

  test('count field equals matches.length', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/cancer-profiles/biomarkers/TP53`, {
      headers: { Cookie: cookie },
    });
    const body = await res.json();
    expect(body.count).toBe(body.matches.length);
  });
});

// ─── 5. Input validation edge cases ───────────────────────────────────────────

test.describe('Cancer profile endpoints — input validation', () => {
  test('gene name with space → 400', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/cancer-profiles/biomarkers/INVALID%20GENE`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(400);
  });

  test('gene name with special chars (;) → 400', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/cancer-profiles/biomarkers/GEN;DROP`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(400);
  });

  test('gene name exceeding 32 chars → 400', async ({ request }) => {
    const cookie = await login(request);
    const longGene = 'A'.repeat(33);
    const res = await request.get(`${API}/api/cancer-profiles/biomarkers/${longGene}`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(400);
  });

  test('biomarker endpoint requires auth → 401 without cookie', async ({ request }) => {
    const res = await request.get(`${API}/api/cancer-profiles/biomarkers/FGFR3`);
    expect(res.status()).toBe(401);
  });

  test('profile detail endpoint requires auth → 401 without cookie', async ({ request }) => {
    const res = await request.get(`${API}/api/cancer-profiles/urothelial_carcinoma`);
    expect(res.status()).toBe(401);
  });

  test('profile list endpoint requires auth → 401 without cookie', async ({ request }) => {
    const res = await request.get(`${API}/api/cancer-profiles`);
    expect(res.status()).toBe(401);
  });
});

// ─── 6. Breast cancer profile — HER2 / BRCA2 ──────────────────────────────────

test.describe('GET /api/cancer-profiles/breast_cancer — clinical correctness', () => {
  test('HER2 is in keyBiomarkers', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/cancer-profiles/breast_cancer`, {
      headers: { Cookie: cookie },
    });
    const { keyBiomarkers } = await res.json();
    expect(keyBiomarkers).toContain('HER2');
  });

  test('BRCA1 and BRCA2 are in keyBiomarkers', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/cancer-profiles/breast_cancer`, {
      headers: { Cookie: cookie },
    });
    const { keyBiomarkers } = await res.json();
    expect(keyBiomarkers).toContain('BRCA1');
    expect(keyBiomarkers).toContain('BRCA2');
  });
});

// ─── 7. Lung NSCLC profile — EGFR / ALK / KRAS ───────────────────────────────

test.describe('GET /api/cancer-profiles/lung_nsclc — clinical correctness', () => {
  test('EGFR, ALK, KRAS are all in keyBiomarkers', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/cancer-profiles/lung_nsclc`, {
      headers: { Cookie: cookie },
    });
    const { keyBiomarkers } = await res.json();
    expect(keyBiomarkers).toContain('EGFR');
    expect(keyBiomarkers).toContain('ALK');
    expect(keyBiomarkers).toContain('KRAS');
  });
});

// ─── 8. Response never leaks internal stack traces ────────────────────────────

test.describe('Cancer profile responses — safety contracts', () => {
  test('profile list response never contains stack trace', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/cancer-profiles`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    expect(text).not.toMatch(/at Object\.<anonymous>|Error:/);
  });

  test('biomarker cross-ref response is always valid JSON', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/cancer-profiles/biomarkers/FGFR3`, {
      headers: { Cookie: cookie },
    });
    // Should parse without throwing
    await expect(res.json()).resolves.toBeTruthy();
  });

  test('profile detail response never contains sensitive data keys', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/cancer-profiles/urothelial_carcinoma`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    // Should not leak any auth tokens or SQL
    expect(text).not.toMatch(/password|access_token|refresh_token/i);
    expect(text).not.toMatch(/SQLITE/i);
  });
});
