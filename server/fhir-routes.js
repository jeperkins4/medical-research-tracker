/**
 * FHIR OAuth and API routes
 * 
 * Handles SMART on FHIR authorization flow and callbacks
 */

import { getAuthorizationUrl, exchangeCodeForToken } from './connectors/epic-fhir.js';

/**
 * Register FHIR routes with Express app
 * 
 * @param {Express} app - Express application
 * @param {Function} requireAuth - Authentication middleware
 */
export function registerFHIRRoutes(app, requireAuth) {
  
  /**
   * GET /api/fhir/authorize/:credentialId
   * 
   * Generate authorization URL and redirect patient to Epic login
   */
  app.get('/api/fhir/authorize/:credentialId', requireAuth, (req, res) => {
    try {
      const credentialId = parseInt(req.params.credentialId);
      
      // Generate authorization URL
      const authUrl = getAuthorizationUrl(credentialId);
      
      console.log(`[FHIR] Redirecting to authorization URL for credential ${credentialId}`);
      
      // Redirect patient to Epic login
      res.redirect(authUrl);
      
    } catch (error) {
      console.error('[FHIR] Authorization URL generation failed:', error);
      res.status(500).json({ 
        error: error.message,
        hint: 'Make sure EPIC_CLIENT_ID is configured in .env'
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
      const credentialId = parseInt(req.params.credentialId);
      
      // Query token status
      const { query } = require('./db-secure.js');
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
      const credentialId = parseInt(req.params.credentialId);
      
      const { run } = require('./db-secure.js');
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
}
