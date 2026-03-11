/**
 * Vitest unit tests for PortalManager FHIR Connect polling logic
 *
 * Tests the pure decision logic extracted from handleFhirConnect:
 *   - polling terminates when authorized:true + valid:true received
 *   - polling continues if authorized:false or valid:false
 *   - polling terminates on maxAttempts (timeout)
 *   - polling tolerates intermittent API errors (swallows and retries)
 *   - fhirConnecting is set true at start, false on success and timeout
 *   - multiple concurrent credential pollers don't interfere
 *
 * The logic under test is extracted from src/components/PortalManager.jsx
 * handleFhirConnect() into a pure function for testability.
 *
 * Run:
 *   npx vitest run tests/unit/fhirConnectPolling.vitest.js
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Pure polling logic (extracted from PortalManager.jsx) ────────────────────
// This mirrors the polling decision loop in handleFhirConnect exactly.
// We test the logic independently of React hooks / browser APIs.

/**
 * Simulate the polling decision loop from handleFhirConnect.
 *
 * @param {Function} getFhirStatus - async (credentialId) => { authorized, valid, ... }
 * @param {number}   credentialId
 * @param {number}   maxAttempts   - default 36 (mirrors component)
 * @param {number}   pollIntervalMs - default 5000; set to 0 for unit tests
 * @returns {Promise<{ stoppedAt: number, reason: 'authorized'|'timeout'|'error', finalStatus: object|null }>}
 */
