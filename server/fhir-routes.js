/**
 * FHIR OAuth and API routes
 * 
 * Handles SMART on FHIR authorization flow and callbacks
 */

import { getAuthorizationUrl, exchangeCodeForToken, syncEpicFHIR } from './connectors/epic-fhir.js';
import { getCredential } from './portal-credentials.js';
import { query, run } from './db-secure.js';

/**
 * Register FHIR routes with Express app
 * 
 * @param {Express} app - Express application
 * @param {Function} requireAuth - Authentication middleware
 */
export function registerFHIRRoutes(app, requireAuth) {
  // Basic configuration/status check for UI troubleshooting
  app.get('/api/fhir/config-check', requireAuth, (_req, res) => {
    const hasClientId = Boolean(process.env.EPIC_CLIENT_ID);
    const hasAppBaseUrl = Boolean(process.env.APP_BASE_URL);
    const callbackUrl = `${process.env.APP_BASE_URL || 'http://localhost:3000'}/api/fhir/callback`;

    return res.json({
      configured: hasClientId && hasAppBaseUrl,
      hasClientId,
      hasAppBaseUrl,
      callbackUrl,
    });
  });
  
  /**
   * GET /api/fhir/authorize/:credentialId
   * 
   * Generate authorization URL and redirect patient to Epic login
   */
  app.get('/api/fhir/authorize/:credentialId', requireAuth, (req, res) => {
    try {
      const credentialId = parseInt(req.params.credentialId, 10);
      if (!Number.isFinite(credentialId)) {
        return res.status(400).json({ error: 'Invalid credential id' });
      }

      const authUrl = getAuthorizationUrl(credentialId);

      // Electron / API clients can request URL only and open externally.
      if (req.query.mode === 'json') {
        return res.json({ authUrl, credentialId });
      }

      console.log(`[FHIR] Redirecting to authorization URL for credential ${credentialId}`);
      return res.redirect(authUrl);
    } catch (error) {
      console.error('[FHIR] Authorization URL generation failed:', error);
      return res.status(500).json({
        error: error.message,
        hint: 'Make sure EPIC_CLIENT_ID and APP_BASE_URL are configured in .env'
      });
    }
  });
  
  /**
   * GET /api/fhir/callback
   * 
   * OAuth callback endpoint - Epic redirects here after patient authorizes
   */
  app.get('/api/fhir/callback', async (req, res) => {
    try {
      const { code, state, error, error_description } = req.query;
      
      // Check for OAuth errors
      if (error) {
        console.error('[FHIR] OAuth error:', error, error_description);
        return res.redirect(`/?error=${encodeURIComponent(error_description || error)}`);
      }
      
      // Validate required parameters
      if (!code || !state) {
        return res.status(400).json({ 
          error: 'Missing required parameters (code or state)' 
        });
      }
      
      console.log('[FHIR] Received authorization code, exchanging for token...');
      
      // Exchange code for access token
      const tokenData = await exchangeCodeForToken(code, state);
      
      console.log(`[FHIR] Token exchange successful for credential ${tokenData.credentialId}`);
      console.log(`[FHIR] Patient FHIR ID: ${tokenData.patientId}`);
      
      // Redirect back to app with success message
      res.redirect(`/?fhir_success=true&credential_id=${tokenData.credentialId}`);
      
    } catch (error) {
      console.error('[FHIR] OAuth callback error:', error);
      res.redirect(`/?error=${encodeURIComponent(error.message)}`);
    }
  });
  
  /**
   * GET /api/fhir/status/:credentialId
   * 
   * Check FHIR authorization status for a credential
   */
  app.get('/api/fhir/status/:credentialId', requireAuth, (req, res) => {
    try {
      const credentialId = parseInt(req.params.credentialId, 10);
      if (!Number.isFinite(credentialId)) {
        return res.status(400).json({ error: 'Invalid credential id' });
      }

      // Query token status
      const tokenRecord = query(`
        SELECT 
          patient_id,
          expires_at,
          scope,
          CASE 
            WHEN expires_at > datetime('now') THEN 1 
            ELSE 0 
          END as is_valid
        FROM fhir_tokens
        WHERE credential_id = ?
      `, [credentialId])[0];
      
      if (!tokenRecord) {
        return res.json({
          authorized: false,
          message: 'Not authorized. Click "Connect Epic MyChart" to authorize.'
        });
      }
      
      const isValid = tokenRecord.is_valid === 1;
      
      res.json({
        authorized: true,
        valid: isValid,
        patientId: tokenRecord.patient_id,
        expiresAt: tokenRecord.expires_at,
        scope: tokenRecord.scope,
        message: isValid 
          ? 'Authorized and ready to sync' 
          : 'Authorization expired. Please re-authorize.'
      });
      
    } catch (error) {
      console.error('[FHIR] Status check error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * DELETE /api/fhir/revoke/:credentialId
   * 
   * Revoke FHIR authorization (delete tokens)
   */
  app.delete('/api/fhir/revoke/:credentialId', requireAuth, (req, res) => {
    try {
      const credentialId = parseInt(req.params.credentialId, 10);
      if (!Number.isFinite(credentialId)) {
        return res.status(400).json({ error: 'Invalid credential id' });
      }

      run('DELETE FROM fhir_tokens WHERE credential_id = ?', [credentialId]);
      
      console.log(`[FHIR] Revoked authorization for credential ${credentialId}`);
      
      res.json({ 
        success: true, 
        message: 'Authorization revoked successfully' 
      });
      
    } catch (error) {
      console.error('[FHIR] Revoke error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/fhir/sync/:credentialId
   *
   * Trigger a full FHIR data sync for an authorized Epic credential.
   * Returns a summary of records imported.
   */
  app.post('/api/fhir/sync/:credentialId', requireAuth, async (req, res) => {
    try {
      const credentialId = parseInt(req.params.credentialId, 10);
      if (!Number.isFinite(credentialId)) {
        return res.status(400).json({ error: 'Invalid credential id' });
      }

      // Verify credential exists
      const credential = getCredential(credentialId);
      if (!credential) {
        return res.status(404).json({ error: 'Credential not found' });
      }

      if (credential.portal_type !== 'epic') {
        return res.status(400).json({ error: 'FHIR sync only supported for Epic MyChart credentials' });
      }

      console.log(`[FHIR] Starting sync for credential ${credentialId} (${credential.service_name})`);

      const result = await syncEpicFHIR(credential);

      // Record last sync timestamp
      run(
        `UPDATE portal_credentials SET last_sync = datetime('now'), last_sync_status = ? WHERE id = ?`,
        [result.summary.status, credentialId]
      );

      console.log(`[FHIR] Sync complete for credential ${credentialId}: ${result.recordsImported} records`);

      return res.json({
        success: result.summary.status === 'Success',
        recordsImported: result.recordsImported,
        summary: result.summary,
      });
    } catch (error) {
      console.error('[FHIR] Sync error:', error);
      res.status(500).json({ error: error.message });
    }
  });
}
