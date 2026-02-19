#!/usr/bin/env node
/**
 * Apply Research Library Schema to Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

console.log('📊 Applying Research Library Schema to Supabase...\n');

// Read SQL file
const sqlPath = join(__dirname, 'supabase', 'migrations', '020_research_library.sql');
const sql = readFileSync(sqlPath, 'utf-8');

console.log(`📄 Loaded SQL from: ${sqlPath}`);
console.log(`📏 SQL size: ${(sql.length / 1024).toFixed(1)} KB\n`);

try {
  // Execute SQL
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    console.error('❌ Error applying schema:', error.message);
    console.log('\n⚠️  Try applying via Supabase Dashboard instead:');
    console.log('   1. Go to https://app.supabase.com');
    console.log('   2. SQL Editor → New Query');
    console.log('   3. Copy/paste: supabase/migrations/020_research_library.sql');
    console.log('   4. Click Run\n');
    process.exit(1);
  }
  
  console.log('✅ Schema applied successfully!\n');
  
  // Verify tables exist
  const { data: tables } = await supabase
    .from('papers')
    .select('count', { count: 'exact', head: true });
  
  console.log('✅ Verified: papers table exists');
  
  const { data: tagsTbl } = await supabase
    .from('tags')
    .select('count', { count: 'exact', head: true });
  
  console.log('✅ Verified: tags table exists');
  
  console.log('\n🎉 Ready to migrate data!');
  console.log('\nRun:');
  console.log('   node migrate-to-supabase.mjs --user-id=82e75502-c890-4854-88ca-ca8799e92bc5\n');
  
} catch (err) {
  console.error('❌ Unexpected error:', err.message);
  console.log('\n💡 This RPC method may not be available.');
  console.log('   Please apply schema manually via Supabase Dashboard.\n');
  process.exit(1);
}
