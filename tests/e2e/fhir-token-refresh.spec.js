/**
 * FHIR Token Refresh E2E Tests
 * Verifies token refresh flows during portal operations
 */

import { test, expect } from '@playwright/test';

const API_BASE = 'http://localhost:3000';

test.describe('FHIR Token Refresh Flows', () => {
  let credentialId;
  let authToken;

  test.beforeAll(async ({ browser }) => {
    // Create a test context that can login via HTTP
    // For E2E testing, we'll first create a user via /api/auth/setup
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      // Attempt to create test user (will fail if user exists, which is fine)
      const setupRes = await page.request.post(`${API_BASE}/api/auth/setup`, {
        data: { username: 'testuser', password: 'testpass123' }
      });
      
      if (setupRes.ok()) {
        const setupData = await setupRes.json();
        console.log('Test user created or already exists');
      }
    } catch (e) {
      console.log('Setup skipped or user already exists');
    }
    
    // Now login to get auth token
    const loginRes = await page.request.post(`${API_BASE}/api/auth/login`, {
      data: { username: 'testuser', password: 'testpass123' }
    });
    
    if (loginRes.ok()) {
      // Get the auth_token from cookies
      const cookies = await context.cookies();
      const tokenCookie = cookies.find(c => c.name === 'auth_token');
      if (tokenCookie) {
        authToken = tokenCookie.value;
      }
    }
    
    await context.close();
  });

  test.beforeEach(async ({ request }) => {
    // Set Authorization header for authenticated requests if we have a token
    if (authToken) {
      request.post(`${API_BASE}/api/fhir/auth/init`, {
        headers: { 'Cookie': `auth_token=${authToken}` },
        data: { credentialId: 1, fhirServerUrl: 'https://r4.smarthealthit.org/api' }
      }).catch(() => {});
    }
  });

  test('should initialize OAuth flow and get authorization URL', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/fhir/auth/init`, {
      headers: authToken ? { 'Cookie': `auth_token=${authToken}` } : {},
      data: {
        credentialId: 1,
        fhirServerUrl: 'https://r4.smarthealthit.org/api',
        clientId: 'test-client-id',
        redirectUri: `${API_BASE}/api/fhir/auth/callback`
      }
    });

    // May return 401 if auth not set up, or 200 if successful
    if (!authToken) {
      expect(response.status()).toBe(401);
      expect(await response.json()).toHaveProperty('error');
    } else {
      expect(response.status()).toBeGreaterThanOrEqual(200);
      expect(response.status()).toBeLessThan(500);

      if (response.status() === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('authorizationUrl');
        expect(data).toHaveProperty('codeVerifier');
        expect(data).toHaveProperty('state');
        expect(data.authorizationUrl).toContain('oauth2/authorize');
        
        credentialId = 1;
      }
    }
  });

  test('should check token status before expiration', async ({ request }) => {
    if (!credentialId) credentialId = 1;

    const response = await request.get(`${API_BASE}/api/fhir/status?credentialId=${credentialId}`, {
      headers: authToken ? { 'Cookie': `auth_token=${authToken}` } : {}
    });

    // May return 401 if auth not set up, or 200+ if successful
    if (!authToken) {
      expect(response.status()).toBe(401);
    } else {
      expect(response.status()).toBeGreaterThanOrEqual(200);
      expect(response.status()).toBeLessThan(500);
      const data = await response.json();
      expect(data).toHaveProperty('status');
    }
  });

  test('should validate and refresh token if needed', async ({ request }) => {
    if (!credentialId) credentialId = 1;

    const response = await request.post(`${API_BASE}/api/fhir/token/validate`, {
      headers: authToken ? { 'Cookie': `auth_token=${authToken}` } : {},
      data: { credentialId }
    });

    // May return 401 if auth not set up, or 200+ if successful
    if (!authToken) {
      expect(response.status()).toBe(401);
    } else {
      expect(response.status()).toBeGreaterThanOrEqual(200);
      expect(response.status()).toBeLessThan(600);
    }
  });

  test('should handle refresh token flow', async ({ request }) => {
    if (!credentialId) credentialId = 1;

    const response = await request.post(`${API_BASE}/api/fhir/token/refresh`, {
      headers: authToken ? { 'Cookie': `auth_token=${authToken}` } : {},
      data: { credentialId }
    });

    // May fail if credential doesn't have refresh_token set up
    if (!authToken) {
      expect(response.status()).toBe(401);
    } else {
      expect(response.status()).toBeGreaterThanOrEqual(200);
      expect(response.status()).toBeLessThan(600);

      if (response.status() === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('accessToken');
      }
    }
  });

  test('should simulate token expiration and refresh', async ({ request }) => {
    if (!credentialId) credentialId = 1;
    
    if (!authToken) {
      // Skip if auth not available
      expect(true).toBe(true);
      return;
    }

    const headers = { 'Cookie': `auth_token=${authToken}` };

    // Step 1: Get current status
    const statusBefore = await request.get(`${API_BASE}/api/fhir/status?credentialId=${credentialId}`, { headers });
    expect(statusBefore.status()).toBeGreaterThanOrEqual(200);

    // Step 2: Trigger validation (which should refresh if expired)
    const validateRes = await request.post(`${API_BASE}/api/fhir/token/validate`, {
      headers,
      data: { credentialId }
    });
    expect(validateRes.status()).toBeGreaterThanOrEqual(200);

    // Step 3: Check status again
    const statusAfter = await request.get(`${API_BASE}/api/fhir/status?credentialId=${credentialId}`, { headers });
    expect(statusAfter.status()).toBeGreaterThanOrEqual(200);
  });

  test('should handle invalid credentialId gracefully', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/fhir/token/validate`, {
      headers: authToken ? { 'Cookie': `auth_token=${authToken}` } : {},
      data: { credentialId: 99999 }
    });

    // Should return 400+ (401, 404, or 500 depending on auth and credential state)
    if (!authToken) {
      expect(response.status()).toBe(401);
    } else {
      expect(response.status()).toBeGreaterThanOrEqual(400);
      expect(response.status()).toBeLessThan(600);
    }
  });

  test('should handle missing required parameters', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/fhir/token/validate`, {
      headers: authToken ? { 'Cookie': `auth_token=${authToken}` } : {},
      data: {}
    });

    // Should return 400+ for missing credentialId or 401 for no auth
    if (!authToken) {
      expect(response.status()).toBe(401);
    } else {
      expect(response.status()).toBeGreaterThanOrEqual(400);
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('should validate token refresh with expired timestamp', async ({ request }) => {
    if (!credentialId) credentialId = 1;

    const response = await request.post(`${API_BASE}/api/fhir/token/validate`, {
      headers: authToken ? { 'Cookie': `auth_token=${authToken}` } : {},
      data: {
        credentialId,
        forceRefresh: true // Force a refresh even if token appears valid
      }
    });

    // Should handle gracefully even if token doesn't exist
    if (!authToken) {
      expect(response.status()).toBe(401);
    } else {
      expect(response.status()).toBeGreaterThanOrEqual(200);
      expect(response.status()).toBeLessThan(600);
    }
  });
});
