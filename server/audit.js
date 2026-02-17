/**
 * Audit Logging System
 * 
 * HIPAA Security Layer: Record all access to PHI
 * Required by 45 CFR § 164.312(b) - Audit controls
 */

import { run } from './db-secure.js';

/**
 * Log an audit event
 * @param {number} userId - User ID performing the action
 * @param {string} username - Username
 * @param {string} action - Action performed (login, logout, view, create, update, delete)
 * @param {string} resourceType - Resource type (medications, vitals, etc.)
 * @param {number|null} resourceId - Resource ID (if applicable)
 * @param {string} status - Status (success, failure, error)
 * @param {object} details - Additional context (JSON)
 * @param {object} req - Express request object (for IP/user agent)
 */
export function logAudit(userId, username, action, resourceType, resourceId, status, details, req) {
  const ip = req?.ip || req?.connection?.remoteAddress || 'unknown';
  const userAgent = req?.get?.('user-agent') || 'unknown';
  
  try {
    run(`
      INSERT INTO audit_log (user_id, username, action, resource_type, resource_id, ip_address, user_agent, status, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [userId, username, action, resourceType, resourceId || null, ip, userAgent, status, JSON.stringify(details || {})]);
  } catch (err) {
    console.error('❌ Failed to write audit log:', err.message);
    // Don't throw - logging failure shouldn't break the app
    // But in production, you'd want to alert on this
  }
}

/**
 * Express middleware to auto-log all API requests
 * Apply this AFTER requireAuth middleware to capture authenticated requests
 */
export function auditMiddleware(req, res, next) {
  if (!req.user) {
    // Skip unauthenticated requests
    return next();
  }
  
  // Capture original res.json to log after response
  const originalJson = res.json.bind(res);
  const originalStatus = res.status.bind(res);
  
  // Track status code
  let statusCode = 200;
  res.status = function(code) {
    statusCode = code;
    return originalStatus(code);
  };
  
  res.json = (data) => {
    const action = req.method === 'GET' ? 'view' : 
                   req.method === 'POST' ? 'create' :
                   req.method === 'PUT' ? 'update' :
                   req.method === 'DELETE' ? 'delete' : 'unknown';
    
    const pathParts = req.path.split('/').filter(Boolean); // ['api', 'medications', '123']
    const resourceType = pathParts[1] || 'unknown'; // 'medications'
    const resourceId = pathParts[2] ? parseInt(pathParts[2]) : null; // 123 or null
    const status = statusCode < 400 ? 'success' : 'failure';
    
    logAudit(
      req.user.userId, 
      req.user.username, 
      action, 
      resourceType, 
      resourceId, 
      status, 
      { 
        path: req.path, 
        method: req.method,
        statusCode
      }, 
      req
    );
    
    return originalJson(data);
  };
  
  next();
}

/**
 * Log authentication events (login/logout)
 * Call this manually from auth endpoints
 */
export function logAuth(userId, username, action, status, reason, req) {
  logAudit(userId || 0, username || 'unknown', action, 'auth', null, status, { reason }, req);
}
