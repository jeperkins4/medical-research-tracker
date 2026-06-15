#!/usr/bin/env node

// Run Supabase migration from terminal
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Supabase config
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🚀 Running database migration...\n');
  
  try {
    // Read migration file
    const migrationPath = join(__dirname, 'supabase', 'migrations', '001_initial_schema.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded:', migrationPath);
    console.log('📏 SQL length:', migrationSQL.length, 'characters\n');
    
    // Execute migration using raw SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      query: migrationSQL
    });
    
    if (error) {
      // If exec_sql function doesn't exist, use alternative method
      console.log('⚠️  exec_sql function not found, using direct POST...\n');
      
      // Use fetch to POST to Supabase's SQL endpoint
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ query: migrationSQL })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Migration failed:', errorText);
        process.exit(1);
      }
      
      console.log('✅ Migration executed successfully!\n');
    } else {
      console.log('✅ Migration executed successfully!');
      console.log('📊 Result:', data, '\n');
    }
    
    // Verify tables were created
    console.log('🔍 Verifying tables...\n');
    
    const tables = ['user_profiles', 'research_library', 'backup_metadata', 'research_scan_results'];
    
    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(0);
      
      if (error) {
        console.error(`❌ Table '${table}' not found:`, error.message);
      } else {
        console.log(`✅ Table '${table}' exists`);
      }
    }
    
    console.log('\n✨ Database migration complete!');
    console.log('\n📋 Next steps:');
    console.log('1. Go to: https://supabase.com/dashboard/project/akawgrcegxycfoobikbw/editor');
    console.log('2. Verify tables exist: user_profiles, research_library, backup_metadata, research_scan_results');
    console.log('3. Create a test user via Authentication → Users');
    console.log('4. Start building! 🚀\n');
    
  } catch (err) {
    console.error('❌ Error running migration:', err.message);
    process.exit(1);
  }
}

runMigration();
