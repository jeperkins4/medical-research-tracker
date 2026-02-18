/**
 * Preflight Checks - Run before server starts
 * 
 * Validates environment, database, and dependencies
 * Fails fast if critical requirements aren't met
 */

import { existsSync } from 'fs';
import { join } from 'path';

const checks = [];
let hasErrors = false;
let hasWarnings = false;

function pass(message) {
  checks.push({ status: '✅', message });
  console.log(`✅ ${message}`);
}

function warn(message) {
  checks.push({ status: '⚠️ ', message });
  console.warn(`⚠️  ${message}`);
  hasWarnings = true;
}

function fail(message) {
  checks.push({ status: '❌', message });
  console.error(`❌ ${message}`);
  hasErrors = true;
}

/**
 * Check environment variables
 */
function checkEnvironment() {
  console.log('\n🔍 Checking environment...\n');
  
  // Critical variables
  if (process.env.DB_ENCRYPTION_KEY) {
    pass('DB_ENCRYPTION_KEY configured');
  } else {
    fail('DB_ENCRYPTION_KEY not set (required for encrypted database)');
  }
  
  if (process.env.JWT_SECRET) {
    pass('JWT_SECRET configured');
  } else {
    fail('JWT_SECRET not set (required for authentication)');
  }
  
  // Optional but recommended
  if (process.env.BACKUP_ENCRYPTION_KEY) {
    pass('BACKUP_ENCRYPTION_KEY configured (backups enabled)');
  } else {
    warn('BACKUP_ENCRYPTION_KEY not set (automated backups disabled)');
  }
  
  if (process.env.ANTHROPIC_API_KEY) {
    pass('ANTHROPIC_API_KEY configured (AI features enabled)');
  } else {
    warn('ANTHROPIC_API_KEY not set (AI features disabled)');
  }
  
  // Node version check
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1).split('.')[0]);
  if (major >= 18) {
    pass(`Node.js version ${nodeVersion} (OK)`);
  } else {
    fail(`Node.js version ${nodeVersion} is too old (requires >= 18)`);
  }
}

/**
 * Check file system
 */
function checkFileSystem() {
  console.log('\n🔍 Checking file system...\n');
  
  const dataDir = join(process.cwd(), 'data');
  if (existsSync(dataDir)) {
    pass('Data directory exists');
  } else {
    warn('Data directory missing (will be created)');
  }
  
  const logsDir = join(process.cwd(), 'logs');
  if (existsSync(logsDir)) {
    pass('Logs directory exists');
  } else {
    warn('Logs directory missing (will be created)');
  }
  
  const backupsDir = join(process.cwd(), 'backups');
  if (existsSync(backupsDir)) {
    pass('Backups directory exists');
  } else {
    warn('Backups directory missing (will be created)');
  }
}

/**
 * Check database
 */
async function checkDatabase() {
  console.log('\n🔍 Checking database...\n');
  
  try {
    const { init, query } = await import('./db-secure.js');
    
    // Initialize database
    await init();
    pass('Database initialized');
    
    // Test query
    const result = query('SELECT 1 as test');
    if (result[0]?.test === 1) {
      pass('Database query test passed');
    } else {
      fail('Database query test failed');
    }
    
    // Check users table
    const users = query('SELECT COUNT(*) as count FROM users');
    pass(`Users table exists (${users[0].count} users)`);
    
  } catch (error) {
    fail(`Database check failed: ${error.message}`);
  }
}

/**
 * Check required modules
 */
async function checkModules() {
  console.log('\n🔍 Checking required modules...\n');
  
  const requiredModules = [
    'express',
    'cors',
    'cookie-parser',
    'bcryptjs',
    'jsonwebtoken',
    'better-sqlite3-multiple-ciphers',
    'dotenv'
  ];
  
  for (const mod of requiredModules) {
    try {
      await import(mod);
      pass(`Module ${mod} found`);
    } catch {
      fail(`Module ${mod} missing (run npm install)`);
    }
  }
}

/**
 * Check port availability
 */
function checkPort() {
  console.log('\n🔍 Checking port availability...\n');
  
  const PORT = process.env.PORT || 3000;
  
  // Note: We can't actually test port binding here without starting a server
  // This is just informational
  pass(`Will attempt to bind to port ${PORT}`);
}

/**
 * Run all preflight checks
 */
export async function runPreflightChecks() {
  console.log('\n🚦 Running preflight checks...\n');
  console.log('═'.repeat(50));
  
  checkEnvironment();
  checkFileSystem();
  await checkDatabase();
  await checkModules();
  checkPort();
  
  console.log('\n' + '═'.repeat(50));
  console.log('\n📊 Preflight Check Summary\n');
  
  const passed = checks.filter(c => c.status === '✅').length;
  const warnings = checks.filter(c => c.status === '⚠️ ').length;
  const failed = checks.filter(c => c.status === '❌').length;
  
  console.log(`   Passed:   ${passed}`);
  console.log(`   Warnings: ${warnings}`);
  console.log(`   Failed:   ${failed}`);
  
  if (hasErrors) {
    console.error('\n❌ PREFLIGHT FAILED - Critical errors detected\n');
    console.error('Fix the errors above before starting the server.\n');
    process.exit(1);
  }
  
  if (hasWarnings) {
    console.warn('\n⚠️  PREFLIGHT PASSED WITH WARNINGS\n');
    console.warn('Some optional features may be disabled.\n');
  } else {
    console.log('\n✅ PREFLIGHT PASSED - All checks OK\n');
  }
  
  return {
    passed: !hasErrors,
    hasWarnings,
    checks
  };
}
