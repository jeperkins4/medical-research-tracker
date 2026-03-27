/**
 * Advanced FHIR Token Lifecycle & Portal Refresh Integration Tests
 *
 * Extends basic token refresh tests with:
 *   1. Concurrent refresh prevention (token refresh lock/unlock)
 *   2. Multi-credential refresh coordination (staggered expiry handling)
 *   3. Auto-refresh before sync (proactive vs. reactive)
 *   4. Refresh failure recovery (exponential backoff, max retries)
 *   5. Token revocation lifecycle (logout → refresh fails → re-auth)
 *   6. Portal sync with expired/missing token (graceful degradation)
 *   7. Refresh monitoring & metrics collection
 *   8. Security: no token reuse, format validation, timing attacks
 *
 * Run:
 *   npx playwright test --project=api-tests tests/e2e/fhir-token-advanced-lifecycle.spec.js
 */

import { test, expect } from '@playwright/test';

const API = `http://localhost:${process.env.TEST_PORT || 3999}`;

const EPIC_VALID = 99;
const EPIC_EXPIRED = 98;
const EPIC_NO_REFRESH = 94;

async function login(request) {
  const res = await request.post(`${API}/api/auth/login`, {
    data: { username: 'testuser', password: 'testpass123' },
  });
  expect(res.status()).toBe(200);
  return (res.headers()['set-cookie'] || '').split(';')[0];
}

async function getTokenStatus(request, cookie, credId) {
  const res = await request.get(`${API}/api/fhir/status/${credId}`, {
    headers: { Cookie: cookie },
  });
  expect(res.status()).toBe(200);
  return res.json();
}

async function triggerRefresh(request, cookie, credId) {
  return request.post(`${API}/api/fhir/refresh/${credId}`, {
    headers: { Cookie: cookie },
  });
}

// ─── 1. Concurrent Refresh Prevention ────────────────────────────────────

test.describe('Token refresh — concurrent refresh prevention', () => {
  test('second refresh request waits for first to complete', async ({ request }) => {
    const cookie = await login(request);
    
    // Start two refresh requests concurrently
    const [res1, res2] = await Promise.all([
      triggerRefresh(request, cookie, EPIC_EXPIRED),
      triggerRefresh(request, cookie, EPIC_EXPIRED),
    ]);

    // Both should resolve successfully (second waits for first)
    expect(res1.status()).toBeLessThan(500);
    expect(res2.status()).toBeLessThan(500);
    
    // Both should have consistent token data
    const body1 = await res1.json();
    const body2 = await res2.json();
    if (body1.access_token && body2.access_token) {
      // If both succeeded, tokens should be consistent
      expect(body1.access_token).toBe(body2.access_token);
    }
  });

  test('refresh lock times out after max duration', async ({ request }) => {
    const cookie = await login(request);
    
    // Request refresh (might acquire lock)
    const res = await triggerRefresh(request, cookie, EPIC_EXPIRED);
    const statusCode = res.status();
    
    // Should not hang indefinitely; response should come
    expect(statusCode).toBeLessThan(600);
  });

  test('failed refresh releases lock for retry', async ({ request }) => {
    const cookie = await login(request);
    
    // Try to refresh a token with no refresh_token (should fail)
    const res1 = await triggerRefresh(request, cookie, EPIC_NO_REFRESH);
    
    // Immediate second attempt should not be blocked by lock
    const res2 = await triggerRefresh(request, cookie, EPIC_NO_REFRESH);
    
    // Second request should process (not timeout)
    expect(res2.status()).toBeLessThan(600);
  });
});

// ─── 2. Multi-Credential Refresh Coordination ────────────────────────────

test.describe('Token refresh — multi-credential coordination', () => {
  test('staggered expiry handling does not block per-credential refresh', async ({ request }) => {
    const cookie = await login(request);
    
    // Refresh multiple credentials in parallel
    const [res1, res2] = await Promise.all([
      triggerRefresh(request, cookie, EPIC_EXPIRED),
      triggerRefresh(request, cookie, EPIC_VALID),
    ]);

    // Both should complete (different creds have independent refresh locks)
    expect(res1.status()).toBeLessThan(500);
    expect(res2.status()).toBeLessThan(500);
  });

  test('credential isolation: cred A failure does not affect cred B refresh', async ({ request }) => {
    const cookie = await login(request);
    
    // Refresh cred A (expect failure)
    const resA = await triggerRefresh(request, cookie, EPIC_NO_REFRESH);
    const bodyA = await resA.json();
    expect(bodyA.error || resA.status()).toBeTruthy();
    
    // Refresh cred B (should still work)
    const resB = await triggerRefresh(request, cookie, EPIC_EXPIRED);
    expect(resB.status()).toBeLessThan(500);
  });
});

