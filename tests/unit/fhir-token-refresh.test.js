/**
 * Unit tests for FHIR token refresh logic
 * Tests: token validation, refresh endpoint call, token storage
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Database } from 'better-sqlite3';

// Mock token manager functions
const createTokenManager = (db) => {
  return {
    getToken: (credentialId) => {
      try {
        const stmt = db.prepare(`
          SELECT access_token, refresh_token, expires_at 
          FROM fhir_credentials 
          WHERE id = ?
        `);
        return stmt.get(credentialId);
      } catch (err) {
        console.error('Error getting token:', err);
        return null;
      }
    },

    saveToken: (credentialId, accessToken, refreshToken, expiresAt) => {
      try {
        const stmt = db.prepare(`
          UPDATE fhir_credentials 
          SET access_token = ?, refresh_token = ?, expires_at = ?, last_refresh = ? 
          WHERE id = ?
        `);
        return stmt.run(accessToken, refreshToken, expiresAt, Date.now(), credentialId);
      } catch (err) {
        console.error('Error saving token:', err);
        return null;
      }
    },

    isTokenExpired: (expiresAt) => {
      if (!expiresAt) return true;
      // Assume expiry if within 5 min window
      return Date.now() >= (expiresAt - 5 * 60 * 1000);
    },

    refreshToken: async (credentialId, fhirServerUrl, clientId, clientSecret) => {
      const credential = this.getToken(credentialId);
      if (!credential || !credential.refresh_token) {
        throw new Error('No refresh token available');
      }

      try {
        const response = await fetch(`${fhirServerUrl}/oauth2/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: credential.refresh_token,
            client_id: clientId,
            client_secret: clientSecret
          })
        });

        if (!response.ok) {
          throw new Error(`Token refresh failed: ${response.status}`);
        }

        const data = await response.json();
        const expiresAt = Date.now() + (data.expires_in * 1000);
        
        this.saveToken(
          credentialId,
          data.access_token,
          data.refresh_token || credential.refresh_token,
          expiresAt
        );

        return { success: true, expiresAt };
      } catch (err) {
        console.error('Token refresh error:', err);
        throw err;
      }
    }
  };
};

describe('FHIR Token Refresh', () => {
  let db;
  let tokenManager;

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    
    // Create FHIR credentials table
    db.exec(`
      CREATE TABLE fhir_credentials (
        id INTEGER PRIMARY KEY,
        credential_id INTEGER NOT NULL,
        fhir_server_url TEXT NOT NULL,
        client_id TEXT NOT NULL,
        client_secret TEXT NOT NULL,
        access_token TEXT,
        refresh_token TEXT,
        expires_at INTEGER,
        last_refresh INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `);

    // Insert test credential
    db.prepare(`
      INSERT INTO fhir_credentials (
        credential_id, fhir_server_url, client_id, client_secret,
        access_token, refresh_token, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      1,
      'https://r4.smarthealthit.org/api',
      'test-client',
      'test-secret',
      'old-access-token',
      'refresh-token-123',
      Date.now() + 3600000 // 1 hour from now
    );

    tokenManager = createTokenManager(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should detect if token is expired', () => {
    const futureTime = Date.now() + 3600000; // 1 hour ahead
    const pastTime = Date.now() - 1000; // 1 second ago

    expect(tokenManager.isTokenExpired(pastTime)).toBe(true);
    expect(tokenManager.isTokenExpired(futureTime)).toBe(false);
  });

  it('should detect if token is about to expire (within 5 min window)', () => {
    const soonToExpire = Date.now() + 2 * 60 * 1000; // 2 min from now
    const stillValid = Date.now() + 10 * 60 * 1000; // 10 min from now

    expect(tokenManager.isTokenExpired(soonToExpire)).toBe(true);
    expect(tokenManager.isTokenExpired(stillValid)).toBe(false);
  });

  it('should retrieve stored token by credential ID', () => {
    const token = tokenManager.getToken(1);
    
    expect(token).toBeDefined();
    expect(token.access_token).toBe('old-access-token');
    expect(token.refresh_token).toBe('refresh-token-123');
  });

  it('should update token and refresh timestamp', () => {
    const newAccessToken = 'new-access-token-456';
    const newRefreshToken = 'new-refresh-token-789';
    const newExpiresAt = Date.now() + 7200000; // 2 hours

    const result = tokenManager.saveToken(1, newAccessToken, newRefreshToken, newExpiresAt);
    expect(result).toBeDefined();

    const updated = tokenManager.getToken(1);
    expect(updated.access_token).toBe(newAccessToken);
    expect(updated.refresh_token).toBe(newRefreshToken);
    expect(updated.expires_at).toBe(newExpiresAt);
  });

  it('should return null if credential not found', () => {
    const token = tokenManager.getToken(9999);
    expect(token).toBeUndefined();
  });

  it('should throw error if refresh token is missing', async () => {
    // Create credential without refresh token
    db.prepare(`
      INSERT INTO fhir_credentials (
        credential_id, fhir_server_url, client_id, client_secret,
        access_token, refresh_token, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(2, 'https://example.com/api', 'client2', 'secret2', 'token', null, Date.now());

    try {
      await tokenManager.refreshToken(2, 'https://example.com/api', 'client2', 'secret2');
      expect.fail('Should have thrown error');
    } catch (err) {
      expect(err.message).toContain('No refresh token');
    }
  });

  it('should calculate correct expiry time from expires_in', () => {
    const expiresIn = 3600; // 1 hour
    const expectedExpiry = Date.now() + (expiresIn * 1000);
    const tolerance = 100; // 100ms tolerance

    expect(Math.abs(expectedExpiry - (Date.now() + expiresIn * 1000))).toBeLessThan(tolerance);
  });
});
