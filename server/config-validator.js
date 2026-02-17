/**
 * Configuration Validator
 * 
 * HIPAA Security Layer: Enforce required security configuration on startup
 * Prevents server from starting with missing or weak security settings
 */

export function validateConfig() {
  console.log('🔐 Validating security configuration...\n');
  
  const errors = [];
  const warnings = [];
  
  // Required environment variables
  const required = {
    'JWT_SECRET': { minLength: 32, description: 'JWT signing key' },
    'DB_ENCRYPTION_KEY': { minLength: 64, description: 'Database encryption key (AES-256)' }
  };
  
  // Check for missing variables
  for (const [key, config] of Object.entries(required)) {
    if (!process.env[key]) {
      errors.push(`❌ Missing ${key} - ${config.description}`);
    } else if (process.env[key].length < config.minLength) {
      errors.push(`❌ ${key} too short (${process.env[key].length} chars, need ${config.minLength})`);
    } else {
      console.log(`✅ ${key} configured`);
    }
  }
  
  // Optional but recommended
  if (!process.env.BACKUP_ENCRYPTION_KEY) {
    warnings.push(`⚠️  BACKUP_ENCRYPTION_KEY not set - backups will not be encrypted`);
  } else if (process.env.BACKUP_ENCRYPTION_KEY.length < 64) {
    warnings.push(`⚠️  BACKUP_ENCRYPTION_KEY too short (need 64 chars)`);
  } else {
    console.log(`✅ BACKUP_ENCRYPTION_KEY configured`);
  }
  
  // Check NODE_ENV
  const env = process.env.NODE_ENV || 'development';
  console.log(`📍 Environment: ${env}`);
  
  if (env === 'production') {
    // Production-specific checks
    if (!process.env.ALLOWED_ORIGINS) {
      errors.push(`❌ ALLOWED_ORIGINS required in production`);
    }
    
    if (process.env.ALLOWED_ORIGINS && process.env.ALLOWED_ORIGINS.includes('localhost')) {
      warnings.push(`⚠️  ALLOWED_ORIGINS includes localhost in production`);
    }
  }
  
  // Print warnings
  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    warnings.forEach(w => console.log(`   ${w}`));
  }
  
  // Fail on errors
  if (errors.length > 0) {
    console.error('\n❌ Configuration errors:\n');
    errors.forEach(e => console.error(`   ${e}`));
    console.error('\nSee .env.example for required configuration.');
    console.error('Generate keys with: openssl rand -hex 32 (DB), openssl rand -base64 64 (JWT)\n');
    process.exit(1);
  }
  
  console.log('\n✅ Security configuration validated\n');
}
