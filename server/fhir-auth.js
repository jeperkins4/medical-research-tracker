/**
 * FHIR OAuth2 Authentication Flow Handler
 * 
 * Implements:
 * - OAuth2 Authorization Code Flow (PKCE)
 * - Token refresh
 * - Status tracking
 * - Multi-EHR support (Epic, Cerner, Allscripts)
 */

import crypto from 'crypto';
import { query, run } from './db.js';

/**
 * Generate PKCE challenge
 */
export const generatePKCEChallenge = () => {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  
  return { codeVerifier, codeChallenge };
};

/**
 * Initialize OAuth flow for FHIR server
 * 
 * @param {number} credentialId - portal_credentials.id
 * @param {string} fhirServerUrl - FHIR base URL (e.g., https://r4.smarthealthit.org/...)
 * @param {string} clientId - OAuth client ID
 * @param {string} redirectUri - Callback URL
 * @returns {object} { authorizationUrl, codeVerifier, state }
 */
export const initAuthFlow = (credentialId, fhirServerUrl, clientId, redirectUri) => {
  const { codeVerifier, codeChallenge } = generatePKCEChallenge();
  const state = crypto.randomBytes(16).toString('hex');
  
  // Build authorization endpoint URL
  const authUrl = new URL(`${fhirServerUrl}/oauth2/authorize`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'launch/patient patient/*.read openid fhirUser offline_access');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  
  // Store state + verifier in temp (in production: use Redis or session store)
  // For now, we'll return them; the client must send them back
  
  return {
    authorizationUrl: authUrl.toString(),
    codeVerifier,
    state
  };
};

/**
 * Handle OAuth callback
 * 
 * @param {number} credentialId - portal_credentials.id
 * @param {string} code - Authorization code from FHIR server
 * @param {string} state - State from redirect (verify against stored state)
 * @param {string} codeVerifier - PKCE code verifier
 * @param {string} fhirServerUrl - FHIR base URL
 * @param {string} clientId - OAuth client ID
 * @param {string} clientSecret - OAuth client secret
 * @param {string} redirectUri - Callback URL
 * @returns {object} { accessToken, refreshToken, expiresIn, tokenType }
 */
export const handleAuthCallback = async (
  credentialId,
  code,
  state,
  codeVerifier,
  fhirServerUrl,
  clientId,
  clientSecret,
  redirectUri
) => {
  try {
    // Exchange code for token
    const tokenUrl = `${fhirServerUrl}/oauth2/token`;
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
        code_verifier: codeVerifier
      }).toString()
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${error}`);
    }

    const tokenData = await response.json();

    // Store tokens in database
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
    
    run(
      `UPDATE portal_credentials 
       SET fhir_access_token = ?,
           fhir_refresh_token = ?,
           fhir_token_expires_at = ?,
           fhir_token_type = ?,
           fhir_auth_status = 'authenticated',
           updated_at = ?
       WHERE id = ?`,
      [
        tokenData.access_token,
        tokenData.refresh_token || null,
        expiresAt,
        tokenData.token_type || 'Bearer',
        new Date().toISOString(),
        credentialId
      ]
    );

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      tokenType: tokenData.token_type || 'Bearer'
    };
  } catch (error) {
    // Update status to failed
    run(
      `UPDATE portal_credentials 
       SET fhir_auth_status = ?, updated_at = ?
       WHERE id = ?`,
      ['auth-failed', new Date().toISOString(), credentialId]
    );

    throw error;
  }
};

/**
 * Refresh FHIR access token
 * 
 * @param {number} credentialId - portal_credentials.id
 * @returns {object} { accessToken, expiresIn }
 */
export const refreshFHIRToken = async (credentialId) => {
  try {
    const cred = query(
      `SELECT fhir_refresh_token, fhir_server_url, fhir_client_id, fhir_client_secret 
       FROM portal_credentials WHERE id = ?`,
      [credentialId]
    )[0];

    if (!cred || !cred.fhir_refresh_token) {
      throw new Error('No refresh token available');
    }

    const tokenUrl = `${cred.fhir_server_url}/oauth2/token`;
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: cred.fhir_refresh_token,
        client_id: cred.fhir_client_id,
        client_secret: cred.fhir_client_secret
      }).toString()
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const tokenData = await response.json();
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    // Update token
    run(
      `UPDATE portal_credentials 
       SET fhir_access_token = ?,
           fhir_token_expires_at = ?,
           updated_at = ?
       WHERE id = ?`,
      [
        tokenData.access_token,
        expiresAt,
        new Date().toISOString(),
        credentialId
      ]
    );

    return {
      accessToken: tokenData.access_token,
      expiresIn: tokenData.expires_in
    };
  } catch (error) {
    run(
      `UPDATE portal_credentials 
       SET fhir_auth_status = ?, updated_at = ?
       WHERE id = ?`,
      ['token-refresh-failed', new Date().toISOString(), credentialId]
    );

    throw error;
  }
};

/**
 * Check if token is expired and refresh if needed
 */
export const ensureValidToken = async (credentialId) => {
  const cred = query(
    `SELECT fhir_access_token, fhir_token_expires_at FROM portal_credentials WHERE id = ?`,
    [credentialId]
  )[0];

  if (!cred?.fhir_access_token) {
    throw new Error('No FHIR token available');
  }

  const expiresAt = new Date(cred.fhir_token_expires_at);
  const now = new Date();
  
  // Refresh if within 5 minutes of expiry
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    return refreshFHIRToken(credentialId);
  }

  return {
    accessToken: cred.fhir_access_token,
    expiresIn: Math.floor((expiresAt.getTime() - now.getTime()) / 1000)
  };
};

/**
 * Get FHIR auth status
 */
export const getAuthStatus = (credentialId) => {
  const cred = query(
    `SELECT fhir_auth_status, fhir_token_expires_at, service_name 
     FROM portal_credentials WHERE id = ?`,
    [credentialId]
  )[0];

  if (!cred) {
    return { status: 'not-found' };
  }

  return {
    service: cred.service_name,
    status: cred.fhir_auth_status,
    expiresAt: cred.fhir_token_expires_at,
    isExpired: cred.fhir_token_expires_at ? new Date(cred.fhir_token_expires_at) < new Date() : true
  };
};
