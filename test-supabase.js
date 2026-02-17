#!/usr/bin/env node

// Test Supabase connection and verify migration
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testConnection() {
  console.log('🔍 Testing Supabase connection...\n');
  console.log('📍 URL:', supabaseUrl);
  console.log('');
  
  const tables = [
    'user_profiles',
    'research_library', 
    'backup_metadata',
    'research_scan_results'
  ];
  
  let allSuccess = true;
  
  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`❌ Table '${table}':`, error.message);
        allSuccess = false;
      } else {
        console.log(`✅ Table '${table}' exists (${count || 0} rows)`);
      }
    } catch (err) {
      console.log(`❌ Table '${table}':`, err.message);
      allSuccess = false;
    }
  }
  
  console.log('');
  
  if (allSuccess) {
    console.log('✨ All tables created successfully!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. ✅ Database ready');
    console.log('2. Create a test user (I can help with this)');
    console.log('3. Test from Electron app');
    console.log('4. Deploy backend to Render');
    console.log('5. Ship it! 🚀');
  } else {
    console.log('⚠️  Some tables are missing. Migration may need to be re-run.');
  }
  
  console.log('');
}

testConnection().catch(console.error);