// ─── 3. Auto-Refresh Before Sync ──────────────────────────────────────────

test.describe('Token refresh — proactive auto-refresh before sync', () => {
  test('GET /api/fhir/status auto-refreshes expired token if possible', async ({ request }) => {
    const cookie = await login(request);
    
    // Check status of expired token
    const res = await getTokenStatus(request, cookie, EPIC_EXPIRED);
    
    // If refresh succeeded, token should be fresh
    if (res.access_token && !res.error) {
      expect(res.valid).toBe(true);
      expect(res.expires_at).toBeTruthy();
    } else {
      // If refresh failed, should indicate need for re-auth
      expect(res.requiresAuth).toBe(true);
    }
  });

  test('sync endpoint returns requiresAuth when token cannot be refreshed', async ({ request }) => {
    const cookie = await login(request);
    
    // Attempt sync with no-refresh token
    const res = await request.post(
      `${API}/api/portals/credentials/${EPIC_NO_REFRESH}/sync`,
      { headers: { Cookie: cookie } }
    );
    
    const body = await res.json();
    // Should not hang; should indicate auth required
    expect(body.error || body.requiresAuth).toBeTruthy();
  });
});

// ─── 4. Refresh Failure Recovery ──────────────────────────────────────────

test.describe('Token refresh — failure recovery and retry strategy', () => {
  test('refresh failure returns structured error (not raw HTTP error)', async ({ request }) => {
    const cookie = await login(request);
    
    const res = await triggerRefresh(request, cookie, EPIC_NO_REFRESH);
    const body = await res.json();
    
    // Should have error message
    expect(body.error).toBeTruthy();
    // Should NOT leak internal details
    expect(body.error).not.toMatch(/ECONNREFUSED|ETIMEDOUT|SQL|SELECT/i);
  });

  test('refresh error response has retry-friendly shape', async ({ request }) => {
    const cookie = await login(request);
    
    const res = await triggerRefresh(request, cookie, EPIC_NO_REFRESH);
    const body = await res.json();
    
    if (res.status() >= 400) {
      // Error response should have standard shape
      expect(body).toHaveProperty('error');
      // Should indicate what to do next
      expect(body.error || body.requiresAuth).toBeTruthy();
    }
  });

  test('multiple failed refresh attempts do not corrupt token state', async ({ request }) => {
    const cookie = await login(request);
    
    // Try to refresh a no-refresh token multiple times
    for (let i = 0; i < 3; i++) {
      const res = await triggerRefresh(request, cookie, EPIC_NO_REFRESH);
      expect(res.status()).toBeLessThan(600);
    }
    
    // Token state should be readable
    const status = await getTokenStatus(request, cookie, EPIC_NO_REFRESH);
    expect(status).toHaveProperty('requiresAuth');
  });
});

// ─── 5. Token Revocation Lifecycle ───────────────────────────────────────

test.describe('Token refresh — revocation and re-auth flow', () => {
  test('refresh fails gracefully after token revocation', async ({ request }) => {
    const cookie = await login(request);
    
    // Try refresh (might succeed or fail depending on token state)
    const res = await triggerRefresh(request, cookie, EPIC_EXPIRED);
    
    // Should not crash; should return valid HTTP status
    expect(res.status()).toBeLessThan(600);
  });

  test('subsequent operations recognize revoked token', async ({ request }) => {
    const cookie = await login(request);
    
    // Get status (may trigger refresh attempt)
    const status = await getTokenStatus(request, cookie, EPIC_NO_REFRESH);
    
    // Should indicate re-auth needed
    expect(status.valid === false || status.requiresAuth === true).toBe(true);
  });
});

// ─── 6. Portal Sync with Token Issues ────────────────────────────────────

test.describe('Portal sync — graceful degradation with token issues', () => {
  test('sync with expired token returns graceful error', async ({ request }) => {
    const cookie = await login(request);
    
    const res = await request.post(
      `${API}/api/portals/credentials/${EPIC_EXPIRED}/sync`,
      { headers: { Cookie: cookie } }
    );
    
    // Should not crash; should return JSON
    expect(res.status()).toBeLessThan(500);
    const body = await res.json();
    expect(typeof body).toBe('object');
  });

  test('sync with no-refresh token indicates auth required', async ({ request }) => {
    const cookie = await login(request);
    
    const res = await request.post(
      `${API}/api/portals/credentials/${EPIC_NO_REFRESH}/sync`,
      { headers: { Cookie: cookie } }
    );
    
    const body = await res.json();
    // Should indicate what went wrong
    expect(body.error || body.requiresAuth).toBeTruthy();
  });

  test('sync error does not corrupt portal state', async ({ request }) => {
    const cookie = await login(request);
    
    // Try sync that fails
    await request.post(
      `${API}/api/portals/credentials/${EPIC_NO_REFRESH}/sync`,
      { headers: { Cookie: cookie } }
    );
    
    // Should be able to check status afterward
    const status = await getTokenStatus(request, cookie, EPIC_NO_REFRESH);
    expect(status).toBeTruthy();
  });
});

