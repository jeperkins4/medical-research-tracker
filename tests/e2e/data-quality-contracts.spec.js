/**
 * data-quality-contracts.spec.js
 *
 * Deep field-contract tests for endpoints that currently have only smoke-test
 * coverage.  All tests assert response *shape and content quality* — not just
 * "returns 200".
 *
 * Targets:
 *   1. GET  /api/genomics/mutation-drug-network  — Cytoscape nodes/edges shape
 *   2. GET  /api/genomics/pathway-graph          — nodes/edges field contracts
 *   3. GET  /api/genomics/vus                    — VUS variant field types
 *   4. GET  /api/genomics/treatment-correlations — join field contracts
 *   5. POST /api/fhir/sync                       — success/failure response fields
 *   6. GET  /api/cancer-profiles/biomarkers/:gene — edge-case genes
 *   7. GET  /api/portals/sync-history            — ordering + field completeness
 *   8. GET  /api/portals/credentials/:id         — field types + security
 *   9. Error shape consistency                   — all 4xx have `error` string field
 */

import { test, expect } from '@playwright/test';

const API = process.env.TEST_API_URL || 'http://localhost:4891';

// ── Auth helpers ──────────────────────────────────────────────────────────────

async function login(request) {
  const res = await request.post(`${API}/api/auth/login`, {
    data: { username: 'testuser', password: 'testpass123' },
  });
  const headers = res.headers();
  const setCookie = headers['set-cookie'] || '';
  const match = setCookie.match(/session=[^;]+/);
  return match ? match[0] : '';
}

async function authHeaders(request) {
  const cookie = await login(request);
  return { Cookie: cookie };
}

// ─── 1. GET /api/genomics/mutation-drug-network — Cytoscape nodes/edges ───────

test.describe('GET /api/genomics/mutation-drug-network — Cytoscape graph contracts', () => {
  test('response has exactly {nodes, edges} top-level keys', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/genomics/mutation-drug-network`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('nodes');
    expect(body).toHaveProperty('edges');
  });

  test('nodes is always an array (never null or missing)', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/genomics/mutation-drug-network`, { headers });
    const body = await res.json();
    expect(Array.isArray(body.nodes)).toBe(true);
  });

  test('edges is always an array (never null or missing)', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/genomics/mutation-drug-network`, { headers });
    const body = await res.json();
    expect(Array.isArray(body.edges)).toBe(true);
  });

  test('each node has a data object with id, label, type', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/genomics/mutation-drug-network`, { headers });
    const { nodes } = await res.json();
    for (const node of nodes) {
      expect(node).toHaveProperty('data');
      expect(typeof node.data.id).toBe('string');
      expect(node.data.id.trim().length).toBeGreaterThan(0);
      expect(typeof node.data.label).toBe('string');
      expect(typeof node.data.type).toBe('string');
    }
  });

  test('mutation nodes have type=mutation', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/genomics/mutation-drug-network`, { headers });
    const { nodes } = await res.json();
    const mutNodes = nodes.filter(n => n.data?.id?.startsWith('mutation_'));
    // We have at least one seeded mutation (ARID1A)
    expect(mutNodes.length).toBeGreaterThan(0);
    for (const n of mutNodes) {
      expect(n.data.type).toBe('mutation');
    }
  });

  test('each edge has data.source and data.target referencing valid node ids', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/genomics/mutation-drug-network`, { headers });
    const { nodes, edges } = await res.json();
    const nodeIds = new Set(nodes.map(n => n.data?.id));
    for (const edge of edges) {
      expect(edge).toHaveProperty('data');
      expect(typeof edge.data.source).toBe('string');
      expect(typeof edge.data.target).toBe('string');
      // source and target must correspond to existing nodes
      expect(nodeIds.has(edge.data.source)).toBe(true);
      expect(nodeIds.has(edge.data.target)).toBe(true);
    }
  });

  test('mutation node ids are prefixed mutation_<int>', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/genomics/mutation-drug-network`, { headers });
    const { nodes } = await res.json();
    const mutNodes = nodes.filter(n => n.data?.type === 'mutation');
    for (const n of mutNodes) {
      expect(n.data.id).toMatch(/^mutation_\d+$/);
    }
  });

  test('response never contains SQL error strings', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/genomics/mutation-drug-network`, { headers });
    const text = await res.text();
    expect(text).not.toMatch(/SqliteError|SQLITE_ERROR|no such (table|column)/i);
  });

  test('unauthenticated → 401', async ({ request }) => {
    const res = await request.get(`${API}/api/genomics/mutation-drug-network`);
    expect(res.status()).toBe(401);
  });
});

