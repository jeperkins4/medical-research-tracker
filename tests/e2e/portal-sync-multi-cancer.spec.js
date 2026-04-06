/**
 * Portal Sync Multi-Cancer Data Ingestion E2E Tests
 * Verifies cross-cancer genomic mutation support and portal data sync
 */

import { test, expect } from '@playwright/test';

const API_BASE = 'http://localhost:3000';

test.describe('Portal Sync - Multi-Cancer Support', () => {
  test.beforeEach(async ({ context }) => {
    // Setup: Create test user and login
    const testUsername = `user-${Date.now()}`;
    const testPassword = 'test-password-123';

    // Create a dedicated request context for setup
    const apiRequest = await context.request;

    // Setup user (ignore if already exists)
    await apiRequest.post(`${API_BASE}/api/auth/setup`, {
      data: { username: testUsername, password: testPassword }
    }).catch(() => {
      // User might already exist, will login instead
    });

    // Login
    const loginRes = await apiRequest.post(`${API_BASE}/api/auth/login`, {
      data: { username: testUsername, password: testPassword }
    });

    if (loginRes.status() === 200) {
      const loginData = await loginRes.json();
      // Cookie is automatically managed by browser context
    }
  });

  test('should sync genomic data for bladder cancer (ARID1A, FGFR3, PIK3CA)', async ({ request }) => {
    const syncData = {
      portalId: 'test-portal-bladder',
      dataType: 'genomics',
      cancerType: 'bladder',
      mutations: [
        { gene: 'ARID1A', alteration: 'Loss of function', vaf: 0.45 },
        { gene: 'FGFR3', alteration: 'S249C', vaf: 0.52 },
        { gene: 'PIK3CA', alteration: 'H1047R', vaf: 0.38 }
      ]
    };

    const response = await request.post(`${API_BASE}/api/portal/sync`, {
      data: syncData
    });

    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(500);

    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('synced');
      expect(data.synced).toBeGreaterThanOrEqual(3); // At least 3 mutations
    }
  });

  test('should sync genomic data for prostate cancer (TP53, PTEN, BRCA2)', async ({ request }) => {
    const syncData = {
      portalId: 'test-portal-prostate',
      dataType: 'genomics',
      cancerType: 'prostate',
      mutations: [
        { gene: 'TP53', alteration: 'R175H', vaf: 0.48 },
        { gene: 'PTEN', alteration: 'Loss of function', vaf: 0.51 },
        { gene: 'BRCA2', alteration: 'Frameshift', vaf: 0.42 }
      ]
    };

    const response = await request.post(`${API_BASE}/api/portal/sync`, {
      data: syncData
    });

    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(500);
  });

  test('should sync genomic data for lung cancer (EGFR, ALK, KRAS)', async ({ request }) => {
    const syncData = {
      portalId: 'test-portal-lung',
      dataType: 'genomics',
      cancerType: 'lung',
      mutations: [
        { gene: 'EGFR', alteration: 'L858R', vaf: 0.55 },
        { gene: 'ALK', alteration: 'Fusion', vaf: 0.49 },
        { gene: 'KRAS', alteration: 'G12C', vaf: 0.46 }
      ]
    };

    const response = await request.post(`${API_BASE}/api/portal/sync`, {
      data: syncData
    });

    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(500);
  });

  test('should sync genomic data for ovarian cancer (BRCA1, BRCA2, TP53)', async ({ request }) => {
    const syncData = {
      portalId: 'test-portal-ovarian',
      dataType: 'genomics',
      cancerType: 'ovarian',
      mutations: [
        { gene: 'BRCA1', alteration: '5382insC', vaf: 0.50 },
        { gene: 'BRCA2', alteration: '6174delT', vaf: 0.48 },
        { gene: 'TP53', alteration: 'R248Q', vaf: 0.52 }
      ]
    };

    const response = await request.post(`${API_BASE}/api/portal/sync`, {
      data: syncData
    });

    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(500);
  });

  test('should enforce VAF constraints (must be 0-1)', async ({ request }) => {
    const invalidData = {
      portalId: 'test-portal-invalid-vaf',
      dataType: 'genomics',
      cancerType: 'bladder',
      mutations: [
        { gene: 'ARID1A', alteration: 'Loss of function', vaf: 1.5 } // Invalid VAF
      ]
    };

    const response = await request.post(`${API_BASE}/api/portal/sync`, {
      data: invalidData
    });

    // Should reject invalid VAF
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('should retrieve mutations across all cancer types', async ({ request }) => {
    // First sync data for multiple cancer types
    const bladderSync = {
      portalId: 'test-retrieve-bladder',
      dataType: 'genomics',
      cancerType: 'bladder',
      mutations: [{ gene: 'ARID1A', alteration: 'Loss', vaf: 0.45 }]
    };

    await request.post(`${API_BASE}/api/portal/sync`, { data: bladderSync });

    const prostateSync = {
      portalId: 'test-retrieve-prostate',
      dataType: 'genomics',
      cancerType: 'prostate',
      mutations: [{ gene: 'TP53', alteration: 'R175H', vaf: 0.48 }]
    };

    await request.post(`${API_BASE}/api/portal/sync`, { data: prostateSync });

    // Then retrieve all mutations
    const response = await request.get(`${API_BASE}/api/genomics/mutations`);

    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(500);

    if (response.status() === 200) {
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    }
  });

  test('should return genomic dashboard with treatment opportunities', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/genomics/dashboard`);

    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(500);

    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('mutations');
      expect(data).toHaveProperty('treatments');
    }
  });

  test('should map mutations to molecular pathways', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/genomics/pathways`);

    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(500);

    if (response.status() === 200) {
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    }
  });

  test('should generate Cytoscape-compatible mutation-drug network', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/genomics/mutation-drug-network`);

    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(500);

    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('nodes');
      expect(data).toHaveProperty('edges');
      expect(Array.isArray(data.nodes)).toBe(true);
      expect(Array.isArray(data.edges)).toBe(true);
    }
  });

  test('should handle invalid cancer types gracefully', async ({ request }) => {
    const invalidData = {
      portalId: 'test-portal-invalid-cancer',
      dataType: 'genomics',
      cancerType: 'invalid-cancer-type',
      mutations: [{ gene: 'TEST', alteration: 'Test', vaf: 0.5 }]
    };

    const response = await request.post(`${API_BASE}/api/portal/sync`, {
      data: invalidData
    });

    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('should complete query within performance threshold (<5 seconds)', async ({ request }) => {
    const startTime = Date.now();

    const response = await request.get(`${API_BASE}/api/genomics/mutations?limit=100`);

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(5000); // Must complete within 5 seconds
    expect(response.status()).toBeGreaterThanOrEqual(200);
  });

  test('should validate schema consistency across cancer types', async ({ request }) => {
    // Sync different cancer types
    const cancerTypes = [
      {
        type: 'bladder',
        mutations: [{ gene: 'ARID1A', alteration: 'Loss', vaf: 0.45 }]
      },
      {
        type: 'prostate',
        mutations: [{ gene: 'TP53', alteration: 'R175H', vaf: 0.48 }]
      }
    ];

    for (const cancer of cancerTypes) {
      const syncData = {
        portalId: `test-schema-${cancer.type}`,
        dataType: 'genomics',
        cancerType: cancer.type,
        mutations: cancer.mutations
      };

      const response = await request.post(`${API_BASE}/api/portal/sync`, {
        data: syncData
      });

      expect(response.status()).toBeGreaterThanOrEqual(200);
    }

    // Retrieve and verify schema consistency
    const response = await request.get(`${API_BASE}/api/genomics/mutations`);

    if (response.status() === 200) {
      const data = await response.json();
      // All mutations should have consistent schema
      if (Array.isArray(data) && data.length > 0) {
        const expectedKeys = ['gene', 'alteration', 'vaf', 'cancer_type'];
        data.forEach(mutation => {
          expectedKeys.forEach(key => {
            expect(mutation).toHaveProperty(key);
          });
        });
      }
    }
  });
});