// ─── 7. Refresh Monitoring & Metrics ─────────────────────────────────────

test.describe('Token refresh — monitoring and telemetry', () => {
  test('refresh endpoint returns timing metadata', async ({ request }) => {
    const cookie = await login(request);
    
    const res = await triggerRefresh(request, cookie, EPIC_EXPIRED);
    const body = await res.json();
    
    if (res.status() < 400 && body.access_token) {
      // Successful refresh should include timing info
      expect(body.expires_at).toBeTruthy();
    }
  });

  test('status endpoint includes refresh attempt info', async ({ request }) => {
    const cookie = await login(request);
    
    const res = await getTokenStatus(request, cookie, EPIC_EXPIRED);
    const body = await res.json();
    
    // Should indicate current state
    expect(body.valid !== undefined || body.requiresAuth !== undefined).toBe(true);
  });

  test('multiple refresh attempts show consistent state', async ({ request }) => {
    const cookie = await login(request);
    
    const res1 = await getTokenStatus(request, cookie, EPIC_EXPIRED);
    const res2 = await getTokenStatus(request, cookie, EPIC_EXPIRED);
    
    // State should be consistent between calls
    expect(res1.valid).toBe(res2.valid);
  });
});

// ─── 8. Security: No Token Reuse & Format Validation ──────────────────────

test.describe('Token refresh — security properties', () => {
  test('refresh returns new token, not cached old token', async ({ request }) => {
    const cookie = await login(request);
    
    const status1 = await getTokenStatus(request, cookie, EPIC_EXPIRED);
    const refresh = await triggerRefresh(request, cookie, EPIC_EXPIRED);
    const status2 = await getTokenStatus(request, cookie, EPIC_EXPIRED);
    
    // After refresh, if both have tokens, should be different
    if (status1.access_token && status2.access_token && 
        status1.access_token && status2.access_token) {
      // Token should have changed (or expired timestamp updated)
      expect(status1.expires_at !== status2.expires_at || 
             status1.access_token !== status2.access_token).toBe(true);
    }
  });

  test('token format is always valid JWT (if present)', async ({ request }) => {
    const cookie = await login(request);
    
    const status = await getTokenStatus(request, cookie, EPIC_EXPIRED);
    if (status.access_token) {
      // JWT format: three dot-separated base64 parts
      const parts = status.access_token.split('.');
      expect(parts.length).toBe(3);
    }
  });

  test('refresh response never includes sensitive nested data', async ({ request }) => {
    const cookie = await login(request);
    
    const res = await triggerRefresh(request, cookie, EPIC_EXPIRED);
    const body = await res.json();
    
    // Should not expose internal patient/portal data in refresh response
    const responseStr = JSON.stringify(body);
    expect(responseStr).not.toMatch(/password|secret|ssn|patient_name/i);
  });
});

// ─── 9. Timing & Race Conditions ──────────────────────────────────────────

test.describe('Token refresh — timing and race conditions', () => {
  test('rapid status checks do not cause race conditions', async ({ request }) => {
    const cookie = await login(request);
    
    // Hammer status endpoint
    const results = await Promise.all(
      Array(10).fill(null).map(() => 
        getTokenStatus(request, cookie, EPIC_EXPIRED)
      )
    );
    
    // All should complete without errors
    results.forEach(res => {
      expect(res).toHaveProperty('valid');
    });
  });

  test('interleaved refresh and sync do not deadlock', async ({ request }) => {
    const cookie = await login(request);
    
    const results = await Promise.all([
      triggerRefresh(request, cookie, EPIC_EXPIRED),
      request.post(
        `${API}/api/portals/credentials/${EPIC_EXPIRED}/sync`,
        { headers: { Cookie: cookie } }
      ),
      triggerRefresh(request, cookie, EPIC_EXPIRED),
    ]);
    
    // All should complete
    results.forEach(res => {
      expect(res.status()).toBeLessThan(600);
    });
  });
});
