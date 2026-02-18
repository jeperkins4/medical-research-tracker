#!/usr/bin/env node
import 'dotenv/config';
import { init, query, run } from './server/db-secure.js';
import { hashPassword } from './server/auth.js';

const TEST_USERNAME = 'admin';
const TEST_PASSWORD = 'password123';

async function resetUser() {
  console.log('🔧 Resetting local user...\n');
  
  try {
    // Initialize database first
    const db = init();
    
    // Get existing users
    const existingUsers = query('SELECT * FROM users');
    console.log('📋 Current users:', existingUsers.length);
    existingUsers.forEach(u => console.log(`   - ${u.username} (ID: ${u.id})`));
    console.log('');
    
    // Create new test user (or reset existing)
    const passwordHash = await hashPassword(TEST_PASSWORD);
    
    // Check if admin user exists
    const adminExists = query('SELECT * FROM users WHERE username = ?', [TEST_USERNAME]);
    
    if (adminExists.length > 0) {
      // Update existing admin password
      run('UPDATE users SET password_hash = ? WHERE username = ?', [passwordHash, TEST_USERNAME]);
      console.log('✅ Updated existing admin user password\n');
    } else {
      // Create new admin user
      const result = run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [TEST_USERNAME, passwordHash]);
      console.log('✅ Created new admin user\n');
      console.log('   User ID:', result.lastInsertRowid);
    }
    
    console.log('📋 Login credentials:');
    console.log('   Username:', TEST_USERNAME);
    console.log('   Password:', TEST_PASSWORD);
    console.log('');
    console.log('🚀 You can now login to the Electron app with these credentials.');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

resetUser();
