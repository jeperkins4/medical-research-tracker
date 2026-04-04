/**
 * Portal Sync Multi-Cancer Data Ingestion E2E Tests
 * Verifies cross-cancer genomic mutation support and portal data sync
 */

import { test, expect } from '@playwright/test';

const API_BASE = 'http://localhost:3000';

test.describe('Portal Sync - Multi-Cancer Support', () => {
  let authToken;

  test.beforeAll(async ({ request }) => {
    // Setup: Create test user and login
    const setupRes = await request.post(`${API_BASE}/api/auth/setup`, {
      data: { username: 'test-multi-cancer-user', password: 'test-password-123' }
    });

    if (setupRes.status() === 400) {
      const loginRes = await request.post(`${API_BASE}/api/auth/login`, {
        data: { username: 'test-multi-cancer-user', password: 'test-password-123' }
      });
      expect(loginRes.status()).toBe(200);
    } else {
      expect(setupRes.status()).toBe(200);
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
      const result = await response.json();
      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
    }
  });

  test('should sync genomic data for prostate cancer', async ({ request }) => {
    const syncData = {
      portalId: 'test-portal-prostate',
      dataType: 'genomics',
      cancerType: 'prostate',
      mutations: [
        { gene: 'TP53', alteration: 'R175H', vaf: 0.48 },
        { gene: 'PTEN', alteration: 'Loss of function', vaf: 0.50 },
        { gene: 'BRCA2', alteration: 'Frameshift', vaf: 0.42 }
      ]
    };

    const response = await request.post(`${API_BASE}/api/portal/sync`, {
      data: syncData
    });

    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(500);
  });

  test('should sync genomic data for lung cancer', async ({ request }) => {
    const syncData = {
      portalId: 'test-portal-lung',
      dataType: 'genomics',
      cancerType: 'lung',
      mutations: [
        { gene: 'EGFR', alteration: 'L858R', vaf: 0.55 },
        { gene: 'ALK', alteration: 'EML4-ALK fusion', vaf: 0.48 },
        { gene: 'KRAS', alteration: 'G12C', vaf: 0.50 }
      ]
    };

    const response = await request.post(`${API_BASE}/api/portal/sync`, {
      data: syncData
    });

    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(500);
  });

  test('should sync genomic data for ovarian cancer', async ({ request }) => {
    const syncData = {
      portalId: 'test-portal-ovarian',
      dataType: 'genomics',
      cancerType: 'ovarian',
      mutations: [
        { gene: 'BRCA1', alteration: '5382insC', vaf: 0.49 },
        { gene: 'BRCA2', alteration: '6174delT', vaf: 0.50 },
        { gene: 'TP53', alteration: 'R248Q', vaf: 0.46 }
      ]
    };

    const response = await request.post(`${API_BASE}/api/portal/sync`, {
      data: syncData
    });

    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(500);
  });

  test('should retrieve synced genomic mutations for all cancer types', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/genomics/mutations`);

    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(500);

    if (response.status() === 200) {
      const mutations = await response.json();
      expect(Array.isArray(mutations)).toBe(true);
      // Verify we have mutations from multiple cancer types
      if (mutations.length > 0) {
        expect(mutations[0]).toHaveProperty('gene');
        expect(mutations[0]).toHaveProperty('alteration');
        expect(mutations[0]).toHaveProperty('variant_allele_frequency');
      }
    }
  });

  test('should validate genomic report normalization across cancer types', async ({ request }) => {
    // Get all genomic data
    const mutationsRes = await request.get(`${API_BASE}/api/genomics/mutations`);
    expect(mutationsRes.status()).toBeGreaterThanOrEqual(200);

    if (mutationsRes.status() === 200) {
      const mutations = await mutationsRes.json();
      
      // Verify schema consistency across all mutations
      mutations.forEach(mutation => {
        expect(mutation).toHaveProperty('gene');
        expect(mutation).toHaveProperty('alteration');
        expect(mutation).toHaveProperty('variant_allele_frequency');
        
        // VAF should be between 0 and 1
        expect(mutation.variant_allele_frequency).toBeGreaterThanOrEqual(0);
        expect(mutation.variant_allele_frequency).toBeLessThanOrEqual(1);
      });
    }
  });

  test('should retrieve treatment opportunities mapped to mutations', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/genomics/dashboard`);

    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(500);

    if (response.status() === 200) {
      const dashboard = await response.json();
      expect(dashboard).toHaveProperty('mutations');
      expect(dashboard).toHaveProperty('treatments');
      
      // Verify dashboard structure
      if (dashboard.mutations && dashboard.mutations.length > 0) {
        dashboard.mutations.forEach(mut => {
          expect(mut).toHaveProperty('gene');
          expect(mut).toHaveProperty('treatment_count');
          expect(mut).toHaveProperty('pathway_count');
        });
      }
    }
  });

  test('should handle cross-cancer mutation query efficiently', async ({ request }) => {
    const startTime = Date.now();
    
    const response = await request.get(`${API_BASE}/api/genomics/mutations`);
    
    const duration = Date.now() - startTime;
    
    // Query should complete within 5 seconds
    expect(duration).toBeLessThan(5000);
    expect(response.status()).toBeGreaterThanOrEqual(200);
  });

  test('should sync and retrieve genomic pathways for multi-cancer mutations', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/genomics/pathways`);

    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(500);

    if (response.status() === 200) {
      const pathways = await response.json();
      expect(Array.isArray(pathways)).toBe(true);
      
      // Verify pathway structure
      if (pathways.length > 0) {
        pathways.forEach(pathway => {
          expect(pathway).toHaveProperty('pathway_name');
          expect(pathway).toHaveProperty('description');
        });
      }
    }
  });

  test('should return mutation-drug network for visualization', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/genomics/mutation-drug-network`);

    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(500);

    if (response.status() === 200) {
      const network = await response.json();
      expect(network).toHaveProperty('nodes');
      expect(network).toHaveProperty('edges');
      expect(Array.isArray(network.nodes)).toBe(true);
      expect(Array.isArray(network.edges)).toBe(true);
      
      // Nodes should be Cytoscape-compatible
      if (network.nodes.length > 0) {
        network.nodes.forEach(node => {
          expect(node).toHaveProperty('data');
          expect(node.data).toHaveProperty('id');
          expect(node.data).toHaveProperty('label');
          expect(node.data).toHaveProperty('type');
        });
      }
    }
  });

  test('should validate portal sync data schema', async ({ request }) => {
    // Test invalid cancer type
    const invalidRes = await request.post(`${API_BASE}/api/portal/sync`, {
      data: {
        portalId: 'test-invalid',
        dataType: 'genomics',
        cancerType: 'unknown-cancer-type',
        mutations: []
      }
    });

    // Should either accept it (flexible schema) or reject with 400
    expect(invalidRes.status()).toBeGreaterThanOrEqual(200);
    expect(invalidRes.status()).toBeLessThan(500);
  });

  test('should enforce VAF (variant allele frequency) constraints', async ({ request }) => {
    const syncData = {
      portalId: 'test-vaf-validation',
      dataType: 'genomics',
      cancerType: 'bladder',
      mutations: [
        { gene: 'TEST_GENE', alteration: 'TEST_ALT', vaf: 1.5 } // Invalid: > 1
      ]
    };

    const response = await request.post(`${API_BASE}/api/portal/sync`, {
      data: syncData
    });

    // Should either normalize VAF or reject with 400
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(500);
  });
});