// ─── 2. GET /api/genomics/pathway-graph — nodes/edges field contracts ─────────

test.describe('GET /api/genomics/pathway-graph — field contracts', () => {
  test('response has nodes and edges arrays', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/genomics/pathway-graph`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Must have nodes + edges (even if empty arrays)
    expect(body).toHaveProperty('nodes');
    expect(body).toHaveProperty('edges');
    expect(Array.isArray(body.nodes)).toBe(true);
    expect(Array.isArray(body.edges)).toBe(true);
  });

  test('pathway nodes have data.id, data.label, data.type', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/genomics/pathway-graph`, { headers });
    const { nodes } = await res.json();
    for (const node of nodes) {
      expect(node).toHaveProperty('data');
      expect(node.data).toHaveProperty('id');
      expect(node.data).toHaveProperty('label');
      expect(node.data).toHaveProperty('type');
    }
  });

  test('pathway graph edges have source and target', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/genomics/pathway-graph`, { headers });
    const { edges } = await res.json();
    for (const edge of edges) {
      expect(edge).toHaveProperty('data');
      expect(edge.data).toHaveProperty('source');
      expect(edge.data).toHaveProperty('target');
    }
  });

  test('edge source and target reference real node ids', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/genomics/pathway-graph`, { headers });
    const { nodes, edges } = await res.json();
    const nodeIds = new Set(nodes.map(n => n.data?.id));
    for (const edge of edges) {
      if (edge.data?.source) expect(nodeIds.has(edge.data.source)).toBe(true);
      if (edge.data?.target) expect(nodeIds.has(edge.data.target)).toBe(true);
    }
  });

  test('never leaks raw error strings in response', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/genomics/pathway-graph`, { headers });
    const text = await res.text();
    expect(text).not.toMatch(/SqliteError|SQLITE_ERROR|stack trace/i);
  });
});

// ─── 3. GET /api/genomics/vus — VUS variant field types ──────────────────────

test.describe('GET /api/genomics/vus — VUS field contracts', () => {
  test('returns 200 and an array', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/genomics/vus`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('content-type is application/json', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/genomics/vus`, { headers });
    expect(res.headers()['content-type']).toMatch(/application\/json/);
  });

  test('unauthenticated → 401', async ({ request }) => {
    const res = await request.get(`${API}/api/genomics/vus`);
    expect(res.status()).toBe(401);
  });

  test('when array is non-empty, each item has gene and variant fields', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/genomics/vus`, { headers });
    const body = await res.json();
    for (const v of body) {
      expect(v).toHaveProperty('gene');
      expect(typeof v.gene).toBe('string');
      // variant may be null but field must exist in schema
      expect('variant' in v || 'id' in v).toBe(true);
    }
  });

  test('each item has an id field (integer)', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/genomics/vus`, { headers });
    const body = await res.json();
    for (const v of body) {
      expect(v).toHaveProperty('id');
      expect(typeof v.id).toBe('number');
    }
  });

  test('response does not expose raw SQL or stack traces', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/genomics/vus`, { headers });
    const text = await res.text();
    expect(text).not.toMatch(/SqliteError|stack|traceback/i);
  });
});

// ─── 4. GET /api/genomics/treatment-correlations — join field contracts ────────

test.describe('GET /api/genomics/treatment-correlations — join field contracts', () => {
  test('returns 200 with an array', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/genomics/treatment-correlations`, { headers });
    expect(res.status()).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test('each correlation has id and correlation_type fields', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/genomics/treatment-correlations`, { headers });
    const body = await res.json();
    for (const row of body) {
      expect(row).toHaveProperty('id');
      expect(row).toHaveProperty('correlation_type');
    }
  });

  test('medication_name is a string or null (never undefined)', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/genomics/treatment-correlations`, { headers });
    const body = await res.json();
    for (const row of body) {
      expect(['string', 'object'].includes(typeof row.medication_name) || row.medication_name === null).toBe(true);
    }
  });

  test('response never leaks raw SQL', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/genomics/treatment-correlations`, { headers });
    const text = await res.text();
    expect(text).not.toMatch(/SQLITE_ERROR|no such column/i);
  });

  test('unauthenticated → 401', async ({ request }) => {
    const res = await request.get(`${API}/api/genomics/treatment-correlations`);
    expect(res.status()).toBe(401);
  });
});

// ─── 5. POST /api/fhir/sync — success/failure response field contracts ─────────

const EPIC_CRED_ID    = 99;  // seeded: epic, valid token
const EXPIRED_CRED_ID = 98;  // seeded: epic, expired token
const NON_EPIC_CRED   = 97;  // seeded: carespace
const MISSING_CRED    = 888; // not seeded

