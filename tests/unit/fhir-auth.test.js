/**
 * FHIR Authentication Unit Tests
 * Tests for OAuth2 flows, token refresh, and status tracking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fhirAuth from '../../server/fhir-auth.js';

// Mock the db module
vi.mock('../../server/db.js', () => ({
  query: vi.fn(() => []),
  run: vi.fn(),
  init: vi.fn()
}));

describe('FHIR Auth - PKCE Challenge Generation', () => {
  it('should generate PKCE challenge with verifier and challenge', () => {
    const { codeVerifier, codeChallenge } = fhirAuth.generatePKCEChallenge();
    
    expect(codeVerifier).toBeDefined();
    expect(codeChallenge).toBeDefined();
    expect(typeof codeVerifier).toBe('string');
    expect(typeof codeChallenge).toBe('string');
    expect(codeVerifier.length).toBeGreaterThan(0);
    expect(codeChallenge.length).toBeGreaterThan(0);
  });

  it('should generate unique challenges on each call', () => {
    const result1 = fhirAuth.generatePKCEChallenge();
    const result2 = fhirAuth.generatePKCEChallenge();
    
    expect(result1.codeVerifier).not.toBe(result2.codeVerifier);
    expect(result1.codeChallenge).not.toBe(result2.codeChallenge);
  });
});

describe('FHIR Auth - Authorization Flow Init', () => {
  it('should initialize auth flow with correct URL parameters', () => {
    const credentialId = 1;
    const fhirServerUrl = 'https://r4.smarthealthit.org/api';
    const clientId = 'test-client-id';
    const redirectUri = 'http://localhost:3000/api/fhir/auth/callback';
    
    const result = fhirAuth.initAuthFlow(credentialId, fhirServerUrl, clientId, redirectUri);
    
    expect(result).toHaveProperty('authorizationUrl');
    expect(result).toHaveProperty('codeVerifier');
    expect(result).toHaveProperty('state');
    
    const url = new URL(result.authorizationUrl);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe(clientId);
    expect(url.searchParams.get('redirect_uri')).toBe(redirectUri);
    expect(url.searchParams.get('code_challenge')).toBeDefined();
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('should include required FHIR scopes in authorization URL', () => {
    const result = fhirAuth.initAuthFlow(1, 'https://r4.smarthealthit.org/api', 'test-id', 'http://localhost:3000/callback');
    const url = new URL(result.authorizationUrl);
    const scopes = url.searchParams.get('scope');
    
    expect(scopes).toContain('patient/*.read');
    expect(scopes).toContain('openid');
    expect(scopes).toContain('offline_access');
  });
});

describe('FHIR Auth - Status', () => {
  it('should return not-found status for non-existent credential', async () => {
    const status = fhirAuth.getAuthStatus(99999);
    
    expect(status).toHaveProperty('status');
    expect(status.status).toBe('not-found');
  });
});

describe('FHIR Auth - Token Validation', () => {
  it('should throw error when no token is available', async () => {
    try {
      await fhirAuth.ensureValidToken(99999);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error.message).toContain('No FHIR token available');
    }
  });
});

describe('FHIR Auth - Token Refresh', () => {
  it('should throw error when no refresh token available', async () => {
    try {
      await fhirAuth.refreshFHIRToken(99999);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error.message).toContain('No refresh token available');
    }
  });
});
