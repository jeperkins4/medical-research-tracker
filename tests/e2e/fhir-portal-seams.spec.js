/**
 * FHIR + Portal Sync seam contracts
 *
 * Focuses on integration seams that are easy to regress while iterating on:
 *   - login/auth cookie issuance for protected FHIR endpoints
 *   - callback precedence when OAuth error and code/state both appear
 *   - status message contracts for valid / expired / unauthorized tokens
 *   - refresh error response shape for requires-auth cases
 *   - portal sync error/ingestion contracts for missing creds and auth guards
 *
 * These tests intentionally complement the larger FHIR/portal suites without
 * duplicating their entire matrix.
 */

import { test, expect } from '@playwright/test';

const API = `http://localhost:${process.env.TEST_API_PORT || process.env.TEST_PORT || 3999}`;

const EPIC_NO_REFRESH = 94;
const GENERIC = 95;

async function login(request, username = 'testuser', password = 'testpass123') {
  return request.post(`${API}/api/auth/login`, {
    data: { username, password },
  });
}

async function authCookie(request) {
  const res = await login(request);
  expect(res.status()).toBe(200);
  return (res.headers()['set-cookie'] || '').split(';')[0];
}

test.describe('auth/login seam', () => {
  test('successful login issues a cookie that unlocks protected FHIR config-check', async ({ request }) => {
    const res = await login(request);
    expect(res.status()).toBe(200);

    const setCookie = res.headers()['set-cookie'] || '';
    expect(setCookie).toContain('auth_token=');

    const cookie = setCookie.split(';')[0];
    const cfg = await request.get(`${API}/api/fhir/config-check`, {
      headers: { Cookie: cookie },
    });

    expect(cfg.status()).toBe(200);
    const body = await cfg.json();
    expect(typeof body.configured).toBe('boolean');
  });

  test('failed login does not mint a session cookie', async ({ request }) => {
    const res = await login(request, 'testuser', 'definitely-wrong-password');
    expect(res.status()).toBe(401);
    expect(res.headers()['set-cookie'] || '').toBe('');
  });
});

test.describe('FHIR callback seam', () => {
  test('oauth error takes precedence over code/state and redirects with error', async ({ request }) => {
    const res = await request.get(
      `${API}/api/fhir/callback?code=looks-valid&state=looks-valid&error=access_denied&error_description=Patient%20cancelled`,
      { maxRedirects: 0 }
    );

    expect(res.status()).toBe(302);
    const location = res.headers().location || '';
    expect(location).toContain('/?error=');
    expect(decodeURIComponent(location)).toContain('Patient cancelled');
    expect(location).not.toContain('fhir_success=true');
  });

  test('missing state returns JSON 400 instead of redirect', async ({ request }) => {
    const res = await request.get(`${API}/api/fhir/callback?code=only-code`, {
      maxRedirects: 0,
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/missing required parameters/i);
  });
});

test.describe('FHIR status seam', () => {
  test('credential with no token row returns not-authorized CTA message', async ({ request }) => {
    const cookie = await authCookie(request);
    const res = await request.get(`${API}/api/fhir/status/${GENERIC}`, {
      headers: { Cookie: cookie },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.authorized).toBe(false);
    expect(body.message).toMatch(/connect epic mychart/i);
  });

  test('unauthorized status response does not include patientId/scope token metadata', async ({ request }) => {
    const cookie = await authCookie(request);
    const res = await request.get(`${API}/api/fhir/status/${GENERIC}`, {
      headers: { Cookie: cookie },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.authorized).toBe(false);
    expect(body).not.toHaveProperty('patientId');
    expect(body).not.toHaveProperty('scope');
    expect(body).not.toHaveProperty('expiresAt');
  });
});

test.describe('FHIR refresh seam', () => {
  test('missing refresh token returns structured requiresAuth response without token fields', async ({ request }) => {
    const cookie = await authCookie(request);
    const res = await request.post(`${API}/api/fhir/refresh/${EPIC_NO_REFRESH}`, {
      headers: { Cookie: cookie },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.requiresAuth).toBe(true);
    expect(typeof body.error).toBe('string');
    expect(body).not.toHaveProperty('access_token');
    expect(body).not.toHaveProperty('refresh_token');
    expect(body).not.toHaveProperty('patientId');
  });

  test('invalid credential ids are rejected consistently across status, sync, refresh, and revoke routes', async ({ request }) => {
    const cookie = await authCookie(request);
    const calls = [
      () => request.get(`${API}/api/fhir/status/not-a-number`, { headers: { Cookie: cookie } }),
      () => request.post(`${API}/api/fhir/sync/not-a-number`, { headers: { Cookie: cookie } }),
      () => request.post(`${API}/api/fhir/refresh/not-a-number`, { headers: { Cookie: cookie } }),
      () => request.delete(`${API}/api/fhir/revoke/not-a-number`, { headers: { Cookie: cookie } }),
    ];

    for (const call of calls) {
      const res = await call();
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/invalid credential id/i);
    }
  });
});

test.describe('portal sync seam', () => {
  test('portal sync with invalid credential id returns 400 JSON', async ({ request }) => {
    const cookie = await authCookie(request);
    const res = await request.post(`${API}/api/portals/credentials/not-a-number/sync`, {
      headers: { Cookie: cookie },
    });

    expect(res.status()).toBe(400);
    const ct = res.headers()['content-type'] || '';
    expect(ct).toMatch(/json/i);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
    expect(body.error).toMatch(/invalid credential id/i);
  });

  test('portal sync without auth is rejected with 401 JSON', async ({ request }) => {
    const res = await request.post(`${API}/api/portals/credentials/${GENERIC}/sync`);
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });
});