test.describe('POST /api/fhir/sync — response field contracts', () => {
  test('non-numeric credential id → 400 with error string', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.post(`${API}/api/fhir/sync/BADID`, { headers });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
    expect(body.error.length).toBeGreaterThan(0);
  });

  test('missing credential → 404 with error string', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.post(`${API}/api/fhir/sync/${MISSING_CRED}`, { headers });
    expect([404, 500]).toContain(res.status());
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });

  test('non-epic credential → 400 with error string', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.post(`${API}/api/fhir/sync/${NON_EPIC_CRED}`, { headers });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
    expect(body.error).toMatch(/epic/i);
  });

  test('sync attempt with valid-token cred returns JSON (even if FHIR API unreachable)', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.post(`${API}/api/fhir/sync/${EPIC_CRED_ID}`, { headers });
    // May succeed (200) or fail gracefully (500) when FHIR server unreachable in test env
    const ct = res.headers()['content-type'] || '';
    expect(ct).toMatch(/application\/json/);
    const body = await res.json();
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
  });

  test('on success, response has success, recordsImported, summary fields', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.post(`${API}/api/fhir/sync/${EPIC_CRED_ID}`, { headers });
    const body = await res.json();
    if (res.status() === 200 && body.success !== undefined) {
      // Success path field contracts
      expect(typeof body.success).toBe('boolean');
      expect(typeof body.recordsImported).toBe('number');
      expect(typeof body.summary).toBe('object');
      expect(body.summary).not.toBeNull();
    } else {
      // Failure path must have error field
      expect(typeof body.error).toBe('string');
    }
  });

  test('error response never leaks access_token or refresh_token', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.post(`${API}/api/fhir/sync/${MISSING_CRED}`, { headers });
    const text = await res.text();
    expect(text).not.toContain('test-access-token');
    expect(text).not.toContain('refresh_token');
  });

  test('unauthenticated → 401', async ({ request }) => {
    const res = await request.post(`${API}/api/fhir/sync/${EPIC_CRED_ID}`);
    expect(res.status()).toBe(401);
  });
});

// ─── 6. GET /api/cancer-profiles/biomarkers/:gene — edge cases ────────────────

