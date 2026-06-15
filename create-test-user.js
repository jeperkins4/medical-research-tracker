#!/usr/bin/env node

// Create a test user in Supabase
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function createTestUser() {
  console.log('👤 Creating test user...\n');
  
  const testEmail = 'test@mytreatmentpath.com';
  const testPassword = 'TestPassword123!';
  
  try {
    // Create user using admin API
    const { data, error } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true, // Auto-confirm email
    });
    
    if (error) {
      if (error.message.includes('already exists') || error.message.includes('already registered')) {
        console.log('✅ Test user already exists:', testEmail);
        console.log('');
        console.log('📋 Login credentials:');
        console.log('   Email:', testEmail);
        console.log('   Password:', testPassword);
      } else {
        console.error('❌ Error creating user:', error.message);
        process.exit(1);
      }
    } else {
      console.log('✅ Test user created successfully!');
      console.log('');
      console.log('📋 Login credentials:');
      console.log('   Email:', testEmail);
      console.log('   Password:', testPassword);
      console.log('   User ID:', data.user.id);
      
      // Check if user_profile was auto-created
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();
      
      if (profileError) {
        console.log('');
        console.log('⚠️  User profile not auto-created:', profileError.message);
      } else {
        console.log('');
        console.log('✅ User profile auto-created!');
        console.log('   Profile:', profile);
      }
    }
    
    console.log('');
    console.log('🧪 Test the login:');
    console.log('1. Start your Electron app: npm run electron:dev');
    console.log('2. Login with the credentials above');
    console.log('3. Verify you can save research papers');
    console.log('');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

createTestUser();
