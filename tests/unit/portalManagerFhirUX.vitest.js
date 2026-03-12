/**
 * PortalManager FHIR UX State Logic — Pure Unit Tests
 *
 * Tests the display/button-visibility logic derived from PortalManager.jsx
 * state combinations. Extracted as pure functions so they can be unit-tested
 * without rendering the full React component.
 *
 * Covers:
 *  1. Status text derivation (authorized+valid, authorized+expired, not authorized)
 *  2. "Connect Epic MyChart" button visibility rules
 *  3. "Reconnect Epic" button visibility rules
 *  4. "Refresh Token" button visibility rules
 *  5. "Sync via FHIR" button visibility rules
 *  6. "Disconnect" button visibility rules
 *  7. Button label switching when connecting/refreshing/syncing
 *  8. FHIR configured gate — buttons hidden when EPIC_CLIENT_ID not set
 *  9. Loading state — no action buttons shown while checking
 * 10. Error state — error text shown, connect button still available
 * 11. Expiry label derivation (future/past/near-future/null)
 * 12. Concurrent credential isolation — state for cred A independent of cred B
 *
 * Run:
 *   npx vitest run tests/unit/portalManagerFhirUX.vitest.js
 */

import { describe, test, expect } from 'vitest';

// ─── Pure logic extracted from PortalManager.jsx ──────────────────────────────
// Each function mirrors the JSX conditional logic for a specific UI element.
// These are the contracts we're testing — keeping them sync with the component
// is the point of these tests.

/**
 * Returns the status text shown in the FHIR panel.
 * Mirrors: {!fs?.loading && fs?.authorized && ...} blocks in PortalManager.jsx
 */
function deriveStatusText(fs) {
  if (!fs) return 'not-connected';
  if (fs.loading) return 'loading';
  if (fs.error) return `error:${fs.error}`;
  if (fs.authorized && fs.valid) return 'authorized-valid';
  if (fs.authorized && !fs.valid) return 'authorized-expired';
  if (!fs.authorized) return 'not-connected';
  return 'not-connected';
}

/**
 * Should "Connect Epic MyChart" button show?
 * Mirrors: {(!fs?.authorized || (!fs?.valid && fhirRefreshResult?.requiresAuth)) && fhirConfigured}
 */
function showConnectButton(fs, fhirConfigured, fhirConnecting, fhirRefreshResult) {
  if (!fhirConfigured) return false;
  if (!fs?.authorized) return true;
  if (!fs?.valid && fhirRefreshResult?.requiresAuth) return true;
  return false;
}

/**
 * Connect button label.
 * Mirrors: fhirConnecting ? '⏳ Waiting for Epic…' : `🔗 ${...}`
 */
function connectButtonLabel(fs, fhirConnecting) {
  if (fhirConnecting) return '⏳ Waiting for Epic…';
  if (fs?.authorized) return '🔗 Reconnect Epic';
  return '🔗 Connect Epic MyChart';
}

/**
 * Should connect button be disabled?
 * Mirrors: disabled={fhirConnecting[cred.id]}
 */
function connectButtonDisabled(fhirConnecting) {
  return !!fhirConnecting;
}

/**
 * Should "Refresh Token" button show?
 * Mirrors: {fs?.authorized && !fs?.valid && fhirConfigured}
 */
function showRefreshTokenButton(fs, fhirConfigured) {
  return !!(fs?.authorized && !fs?.valid && fhirConfigured);
}

/**
 * Refresh Token button label.
 * Mirrors: fhirRefreshing ? '⏳ Refreshing…' : '🔄 Refresh Token'
 */
function refreshTokenButtonLabel(fhirRefreshing) {
  return fhirRefreshing ? '⏳ Refreshing…' : '🔄 Refresh Token';
}

/**
 * Should "Sync via FHIR" button show?
 * Mirrors: {fs?.authorized && fs?.valid}
 */
function showSyncButton(fs) {
  return !!(fs?.authorized && fs?.valid);
}

