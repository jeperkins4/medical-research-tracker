#!/usr/bin/env node
import 'dotenv/config';
import { init, run } from './server/db-secure.js';
import { hashPassword } from './server/auth.js';

const USERNAME = 'jeperkins4';
const NEW_PASSWORD = 'health2024';

async function resetPassword() {
  console.log(`🔐 Resetting password for ${USERNAME}...\n`);
  
  try {
    init();
    
    const passwordHash = await hashPassword(NEW_PASSWORD);
    const result = run('UPDATE users SET password_hash = ? WHERE username = ?', [passwordHash, USERNAME]);
    
    if (result.changes > 0) {
      console.log('✅ Password updated!\n');
      console.log('📋 Login credentials:');
      console.log(`   Username: ${USERNAME}`);
      console.log(`   Password: ${NEW_PASSWORD}`);
      console.log('');
    } else {
      console.log(`❌ User ${USERNAME} not found`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

resetPassword();