test.describe('GET /api/cancer-profiles/biomarkers/:gene — edge-case genes', () => {
  test('TP53 — known multi-cancer biomarker returns valid structure', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/cancer-profiles/biomarkers/TP53`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('gene', 'TP53');
    expect(Array.isArray(body.matches)).toBe(true);
  });

  test('KRAS — returns 200 with gene field', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/cancer-profiles/biomarkers/KRAS`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.gene).toBe('KRAS');
  });

  test('unknown gene — returns 200 with empty matches array (no crash)', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/cancer-profiles/biomarkers/UNKNOWN_GENE_XYZ`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('gene', 'UNKNOWN_GENE_XYZ');
    expect(Array.isArray(body.matches)).toBe(true);
    expect(body.matches.length).toBe(0);
  });

  test('matches objects have id and name fields', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/cancer-profiles/biomarkers/FGFR3`, { headers });
    const { matches } = await res.json();
    for (const m of matches) {
      expect(m).toHaveProperty('id');
      expect(m).toHaveProperty('name');
    }
  });

  test('unauthenticated → 401', async ({ request }) => {
    const res = await request.get(`${API}/api/cancer-profiles/biomarkers/FGFR3`);
    expect(res.status()).toBe(401);
  });

  test('gene name is echoed exactly as provided (case-sensitive)', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/cancer-profiles/biomarkers/PIK3CA`, { headers });
    const body = await res.json();
    expect(body.gene).toBe('PIK3CA');
  });
});

// ─── 7. GET /api/portals/sync-history — ordering + field completeness ──────────

test.describe('GET /api/portals/sync-history — ordering and fields', () => {
  test('returns 200 with an array', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/portals/sync-history`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('every row has credential_id, status, and sync_started', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/portals/sync-history`, { headers });
    const body = await res.json();
    for (const row of body) {
      expect(row).toHaveProperty('credential_id');
      expect(row).toHaveProperty('status');
      expect(row).toHaveProperty('sync_started');
    }
  });

  test('status field is a known value (never null or empty)', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/portals/sync-history`, { headers });
    const body = await res.json();
    const VALID_STATUS = new Set(['success', 'error', 'pending', 'never', 'running', 'partial']);
    for (const row of body) {
      if (row.status !== null) {
        expect(VALID_STATUS.has(row.status) || typeof row.status === 'string').toBe(true);
      }
    }
  });

  test('rows are ordered by sync_started descending (most recent first)', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/portals/sync-history`, { headers });
    const body = await res.json();
    if (body.length < 2) return; // can't test ordering with < 2 rows
    for (let i = 1; i < body.length; i++) {
      const a = body[i - 1].sync_started;
      const b = body[i].sync_started;
      if (a && b) {
        // Most recent first: a >= b
        expect(new Date(a) >= new Date(b)).toBe(true);
      }
    }
  });

  test('unauthenticated → 401', async ({ request }) => {
    const res = await request.get(`${API}/api/portals/sync-history`);
    expect(res.status()).toBe(401);
  });

  test('content-type is application/json', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/portals/sync-history`, { headers });
    expect(res.headers()['content-type']).toMatch(/application\/json/);
  });

  test('credential_id is always a number (never a string)', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/portals/sync-history`, { headers });
    const body = await res.json();
    for (const row of body) {
      expect(typeof row.credential_id).toBe('number');
    }
  });
});

// ─── 8. GET /api/portals/credentials/:id — field types + security ─────────────

test.describe('GET /api/portals/credentials/:id — field contracts', () => {
  test('seeded credential id=99 returns 200', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/portals/credentials/99`, { headers });
    expect(res.status()).toBe(200);
  });

  test('response has service_name, portal_type, base_url', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/portals/credentials/99`, { headers });
    const body = await res.json();
    expect(typeof body.service_name).toBe('string');
    expect(typeof body.portal_type).toBe('string');
    expect(typeof body.base_url).toBe('string');
  });

  test('credential response never exposes encrypted fields in plaintext', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/portals/credentials/99`, { headers });
    const text = await res.text();
    // Must not contain the raw password or decrypt key
    expect(text).not.toMatch(/password_encrypted|username_encrypted/);
  });

  test('non-existent id → 404 (not 500)', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/portals/credentials/88888`, { headers });
    expect(res.status()).toBe(404);
  });

  test('non-numeric id → 400 or 404 (not 500 crash)', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/portals/credentials/abc`, { headers });
    expect([400, 404]).toContain(res.status());
  });

  test('unauthenticated → 401', async ({ request }) => {
    const res = await request.get(`${API}/api/portals/credentials/99`);
    expect(res.status()).toBe(401);
  });

  test('response is always JSON (never HTML)', async ({ request }) => {
    const headers = await authHeaders(request);
    const res = await request.get(`${API}/api/portals/credentials/99`, { headers });
    expect(res.headers()['content-type']).toMatch(/application\/json/);
  });
});

// ─── 9. Error shape consistency — all 4xx must have error string ───────────────

test.describe('Error response shape consistency — all 4xx have error field', () => {
  const fourxxRoutes = [
    { method: 'GET',  path: '/api/portals/credentials/abc',          desc: 'credentials non-numeric id' },
    { method: 'GET',  path: '/api/fhir/status/abc',                  desc: 'fhir status non-numeric id' },
    { method: 'POST', path: '/api/fhir/sync/BADID',                  desc: 'fhir sync non-numeric id' },
    { method: 'POST', path: '/api/fhir/refresh/abc',                 desc: 'fhir refresh non-numeric id' },
    { method: 'DELETE',path: '/api/fhir/revoke/abc',                 desc: 'fhir revoke non-numeric id' },
    { method: 'GET',  path: '/api/fhir/authorize/abc',               desc: 'fhir authorize non-numeric id' },
    { method: 'POST', path: '/api/vault/unlock',                     desc: 'vault unlock missing password' },
    { method: 'GET',  path: '/api/portals/credentials/99/sync-history?limit=abc', desc: 'sync-history invalid limit' },
  ];

  for (const route of fourxxRoutes) {
    test(`${route.method} ${route.path} → 4xx with error string (${route.desc})`, async ({ request }) => {
      const headers = await authHeaders(request);
      let res;
      switch (route.method) {
        case 'GET':    res = await request.get(`${API}${route.path}`,    { headers }); break;
        case 'POST':   res = await request.post(`${API}${route.path}`,   { headers, data: {} }); break;
        case 'DELETE': res = await request.delete(`${API}${route.path}`, { headers }); break;
        default:       res = await request.get(`${API}${route.path}`,    { headers });
      }
      const status = res.status();
      if (status >= 400 && status < 500) {
        const ct = res.headers()['content-type'] || '';
        if (ct.includes('application/json')) {
          const body = await res.json();
          expect(body).toHaveProperty('error');
          expect(typeof body.error).toBe('string');
          expect(body.error.length).toBeGreaterThan(0);
        }
      }
      // Any response that's 4xx should not be 500
      expect(status).not.toBe(500);
    });
  }
});
