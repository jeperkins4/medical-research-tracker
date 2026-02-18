#!/usr/bin/env node

/**
 * Hardened Server Startup
 * 
 * Runs preflight checks before starting the server
 * Ensures environment is ready and critical dependencies are available
 */

import 'dotenv/config';
import { runPreflightChecks } from './server/preflight-checks.js';

console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║          Medical Research Tracker Server                  ║
║          Production-Hardened Edition                       ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`);

// Run preflight checks
const preflightResult = await runPreflightChecks();

if (!preflightResult.passed) {
  console.error('Startup aborted due to preflight failures.\n');
  process.exit(1);
}

// Start server
console.log('🚀 Starting server...\n');

import('./server/index.js').catch(error => {
  console.error('\n❌ FATAL: Server startup failed\n');
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
});