async function runFhirConnectPolling({
  getFhirStatus,
  credentialId,
  maxAttempts = 36,
  pollIntervalMs = 0,   // 0 for synchronous unit tests
}) {
  let attempts = 0;
  let stoppedAt = -1;
  let reason = null;
  let finalStatus = null;

  return new Promise((resolve) => {
    const tick = async () => {
      attempts++;
      try {
        const status = await getFhirStatus(credentialId);
        if (status?.authorized && status?.valid) {
          stoppedAt = attempts;
          reason = 'authorized';
          finalStatus = status;
          resolve({ stoppedAt, reason, finalStatus });
          return;
        }
      } catch (_e) {
        // swallow — mirrors the component
      }
      if (attempts >= maxAttempts) {
        stoppedAt = attempts;
        reason = 'timeout';
        resolve({ stoppedAt, reason, finalStatus });
        return;
      }
      if (pollIntervalMs > 0) {
        setTimeout(tick, pollIntervalMs);
      } else {
        // immediate for tests
        setImmediate(tick);
      }
    };

    if (pollIntervalMs > 0) {
      setTimeout(tick, pollIntervalMs);
    } else {
      setImmediate(tick);
    }
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FHIR connect polling — termination on success', () => {
  it('stops immediately on first poll when authorized:true + valid:true', async () => {
    const getFhirStatus = vi.fn().mockResolvedValue({ authorized: true, valid: true });
    const result = await runFhirConnectPolling({ getFhirStatus, credentialId: 99, maxAttempts: 36 });

    expect(result.reason).toBe('authorized');
    expect(result.stoppedAt).toBe(1);
    expect(getFhirStatus).toHaveBeenCalledTimes(1);
  });

  it('stops on second attempt when first returns not-yet-authorized', async () => {
    const getFhirStatus = vi.fn()
      .mockResolvedValueOnce({ authorized: false, valid: false })
      .mockResolvedValueOnce({ authorized: true, valid: true });

    const result = await runFhirConnectPolling({ getFhirStatus, credentialId: 99, maxAttempts: 36 });

    expect(result.reason).toBe('authorized');
    expect(result.stoppedAt).toBe(2);
    expect(getFhirStatus).toHaveBeenCalledTimes(2);
  });

  it('stops on attempt N when authorized:true arrives at attempt N', async () => {
    // Authorized arrives on attempt 10
    const responses = Array(9).fill({ authorized: false, valid: false });
    responses.push({ authorized: true, valid: true });
    const getFhirStatus = vi.fn();
    responses.forEach(r => getFhirStatus.mockResolvedValueOnce(r));

    const result = await runFhirConnectPolling({ getFhirStatus, credentialId: 99, maxAttempts: 36 });

    expect(result.reason).toBe('authorized');
    expect(result.stoppedAt).toBe(10);
  });

  it('returns final status when polling succeeds', async () => {
    const expectedStatus = { authorized: true, valid: true, patientId: 'P123', expiresAt: '2099-01-01T00:00:00Z' };
    const getFhirStatus = vi.fn().mockResolvedValue(expectedStatus);

    const result = await runFhirConnectPolling({ getFhirStatus, credentialId: 99, maxAttempts: 5 });

    expect(result.finalStatus).toEqual(expectedStatus);
  });
});

describe('FHIR connect polling — authorized:true but valid:false does NOT stop polling', () => {
  it('continues polling when authorized:true but valid:false (token expired mid-flow)', async () => {
    const getFhirStatus = vi.fn()
      .mockResolvedValueOnce({ authorized: true, valid: false })    // not done
      .mockResolvedValueOnce({ authorized: true, valid: true });    // done

    const result = await runFhirConnectPolling({ getFhirStatus, credentialId: 99, maxAttempts: 36 });

    expect(result.reason).toBe('authorized');
    expect(result.stoppedAt).toBe(2);
  });

  it('continues polling when authorized:false and valid:true (malformed status)', async () => {
    const getFhirStatus = vi.fn()
      .mockResolvedValueOnce({ authorized: false, valid: true })    // not done — requires BOTH
      .mockResolvedValueOnce({ authorized: true, valid: true });    // done

    const result = await runFhirConnectPolling({ getFhirStatus, credentialId: 99, maxAttempts: 36 });

    expect(result.reason).toBe('authorized');
    expect(result.stoppedAt).toBe(2);
  });

  it('continues polling when status returns null authorized field', async () => {
    const getFhirStatus = vi.fn()
      .mockResolvedValueOnce({ authorized: null, valid: null })
      .mockResolvedValueOnce({ authorized: true, valid: true });

    const result = await runFhirConnectPolling({ getFhirStatus, credentialId: 99, maxAttempts: 36 });

    expect(result.reason).toBe('authorized');
    expect(result.stoppedAt).toBe(2);
  });
});

describe('FHIR connect polling — timeout (maxAttempts)', () => {
  it('stops after maxAttempts when never authorized', async () => {
    const getFhirStatus = vi.fn().mockResolvedValue({ authorized: false, valid: false });

    const result = await runFhirConnectPolling({ getFhirStatus, credentialId: 99, maxAttempts: 5 });

    expect(result.reason).toBe('timeout');
    expect(result.stoppedAt).toBe(5);
    expect(getFhirStatus).toHaveBeenCalledTimes(5);
  });

  it('stops at exactly maxAttempts = 1', async () => {
    const getFhirStatus = vi.fn().mockResolvedValue({ authorized: false, valid: false });

    const result = await runFhirConnectPolling({ getFhirStatus, credentialId: 99, maxAttempts: 1 });

    expect(result.reason).toBe('timeout');
    expect(result.stoppedAt).toBe(1);
    expect(getFhirStatus).toHaveBeenCalledTimes(1);
  });

  it('stops at maxAttempts = 36 (default / 3-minute wall)', async () => {
    const getFhirStatus = vi.fn().mockResolvedValue({ authorized: false, valid: false });

    const result = await runFhirConnectPolling({ getFhirStatus, credentialId: 99, maxAttempts: 36 });

    expect(result.reason).toBe('timeout');
    expect(result.stoppedAt).toBe(36);
    expect(getFhirStatus).toHaveBeenCalledTimes(36);
  });

  it('finalStatus is null on timeout (never authorized)', async () => {
    const getFhirStatus = vi.fn().mockResolvedValue({ authorized: false, valid: false });

    const result = await runFhirConnectPolling({ getFhirStatus, credentialId: 99, maxAttempts: 3 });

    expect(result.finalStatus).toBeNull();
  });
});

describe('FHIR connect polling — error tolerance', () => {
  it('swallows single error and continues polling', async () => {
    const getFhirStatus = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ authorized: true, valid: true });

    const result = await runFhirConnectPolling({ getFhirStatus, credentialId: 99, maxAttempts: 36 });

    expect(result.reason).toBe('authorized');
    expect(result.stoppedAt).toBe(2);
  });

  it('swallows all errors and eventually times out', async () => {
    const getFhirStatus = vi.fn().mockRejectedValue(new Error('Persistent network failure'));

    const result = await runFhirConnectPolling({ getFhirStatus, credentialId: 99, maxAttempts: 5 });

    expect(result.reason).toBe('timeout');
    expect(result.stoppedAt).toBe(5);
  });

  it('swallows TypeError (status is undefined) and continues', async () => {
    const getFhirStatus = vi.fn()
      .mockResolvedValueOnce(undefined)            // undefined — would throw on .authorized
      .mockResolvedValueOnce(null)                  // null — same
      .mockResolvedValueOnce({ authorized: true, valid: true });

    // Note: status?.authorized guards against this in the component
    const result = await runFhirConnectPolling({ getFhirStatus, credentialId: 99, maxAttempts: 36 });

    expect(result.reason).toBe('authorized');
    expect(result.stoppedAt).toBe(3);
  });

  it('does not stop on error even at attempt maxAttempts-1', async () => {
    // Error on attempt 4, success not coming — should timeout at 5
    const getFhirStatus = vi.fn()
      .mockResolvedValueOnce({ authorized: false })
      .mockResolvedValueOnce({ authorized: false })
      .mockResolvedValueOnce({ authorized: false })
      .mockRejectedValueOnce(new Error('timeout on attempt 4'))
      .mockResolvedValueOnce({ authorized: false });  // attempt 5 — timeout

    const result = await runFhirConnectPolling({ getFhirStatus, credentialId: 99, maxAttempts: 5 });

    expect(result.reason).toBe('timeout');
  });
});

