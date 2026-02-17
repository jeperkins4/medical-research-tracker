/**
 * Combined Middleware (Auth + Audit)
 * 
 * Convenience middleware that applies both authentication and audit logging
 */

import { requireAuth } from './auth.js';
import { auditMiddleware } from './audit.js';

/**
 * Require authentication AND log the access (HIPAA audit trail)
 */
export const requireAuthWithAudit = [requireAuth, auditMiddleware];