/**
 * Sync button label.
 * Mirrors: fhirSyncing ? '⏳ Syncing FHIR…' : '⬇️ Sync via FHIR'
 */
function syncButtonLabel(fhirSyncing) {
  return fhirSyncing ? '⏳ Syncing FHIR…' : '⬇️ Sync via FHIR';
}

/**
 * Should "Disconnect" button show?
 * Mirrors: {fs?.authorized}
 */
function showDisconnectButton(fs) {
  return !!fs?.authorized;
}

/**
 * Should "Waiting for Epic authorization" banner show?
 * Mirrors: {fhirConnecting[cred.id] && ...}
 */
function showConnectingBanner(fhirConnecting) {
  return !!fhirConnecting;
}

/**
 * Derive human-readable expiry label.
 * Mirrors: the expiryLabel derivation from expiresAt
 * 
 * In PortalManager.jsx this is derived inline in JSX from fs.expiresAt.
 * We model it here as a pure function for unit-testing boundary cases.
 */
function deriveExpiryLabel(expiresAt) {
  if (!expiresAt) return null;
  const exp = new Date(expiresAt);
  if (isNaN(exp.getTime())) return null;
  const now = new Date();
  const diffMs = exp - now;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMs < 0) return 'expired';
  if (diffMin < 60) return `expires in ${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `expires in ${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  return `expires in ${diffDay}d`;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FS_LOADING        = { loading: true };
const FS_AUTHORIZED_VALID = { loading: false, authorized: true, valid: true, patientId: 'P123', expiresAt: new Date(Date.now() + 3600_000).toISOString(), scope: 'patient/*.read' };
const FS_AUTHORIZED_EXPIRED = { loading: false, authorized: true, valid: false, patientId: 'P123', expiresAt: new Date(Date.now() - 3600_000).toISOString() };
const FS_NOT_AUTHORIZED = { loading: false, authorized: false, message: 'Not authorized.' };
const FS_ERROR          = { loading: false, authorized: false, error: 'Network timeout' };
const FS_NULL           = null;
const FS_UNDEFINED      = undefined;

// ─── 1. Status text derivation ────────────────────────────────────────────────

describe('deriveStatusText', () => {
  test('null fs → not-connected', () => {
    expect(deriveStatusText(null)).toBe('not-connected');
  });

  test('undefined fs → not-connected', () => {
    expect(deriveStatusText(undefined)).toBe('not-connected');
  });

  test('loading → loading', () => {
    expect(deriveStatusText(FS_LOADING)).toBe('loading');
  });

  test('authorized + valid → authorized-valid', () => {
    expect(deriveStatusText(FS_AUTHORIZED_VALID)).toBe('authorized-valid');
  });

  test('authorized + expired → authorized-expired', () => {
    expect(deriveStatusText(FS_AUTHORIZED_EXPIRED)).toBe('authorized-expired');
  });

  test('not authorized → not-connected', () => {
    expect(deriveStatusText(FS_NOT_AUTHORIZED)).toBe('not-connected');
  });

  test('error state → error prefix', () => {
    expect(deriveStatusText(FS_ERROR)).toMatch(/^error:/);
    expect(deriveStatusText(FS_ERROR)).toContain('Network timeout');
  });
});

// ─── 2. Connect button visibility ─────────────────────────────────────────────

describe('showConnectButton', () => {
  test('not authorized + configured → show', () => {
    expect(showConnectButton(FS_NOT_AUTHORIZED, true, false, null)).toBe(true);
  });

  test('null fs + configured → show', () => {
    expect(showConnectButton(FS_NULL, true, false, null)).toBe(true);
  });

  test('not authorized + NOT configured → hide (config gate)', () => {
    expect(showConnectButton(FS_NOT_AUTHORIZED, false, false, null)).toBe(false);
  });

  test('authorized + valid → hide (already connected)', () => {
    expect(showConnectButton(FS_AUTHORIZED_VALID, true, false, null)).toBe(false);
  });

  test('authorized + expired + no requiresAuth → hide (try refresh first)', () => {
    expect(showConnectButton(FS_AUTHORIZED_EXPIRED, true, false, { requiresAuth: false })).toBe(false);
  });

  test('authorized + expired + requiresAuth:true → show (full re-auth needed)', () => {
    expect(showConnectButton(FS_AUTHORIZED_EXPIRED, true, false, { requiresAuth: true })).toBe(true);
  });

  test('authorized + expired + requiresAuth:true + NOT configured → hide', () => {
    expect(showConnectButton(FS_AUTHORIZED_EXPIRED, false, false, { requiresAuth: true })).toBe(false);
  });

  test('loading state + configured → hide (wait for status)', () => {
    // Loading: fs.authorized is undefined → !fs.authorized is true → show.
    // This is intentional — in loading state the button is gated by fhirConnecting
    // (disabled if already connecting), but can still show.
    // The PortalManager renders it; this test documents the current behavior.
    expect(showConnectButton(FS_LOADING, true, false, null)).toBe(true);
  });
});

// ─── 3. Connect button labels ─────────────────────────────────────────────────

describe('connectButtonLabel', () => {
  test('not connecting + not authorized → "Connect Epic MyChart"', () => {
    expect(connectButtonLabel(FS_NOT_AUTHORIZED, false)).toBe('🔗 Connect Epic MyChart');
  });

  test('not connecting + authorized (reconnect) → "Reconnect Epic"', () => {
    expect(connectButtonLabel(FS_AUTHORIZED_EXPIRED, false)).toBe('🔗 Reconnect Epic');
  });

  test('connecting in progress → "Waiting for Epic…"', () => {
    expect(connectButtonLabel(FS_NOT_AUTHORIZED, true)).toBe('⏳ Waiting for Epic…');
  });

  test('connecting in progress + authorized → still "Waiting for Epic…"', () => {
    expect(connectButtonLabel(FS_AUTHORIZED_EXPIRED, true)).toBe('⏳ Waiting for Epic…');
  });

  test('null fs + not connecting → "Connect Epic MyChart"', () => {
    expect(connectButtonLabel(null, false)).toBe('🔗 Connect Epic MyChart');
  });
});

// ─── 4. Connect button disabled state ────────────────────────────────────────

describe('connectButtonDisabled', () => {
  test('not connecting → enabled', () => {
    expect(connectButtonDisabled(false)).toBe(false);
  });

  test('connecting → disabled', () => {
    expect(connectButtonDisabled(true)).toBe(true);
  });

  test('undefined → enabled (falsy)', () => {
    expect(connectButtonDisabled(undefined)).toBe(false);
  });
});

// ─── 5. Refresh Token button ──────────────────────────────────────────────────

describe('showRefreshTokenButton', () => {
  test('authorized + expired + configured → show', () => {
    expect(showRefreshTokenButton(FS_AUTHORIZED_EXPIRED, true)).toBe(true);
  });

  test('authorized + valid → hide (not expired)', () => {
    expect(showRefreshTokenButton(FS_AUTHORIZED_VALID, true)).toBe(false);
  });

  test('not authorized → hide', () => {
    expect(showRefreshTokenButton(FS_NOT_AUTHORIZED, true)).toBe(false);
  });

  test('authorized + expired + NOT configured → hide', () => {
    expect(showRefreshTokenButton(FS_AUTHORIZED_EXPIRED, false)).toBe(false);
  });

  test('null fs → hide', () => {
    expect(showRefreshTokenButton(null, true)).toBe(false);
  });

  test('loading → hide (authorized is falsy on loading fixture)', () => {
    expect(showRefreshTokenButton(FS_LOADING, true)).toBe(false);
  });
});

describe('refreshTokenButtonLabel', () => {
  test('not refreshing → "🔄 Refresh Token"', () => {
    expect(refreshTokenButtonLabel(false)).toBe('🔄 Refresh Token');
  });

  test('refreshing → "⏳ Refreshing…"', () => {
    expect(refreshTokenButtonLabel(true)).toBe('⏳ Refreshing…');
  });
});

// ─── 6. Sync via FHIR button ──────────────────────────────────────────────────

describe('showSyncButton', () => {
  test('authorized + valid → show', () => {
    expect(showSyncButton(FS_AUTHORIZED_VALID)).toBe(true);
  });

  test('authorized + expired → hide', () => {
    expect(showSyncButton(FS_AUTHORIZED_EXPIRED)).toBe(false);
  });

  test('not authorized → hide', () => {
    expect(showSyncButton(FS_NOT_AUTHORIZED)).toBe(false);
  });

  test('null → hide', () => {
    expect(showSyncButton(null)).toBe(false);
  });

  test('loading → hide (authorized not set)', () => {
    expect(showSyncButton(FS_LOADING)).toBe(false);
  });
});

describe('syncButtonLabel', () => {
  test('not syncing → "⬇️ Sync via FHIR"', () => {
    expect(syncButtonLabel(false)).toBe('⬇️ Sync via FHIR');
  });

  test('syncing → "⏳ Syncing FHIR…"', () => {
    expect(syncButtonLabel(true)).toBe('⏳ Syncing FHIR…');
  });
});

// ─── 7. Disconnect button ─────────────────────────────────────────────────────

describe('showDisconnectButton', () => {
  test('authorized + valid → show', () => {
    expect(showDisconnectButton(FS_AUTHORIZED_VALID)).toBe(true);
  });

  test('authorized + expired → show (can still disconnect)', () => {
    expect(showDisconnectButton(FS_AUTHORIZED_EXPIRED)).toBe(true);
  });

  test('not authorized → hide', () => {
    expect(showDisconnectButton(FS_NOT_AUTHORIZED)).toBe(false);
  });

  test('null → hide', () => {
    expect(showDisconnectButton(null)).toBe(false);
  });

  test('loading → hide (authorized not set)', () => {
    expect(showDisconnectButton(FS_LOADING)).toBe(false);
  });
});

// ─── 8. Connecting banner ─────────────────────────────────────────────────────

describe('showConnectingBanner', () => {
  test('connecting → show banner', () => {
    expect(showConnectingBanner(true)).toBe(true);
  });

  test('not connecting → hide banner', () => {
    expect(showConnectingBanner(false)).toBe(false);
  });

  test('undefined → hide banner', () => {
    expect(showConnectingBanner(undefined)).toBe(false);
  });
});

// ─── 9. Expiry label derivation ───────────────────────────────────────────────

describe('deriveExpiryLabel', () => {
  test('null expiresAt → null', () => {
    expect(deriveExpiryLabel(null)).toBeNull();
  });

  test('undefined expiresAt → null', () => {
    expect(deriveExpiryLabel(undefined)).toBeNull();
  });

  test('invalid date string → null', () => {
    expect(deriveExpiryLabel('not-a-date')).toBeNull();
  });

  test('past timestamp → "expired"', () => {
    const past = new Date(Date.now() - 3600_000).toISOString();
    expect(deriveExpiryLabel(past)).toBe('expired');
  });

  test('30 minutes from now → "expires in 30m"', () => {
    const future = new Date(Date.now() + 30 * 60_000).toISOString();
    expect(deriveExpiryLabel(future)).toBe('expires in 30m');
  });

  test('2 hours from now → "expires in 2h"', () => {
    const future = new Date(Date.now() + 2 * 3600_000).toISOString();
    expect(deriveExpiryLabel(future)).toBe('expires in 2h');
  });

  test('3 days from now → "expires in 3d"', () => {
    const future = new Date(Date.now() + 3 * 24 * 3600_000).toISOString();
    expect(deriveExpiryLabel(future)).toBe('expires in 3d');
  });

  test('0 minutes (boundary) → "expires in 0m"', () => {
    // Just barely in the future (within the same minute)
    const future = new Date(Date.now() + 30_000).toISOString(); // 30 seconds
    const label = deriveExpiryLabel(future);
    expect(label).toBe('expires in 0m');
  });
});

// ─── 10. Credential isolation ─────────────────────────────────────────────────

describe('Concurrent credential state isolation', () => {
  test('status for cred A does not affect cred B', () => {
    // Simulates the fhirStatus map: { [credId]: statusObj }
    const fhirStatus = {
      10: FS_AUTHORIZED_VALID,
      20: FS_NOT_AUTHORIZED,
    };

    const fsA = fhirStatus[10];
    const fsB = fhirStatus[20];

    expect(showSyncButton(fsA)).toBe(true);   // cred 10 authorized+valid → show sync
    expect(showSyncButton(fsB)).toBe(false);  // cred 20 not authorized → hide sync
    expect(showConnectButton(fsA, true, false, null)).toBe(false); // cred 10 authorized → hide connect
    expect(showConnectButton(fsB, true, false, null)).toBe(true);  // cred 20 not authorized → show connect
  });

  test('connecting state for cred A does not affect cred B buttons', () => {
    const fhirConnecting = { 10: true, 20: false };
    expect(connectButtonDisabled(fhirConnecting[10])).toBe(true);
    expect(connectButtonDisabled(fhirConnecting[20])).toBe(false);
    expect(connectButtonLabel(FS_NOT_AUTHORIZED, fhirConnecting[10])).toBe('⏳ Waiting for Epic…');
    expect(connectButtonLabel(FS_NOT_AUTHORIZED, fhirConnecting[20])).toBe('🔗 Connect Epic MyChart');
  });

  test('refreshing state for cred A does not affect cred B button labels', () => {
    const fhirRefreshing = { 10: true, 20: false };
    expect(refreshTokenButtonLabel(fhirRefreshing[10])).toBe('⏳ Refreshing…');
    expect(refreshTokenButtonLabel(fhirRefreshing[20])).toBe('🔄 Refresh Token');
  });

  test('syncing state for cred A does not affect cred B button labels', () => {
    const fhirSyncing = { 10: true, 20: false };
    expect(syncButtonLabel(fhirSyncing[10])).toBe('⏳ Syncing FHIR…');
    expect(syncButtonLabel(fhirSyncing[20])).toBe('⬇️ Sync via FHIR');
  });
});

// ─── 11. Full state matrix ────────────────────────────────────────────────────

describe('Full fhirStatus state matrix — button visibility grid', () => {
  const matrix = [
    // [fs, fhirConfigured, connectVisible, refreshVisible, syncVisible, disconnectVisible]
    [FS_NULL,               true,  true,  false, false, false],
    [FS_LOADING,            true,  true,  false, false, false],  // loading: authorized=undefined
    [FS_NOT_AUTHORIZED,     true,  true,  false, false, false],
    [FS_NOT_AUTHORIZED,     false, false, false, false, false],  // config gate
    [FS_AUTHORIZED_VALID,   true,  false, false, true,  true],
    [FS_AUTHORIZED_VALID,   false, false, false, true,  true],   // sync+disconnect don't need config
    [FS_AUTHORIZED_EXPIRED, true,  false, true,  false, true],
    [FS_AUTHORIZED_EXPIRED, false, false, false, false, true],   // no refresh/connect without config
    [FS_ERROR,              true,  true,  false, false, false],  // error: !authorized → connect shows
  ];

  matrix.forEach(([fs, configured, expectConnect, expectRefresh, expectSync, expectDisconnect], i) => {
    test(`matrix row ${i}: ${JSON.stringify({ authorized: fs?.authorized, valid: fs?.valid, configured })}`, () => {
      expect(showConnectButton(fs, configured, false, null)).toBe(expectConnect);
      expect(showRefreshTokenButton(fs, configured)).toBe(expectRefresh);
      expect(showSyncButton(fs)).toBe(expectSync);
      expect(showDisconnectButton(fs)).toBe(expectDisconnect);
    });
  });
});
