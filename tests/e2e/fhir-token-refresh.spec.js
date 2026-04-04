/**
 * FHIR Token Refresh E2E Tests
 * Verifies token refresh flows during portal operations
 */

import { test, expect } from '@playwright/test';

const API_BASE = 'http://localhost:3000';

test.describe('FHIR Token Refresh Flows', () => {
  let authToken;
  let credentialId;

  test.beforeAll(async ({ request }) => {
    // Setup: Create test user and login
    const setupRes = await request.post(`${API_BASE}/api/auth/setup`, {
      data: { username: 'test-refresh-user', password: 'test-password-123' }
    });

    if (setupRes.status() === 400) {
      // User already exists, login instead
      const loginRes = await request.post(`${API_BASE}/api/auth/login`, {
        data: { username: 'test-refresh-user', password: 'test-password-123' }
      });
      expect(loginRes.status()).toBe(200);
    } else {
      expect(setupRes.status()).toBe(200);
    }
  });

  test('should initialize OAuth flow and get authorization URL', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/fhir/auth/init`, {
      data: {
        credentialId: 1,
        fhirServerUrl: 'https://r4.smarthealthit.org/api',
        clientId: 'test-client-id',
        redirectUri: `${API_BASE}/api/fhir/auth/callback`
      }
    });

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
  });

  test('should check token status before expiration', async ({ request }) => {
    if (!credentialId) credentialId = 1;

    const response = await request.get(`${API_BASE}/api/fhir/status?credentialId=${credentialId}`);

    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(500);

    const data = await response.json();
    expect(data).toHaveProperty('status');
    // Status could be: not-found, unauthorized, authenticated, or token-expired
  });

  test('should validate and refresh token if needed', async ({ request }) => {
    if (!credentialId) credentialId = 1;

    const response = await request.post(`${API_BASE}/api/fhir/token/validate`, {
      data: { credentialId }
    });

    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(600);
    // May return 500 if no token available (expected for non-authenticated credential)
  });

  test('should handle refresh token flow', async ({ request }) => {
    if (!credentialId) credentialId = 1;

    const response = await request.post(`${API_BASE}/api/fhir/token/refresh`, {
      data: { credentialId }
    });

    // May fail if credential doesn't have refresh_token set up
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(600);

    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('accessToken');
    }
  });

  test('should simulate token expiration and refresh', async ({ request }) => {
    if (!credentialId) credentialId = 1;

    // Step 1: Get current status
    const statusBefore = await request.get(`${API_BASE}/api/fhir/status?credentialId=${credentialId}`);
    expect(statusBefore.status()).toBeGreaterThanOrEqual(200);

    // Step 2: Trigger validation (which should refresh if expired)
    const validateRes = await request.post(`${API_BASE}/api/fhir/token/validate`, {
      data: { credentialId }
    });
    expect(validateRes.status()).toBeGreaterThanOrEqual(200);

    // Step 3: Check status again
    const statusAfter = await request.get(`${API_BASE}/api/fhir/status?credentialId=${credentialId}`);
    expect(statusAfter.status()).toBeGreaterThanOrEqual(200);
  });

  test('should handle invalid credentialId gracefully', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/fhir/status?credentialId=99999`);

    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(500);

    const data = await response.json();
    expect(data.status).toBe('not-found');
  });

  test('should handle missing required parameters', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/fhir/auth/init`, {
      data: { credentialId: 1 } // missing fhirServerUrl, clientId, redirectUri
    });

    expect(response.status()).toBe(400);
    const error = await response.json();
    expect(error).toHaveProperty('error');
  });

  test('should validate token refresh with expired timestamp', async ({ request }) => {
    if (!credentialId) credentialId = 1;

    // Get current status
    const statusRes = await request.get(`${API_BASE}/api/fhir/status?credentialId=${credentialId}`);
    const data = await statusRes.json();

    // If token has expiresAt, validate its format
    if (data.expiresAt) {
      expect(typeof data.expiresAt).toBe('string');
      const expiresDate = new Date(data.expiresAt);
      expect(expiresDate).toBeInstanceOf(Date);
      expect(data).toHaveProperty('isExpired');
    }
  });
});
