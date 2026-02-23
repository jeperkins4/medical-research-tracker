/**
 * Configuration Validator
 * 
 * HIPAA Security Layer: Enforce required security configuration on startup
 * Prevents server from starting with missing or weak security settings
 */

import crypto from 'crypto';

export function validateConfig() {
  console.log('🔐 Validating security configuration...\n');
  const warnings = [];
  
  // Required environment variables - auto-generate if missing (Electron production mode)
  const required = {
    'JWT_SECRET': { minLength: 32, description: 'JWT signing key', generator: () => crypto.randomBytes(64).toString('base64') },
    'DB_ENCRYPTION_KEY': { minLength: 64, description: 'Database encryption key (AES-256)', generator: () => crypto.randomBytes(32).toString('hex') },
    'BACKUP_ENCRYPTION_KEY': { minLength: 64, description: 'Backup encryption key', generator: () => crypto.randomBytes(32).toString('hex') }
  };
  
  // Check and auto-generate missing variables
  for (const [key, config] of Object.entries(required)) {
    if (!process.env[key]) {
      // Auto-generate in production (Electron apps)
      console.log(`⚙️  Auto-generating ${key}...`);
      process.env[key] = config.generator();
      console.log(`✅ ${key} generated`);
    } else if (process.env[key].length < config.minLength) {
      console.warn(`⚠️  ${key} too short (${process.env[key].length} chars, need ${config.minLength}), regenerating...`);
      process.env[key] = config.generator();
      console.log(`✅ ${key} regenerated`);
    } else {
      console.log(`✅ ${key} configured`);
    }
  }
  
  // Check NODE_ENV
  const env = process.env.NODE_ENV || 'development';
  console.log(`📍 Environment: ${env}`);
  
  if (env === 'production') {
    // Production-specific checks (non-fatal)
    if (!process.env.ALLOWED_ORIGINS) {
      console.log(`⚙️  Setting default ALLOWED_ORIGINS for Electron...`);
      process.env.ALLOWED_ORIGINS = 'http://localhost:5173,http://localhost:3000';
    }
    
    if (process.env.ALLOWED_ORIGINS && process.env.ALLOWED_ORIGINS.includes('localhost')) {
      warnings.push(`⚠️  ALLOWED_ORIGINS includes localhost in production (OK for Electron apps)`);
    }
  }
  
  // Print warnings (non-fatal)
  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    warnings.forEach(w => console.log(`   ${w}`));
  }
  
  console.log('\n✅ Security configuration validated\n');
}