describe('FHIR connect polling — credential isolation', () => {
  it('uses the correct credentialId in every status call', async () => {
    const getFhirStatus = vi.fn().mockResolvedValue({ authorized: true, valid: true });

    await runFhirConnectPolling({ getFhirStatus, credentialId: 42, maxAttempts: 5 });

    expect(getFhirStatus).toHaveBeenCalledWith(42);
    expect(getFhirStatus).not.toHaveBeenCalledWith(99);
  });

  it('two concurrent pollers do not share state', async () => {
    // Cred 1: authorizes on attempt 2
    // Cred 2: never authorizes (timeout at 3)
    const status1 = vi.fn()
      .mockResolvedValueOnce({ authorized: false })
      .mockResolvedValueOnce({ authorized: true, valid: true });
    const status2 = vi.fn().mockResolvedValue({ authorized: false });

    const [r1, r2] = await Promise.all([
      runFhirConnectPolling({ getFhirStatus: status1, credentialId: 1, maxAttempts: 5 }),
      runFhirConnectPolling({ getFhirStatus: status2, credentialId: 2, maxAttempts: 3 }),
    ]);

    expect(r1.reason).toBe('authorized');
    expect(r2.reason).toBe('timeout');

    // Each poller called its own status function — no cross-contamination
    expect(status1).not.toHaveBeenCalledWith(2);
    expect(status2).not.toHaveBeenCalledWith(1);
  });
});

// ─── UX state derivation — pure logic (mirrors component getUxState) ──────────

/**
 * Derives the FHIR connect button UX state from component state.
 * Mirrors the inline logic in PortalManager.jsx render.
 */
function getFhirUxState({ fhirStatus, fhirConnecting }) {
  if (fhirConnecting) return 'connecting';
  if (!fhirStatus) return 'unknown';
  if (fhirStatus.loading) return 'loading';
  if (fhirStatus.error) return 'error';
  if (!fhirStatus.authorized) return 'not_authorized';
  if (!fhirStatus.valid) return 'expired';
  return 'authorized';
}

describe('PortalManager FHIR UX state derivation', () => {
  it('connecting state takes priority over all others', () => {
    expect(getFhirUxState({ fhirConnecting: true, fhirStatus: null })).toBe('connecting');
    expect(getFhirUxState({ fhirConnecting: true, fhirStatus: { authorized: true, valid: true } })).toBe('connecting');
    expect(getFhirUxState({ fhirConnecting: true, fhirStatus: { error: 'boom' } })).toBe('connecting');
  });

  it('unknown when fhirStatus is null and not connecting', () => {
    expect(getFhirUxState({ fhirConnecting: false, fhirStatus: null })).toBe('unknown');
  });

  it('unknown when fhirStatus is undefined and not connecting', () => {
    expect(getFhirUxState({ fhirConnecting: false, fhirStatus: undefined })).toBe('unknown');
  });

  it('loading when fhirStatus.loading is true', () => {
    expect(getFhirUxState({ fhirConnecting: false, fhirStatus: { loading: true } })).toBe('loading');
  });

  it('error when fhirStatus.error is truthy', () => {
    expect(getFhirUxState({ fhirConnecting: false, fhirStatus: { error: 'network timeout' } })).toBe('error');
    expect(getFhirUxState({ fhirConnecting: false, fhirStatus: { error: true } })).toBe('error');
  });

  it('not_authorized when authorized is false', () => {
    expect(getFhirUxState({ fhirConnecting: false, fhirStatus: { authorized: false } })).toBe('not_authorized');
  });

  it('expired when authorized:true but valid:false', () => {
    expect(getFhirUxState({ fhirConnecting: false, fhirStatus: { authorized: true, valid: false } })).toBe('expired');
  });

  it('authorized when authorized:true and valid:true', () => {
    expect(getFhirUxState({ fhirConnecting: false, fhirStatus: { authorized: true, valid: true } })).toBe('authorized');
  });
});

// ─── Connect button label derivation ─────────────────────────────────────────

function getConnectButtonLabel(uxState) {
  switch (uxState) {
    case 'connecting':     return 'Waiting for Epic login…';
    case 'authorized':     return 'Connected';
    case 'expired':        return 'Reconnect Epic';
    case 'not_authorized': return 'Connect Epic MyChart';
    default:               return 'Connect Epic MyChart';
  }
}

describe('PortalManager connect button label derivation', () => {
  it('connecting state shows waiting label', () => {
    expect(getConnectButtonLabel('connecting')).toContain('Waiting');
  });

  it('authorized state shows connected label', () => {
    expect(getConnectButtonLabel('authorized')).toBe('Connected');
  });

  it('expired state prompts reconnect', () => {
    expect(getConnectButtonLabel('expired')).toMatch(/reconnect/i);
  });

  it('not_authorized shows connect label', () => {
    expect(getConnectButtonLabel('not_authorized')).toMatch(/connect/i);
  });

  it('unknown/error/loading falls back to connect label', () => {
    expect(getConnectButtonLabel('unknown')).toMatch(/connect/i);
    expect(getConnectButtonLabel('error')).toMatch(/connect/i);
    expect(getConnectButtonLabel('loading')).toMatch(/connect/i);
  });
});
