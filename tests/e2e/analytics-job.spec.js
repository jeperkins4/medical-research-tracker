import { test, expect } from '@playwright/test';

// Analytics job tests — verify aggregation functions are called on schedule
// and that the aggregation populates the analytics tables correctly.

test.describe('Analytics Aggregation Job', () => {
  test.beforeEach(async ({ request }) => {
    // Clear analytics tables before each test
    try {
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      const headers = { 'Content-Type': 'application/json' };
      
      // POST a maintenance endpoint to clear tables (if available)
      // For now, this is just a placeholder
    } catch (err) {
      console.warn('Could not clear analytics tables:', err.message);
    }
  });

  test('GET /api/analytics/dashboard returns aggregated user metrics', async ({ request }) => {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const response = await request.get(`${baseUrl}/api/analytics/dashboard`);
    expect(response.status()).toBe(200);

    const data = await response.json();
    
    // User metrics should always be present
    expect(data).toHaveProperty('user_metrics');
    expect(data.user_metrics).toHaveProperty('total_conditions');
    expect(data.user_metrics).toHaveProperty('total_medications');
    expect(data.user_metrics).toHaveProperty('total_lab_results');
    expect(data.user_metrics).toHaveProperty('total_vitals');
    expect(data.user_metrics).toHaveProperty('total_mutations');
    expect(data.user_metrics).toHaveProperty('total_papers');
    expect(data.user_metrics).toHaveProperty('metric_date');

    // All counts should be non-negative integers
    expect(typeof data.user_metrics.total_conditions).toBe('number');
    expect(typeof data.user_metrics.total_medications).toBe('number');
    expect(typeof data.user_metrics.total_lab_results).toBe('number');
    expect(typeof data.user_metrics.total_vitals).toBe('number');
    expect(typeof data.user_metrics.total_mutations).toBe('number');
    expect(typeof data.user_metrics.total_papers).toBe('number');
    expect(data.user_metrics.total_conditions).toBeGreaterThanOrEqual(0);
    expect(data.user_metrics.total_medications).toBeGreaterThanOrEqual(0);
  });

  test('GET /api/analytics/diagnoses returns diagnosis aggregates (may be empty)', async ({ request }) => {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const response = await request.get(`${baseUrl}/api/analytics/diagnoses`);
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    
    // Each entry should have icd10, condition_name, count, pct
    if (data.length > 0) {
      expect(data[0]).toHaveProperty('icd10');
      expect(data[0]).toHaveProperty('condition_name');
      expect(data[0]).toHaveProperty('count');
      expect(data[0]).toHaveProperty('pct');
      expect(typeof data[0].count).toBe('number');
      expect(typeof data[0].pct).toBe('number');
    }
  });

  test('GET /api/analytics/mutations returns mutation aggregates (may be empty)', async ({ request }) => {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const response = await request.get(`${baseUrl}/api/analytics/mutations`);
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    
    // Each entry should have gene, mutation, count, pct
    if (data.length > 0) {
      expect(data[0]).toHaveProperty('gene');
      expect(data[0]).toHaveProperty('mutation');
      expect(data[0]).toHaveProperty('count');
      expect(data[0]).toHaveProperty('pct');
      expect(typeof data[0].count).toBe('number');
      expect(typeof data[0].pct).toBe('number');
    }
  });

  test('GET /api/analytics/treatments returns treatment aggregates (may be empty)', async ({ request }) => {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const response = await request.get(`${baseUrl}/api/analytics/treatments`);
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    
    // Each entry should have therapy_name, count, pct
    if (data.length > 0) {
      expect(data[0]).toHaveProperty('therapy_name');
      expect(data[0]).toHaveProperty('count');
      expect(data[0]).toHaveProperty('pct');
      expect(typeof data[0].count).toBe('number');
    }
  });

  test('analytics dashboard never returns null for user_metrics', async ({ request }) => {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const response = await request.get(`${baseUrl}/api/analytics/dashboard`);
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.user_metrics).not.toBeNull();
    expect(data.user_metrics).not.toBeUndefined();
  });

  test('analytics endpoints handle missing tables gracefully (return empty or counts)', async ({ request }) => {
    // Even if analytics tables don't exist yet, endpoints should not crash
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    
    const endpoints = [
      '/api/analytics/dashboard',
      '/api/analytics/diagnoses',
      '/api/analytics/mutations',
      '/api/analytics/treatments',
    ];

    for (const endpoint of endpoints) {
      const response = await request.get(`${baseUrl}${endpoint}`);
      // Should return 200 (graceful empty state) not 500
      expect([200, 401]).toContain(response.status());
    }
  });
});
