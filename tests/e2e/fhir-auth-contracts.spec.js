/**
 * Focused FHIR Auth / Callback / Status contracts
 *
 * Complements the broader fhir.spec.js suite with isolated coverage for:
 *   1. config-check shape + auth guard
 *   2. authorize JSON mode contracts
 *   3. callback error / missing-param handling
 *   4. status route error and no-token contracts
 *
 * Seeded credentials from global-setup:
 *   id=99  epic + valid token
 *   id=98  epic + expired token
 *   id=95  generic portal, no FHIR token
 */

import { test, expect } from '@playwright/test';

const API = `http://localhost:${process.env.TEST_API_PORT || '3999'}`;
const EPIC_VALID = 99;
const GENERIC_NO_TOKEN = 95;

async function login(request) {
  const res = await request.post(`${API}/api/auth/login`, {
    data: { username: 'testuser', password: 'testpass123' },
  });
  expect(res.status(), 'login must succeed').toBe(200);
  return (res.headers()['set-cookie'] || '').split(';')[0];
}

test.describe('GET /api/fhir/config-check', () => {
  test('returns 401 without auth cookie', async ({ request }) => {
    const res = await request.get(`${API}/api/fhir/config-check`);
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('returns safe troubleshooting shape when authenticated', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/fhir/config-check`, {
      headers: { Cookie: cookie },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.configured).toBe('boolean');
    expect(typeof body.hasClientId).toBe('boolean');
    expect(typeof body.hasAppBaseUrl).toBe('boolean');
    expect(typeof body.callbackUrl).toBe('string');
    expect(body.callbackUrl).toContain('/api/fhir/callback');
    expect(body).not.toHaveProperty('clientSecret');
  });
});

test.describe('GET /api/fhir/authorize/:credentialId', () => {
  test('JSON mode returns either authUrl success shape or structured config error', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/fhir/authorize/${EPIC_VALID}?mode=json`, {
      headers: { Cookie: cookie },
    });

    expect([200, 500]).toContain(res.status());
    const body = await res.json();

    if (res.status() === 200) {
      expect(body.credentialId).toBe(EPIC_VALID);
      expect(typeof body.authUrl).toBe('string');
      expect(body.authUrl).toMatch(/^https?:\/\//i);
      expect(body.authUrl).toContain('state=');
    } else {
      expect(body.error).toBeTruthy();
      expect(typeof body.hint).toBe('string');
      expect(body.hint).toMatch(/EPIC_CLIENT_ID|APP_BASE_URL/i);
    }
  });

  test('invalid credential id returns 400 with error string', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/fhir/authorize/not-a-number?mode=json`, {
      headers: { Cookie: cookie },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid credential id/i);
  });
});

test.describe('GET /api/fhir/callback', () => {
  test('missing code + state returns 400 JSON error', async ({ request }) => {
    const res = await request.get(`${API}/api/fhir/callback`);
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/missing required parameters/i);
  });

  test('missing state returns 400 JSON error', async ({ request }) => {
    const res = await request.get(`${API}/api/fhir/callback?code=test-code-only`);
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/missing required parameters/i);
  });

  test('oauth error query redirects back to app with error message', async ({ request }) => {
    const res = await request.get(
      `${API}/api/fhir/callback?error=access_denied&error_description=Patient%20cancelled`,
      { maxRedirects: 0 }
    );

    expect(res.status()).toBe(302);
    const location = res.headers().location || '';
    expect(location).toContain('/?error=');
    expect(decodeURIComponent(location)).toContain('Patient cancelled');
  });
});

test.describe('GET /api/fhir/status/:credentialId', () => {
  test('invalid credential id returns 400', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/fhir/status/not-a-number`, {
      headers: { Cookie: cookie },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid credential id/i);
  });

  test('credential with no token row returns authorized:false contract', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/fhir/status/${GENERIC_NO_TOKEN}`, {
      headers: { Cookie: cookie },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.authorized).toBe(false);
    expect(typeof body.message).toBe('string');
    expect(body).not.toHaveProperty('access_token');
    expect(body).not.toHaveProperty('refresh_token');
  });

  test('valid token status response never leaks token material', async ({ request }) => {
    const cookie = await login(request);
    const res = await request.get(`${API}/api/fhir/status/${EPIC_VALID}`, {
      headers: { Cookie: cookie },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.authorized).toBe(true);
    expect(body).not.toHaveProperty('access_token');
    expect(body).not.toHaveProperty('refresh_token');
    expect(body).not.toHaveProperty('token_type');
  });
});
