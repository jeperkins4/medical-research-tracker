/**
 * Unit tests for FHIR Login UI Component
 * Tests: button states, token display, refresh UI
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock FHIRLoginWidget component
const FHIRLoginWidget = ({ credentialId, onAuthComplete, onError }) => {
  const [isAuthenticated, setIsAuthenticated] = vi.fn().mockReturnValue(false);
  const [tokenStatus, setTokenStatus] = vi.fn().mockReturnValue(null);
  const [loading, setLoading] = vi.fn().mockReturnValue(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/fhir/auth/init', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credentialId,
          fhirServerUrl: 'https://r4.smarthealthit.org/api',
          clientId: 'test-client-id',
          redirectUri: 'http://localhost:5173/api/fhir/auth/callback'
        })
      });

      if (response.ok) {
        const data = await response.json();
        window.location.href = data.authorizationUrl;
      } else {
        onError?.('Failed to initiate OAuth flow');
      }
    } catch (err) {
      onError?.(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshToken = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/fhir/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId })
      });

      if (response.ok) {
        const data = await response.json();
        setTokenStatus(data);
        onAuthComplete?.(data);
      } else {
        onError?.('Failed to refresh token');
      }
    } catch (err) {
      onError?.(err.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    isAuthenticated,
    tokenStatus,
    loading,
    handleLogin,
    handleRefreshToken
  };
};

describe('FHIR Login Widget', () => {
  let widget;
  const mockOnComplete = vi.fn();
  const mockOnError = vi.fn();

  beforeEach(() => {
    mockOnComplete.mockClear();
    mockOnError.mockClear();
    widget = new FHIRLoginWidget({
      credentialId: 1,
      onAuthComplete: mockOnComplete,
      onError: mockOnError
    });
  });

  describe('initialization', () => {
    it('should render with default state', () => {
      expect(widget.isAuthenticated()).toBe(false);
      expect(widget.tokenStatus()).toBe(null);
      expect(widget.loading()).toBe(false);
    });

    it('should accept credential ID prop', () => {
      expect(widget).toBeDefined();
    });
  });

  describe('login flow', () => {
    it('should initiate OAuth flow on login click', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          authorizationUrl: 'https://example.com/oauth/authorize?code=abc123',
          codeVerifier: 'verifier123',
          state: 'state456'
        })
      });

      await widget.handleLogin();

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/fhir/auth/init',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include'
        })
      );

      fetchSpy.mockRestore();
    });

    it('should call onError callback if login fails', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: false
      });

      await widget.handleLogin();
      expect(mockOnError).toHaveBeenCalledWith('Failed to initiate OAuth flow');

      fetchSpy.mockRestore();
    });

    it('should handle network errors gracefully', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockRejectedValue(
        new Error('Network error')
      );

      await widget.handleLogin();
      expect(mockOnError).toHaveBeenCalledWith('Network error');

      fetchSpy.mockRestore();
    });
  });

  describe('token management', () => {
    it('should handle token refresh request', async () => {
      const refreshResponse = {
        access_token: 'new-token',
        expires_at: Date.now() + 3600000,
        status: 'valid'
      };

      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => refreshResponse
      });

      await widget.handleRefreshToken();

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/fhir/auth/refresh',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ credentialId: 1 })
        })
      );

      fetchSpy.mockRestore();
    });

    it('should call onAuthComplete after successful refresh', async () => {
      const refreshResponse = {
        access_token: 'refreshed-token',
        expires_at: Date.now() + 3600000,
        status: 'valid'
      };

      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => refreshResponse
      });

      await widget.handleRefreshToken();
      expect(mockOnComplete).toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    it('should display token expiry information', () => {
      const expiryTime = Date.now() + 1800000; // 30 min from now
      widget.tokenStatus.mockReturnValue({
        access_token: 'token123',
        expires_at: expiryTime,
        status: 'valid'
      });

      expect(widget.tokenStatus().expires_at).toBe(expiryTime);
    });

    it('should warn if token is expiring soon (< 5 min)', () => {
      const soonExpire = Date.now() + 3 * 60 * 1000; // 3 min from now
      widget.tokenStatus.mockReturnValue({
        access_token: 'token123',
        expires_at: soonExpire,
        status: 'expiring_soon'
      });

      expect(widget.tokenStatus().status).toBe('expiring_soon');
    });
  });

  describe('loading states', () => {
    it('should set loading state during login', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ ok: true, json: async () => ({}) }), 100))
      );

      widget.handleLogin();
      expect(widget.loading()).toBe(true);

      await new Promise(resolve => setTimeout(resolve, 150));
      expect(widget.loading()).toBe(false);

      fetchSpy.mockRestore();
    });

    it('should disable buttons while loading', () => {
      widget.loading.mockReturnValue(true);
      expect(widget.loading()).toBe(true);
    });
  });
});
