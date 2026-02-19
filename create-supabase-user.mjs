#!/usr/bin/env node
/**
 * Create Supabase User Account for Migration
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

console.log('🔐 Creating Supabase User Account...\n');

// Create user with email/password
const { data, error } = await supabase.auth.admin.createUser({
  email: 'john@mytreatmentpath.com',
  password: 'ChangeMe123!',
  email_confirm: true
});

if (error) {
  console.error('❌ Error creating user:', error.message);
  process.exit(1);
}

console.log('✅ User created successfully!\n');
console.log('📧 Email:', data.user.email);
console.log('🆔 User ID:', data.user.id);
console.log('\n💡 COPY THIS USER ID:\n');
console.log(`   ${data.user.id}\n`);
console.log('Then run migration:');
console.log(`   node migrate-to-supabase.mjs --user-id=${data.user.id}\n`);
