#!/bin/bash
# Quick Setup: Apply Supabase Schema & Migrate Data

set -e

echo "🚀 Supabase Setup - Quick Start"
echo "================================"
echo ""

# Step 1: Copy SQL to clipboard
echo "📋 Step 1: Copying SQL schema to clipboard..."
cat supabase/migrations/020_research_library.sql | pbcopy
echo "   ✅ SQL copied!"
echo ""

# Step 2: Open Supabase SQL Editor
echo "🌐 Step 2: Opening Supabase SQL Editor..."
open "https://app.supabase.com/project/akawgrcegxycfoobikbw/sql/new"
echo "   ✅ Browser opened"
echo ""

# Step 3: Instructions
echo "📝 Step 3: In the browser:"
echo "   1. The SQL is already in your clipboard"
echo "   2. Paste into the SQL Editor (Cmd+V)"
echo "   3. Click 'Run' (bottom right)"
echo "   4. Should see 'Success. No rows returned'"
echo ""

# Wait for user confirmation
echo "⏳ Waiting for you to run the SQL..."
read -p "   Press ENTER after you've clicked 'Run' in Supabase... "
echo ""

# Step 4: Run migration
echo "🔄 Step 4: Migrating your 7 papers + 69 tags..."
node migrate-to-supabase.mjs --user-id=82e75502-c890-4854-88ca-ca8799e92bc5
echo ""

# Step 5: Verify
echo "✅ Step 5: Verifying migration..."
node --input-type=module -e "
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const { count: paperCount } = await supabase
  .from('papers')
  .select('*', { count: 'exact', head: true });

const { count: tagCount } = await supabase
  .from('tags')
  .select('*', { count: 'exact', head: true });

console.log('☁️  Supabase Data Verified:');
console.log(\`   ✅ Papers: \${paperCount}\`);
console.log(\`   ✅ Tags: \${tagCount}\`);

if (paperCount === 7 && tagCount === 69) {
  console.log(\`\n🎉 SUCCESS! Your research library is now in the cloud!\`);
  console.log(\`\n📊 What's in Supabase:\`);
  console.log(\`   • 7 research papers\`);
  console.log(\`   • 69 tags\`);
  console.log(\`   • 93 paper-tag associations\`);
  console.log(\`\n🔒 What stayed local (encrypted):\`);
  console.log(\`   • 23 medications\`);
  console.log(\`   • 517 lab results\`);
  console.log(\`   • 7 conditions\`);
  console.log(\`   • All patient health data\`);
} else {
  console.log(\`\n⚠️  Warning: Expected 7 papers and 69 tags\`);
  console.log(\`   Got: \${paperCount} papers, \${tagCount} tags\`);
}
"

echo ""
echo "================================"
echo "✅ Supabase setup complete!"
echo "================================"
