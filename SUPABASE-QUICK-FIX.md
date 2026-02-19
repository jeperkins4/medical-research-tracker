# Supabase Quick Fix - Apply Schema & Migrate Data

## Problem
Tables don't exist in Supabase yet. Need to apply SQL schema first.

---

## ✅ Step 1: Apply Schema (2 minutes)

### 1.1 Open Supabase Dashboard
Go to: **https://app.supabase.com/project/akawgrcegxycfoobikbw/sql/new**

(This link goes directly to SQL Editor)

### 1.2 Copy SQL Schema

**On your Mac, run:**
```bash
cat /Users/perkins/.openclaw/workspace/medical-research-tracker/supabase/migrations/020_research_library.sql | pbcopy
```

This copies the SQL to your clipboard.

### 1.3 Paste and Run

1. In Supabase SQL Editor, **paste** (Cmd+V)
2. Click **"Run"** button (bottom right)
3. Should see: **"Success. No rows returned"**

### 1.4 Verify Tables Created

Click **"Table Editor"** (left sidebar). You should see:
- ✅ `papers`
- ✅ `tags`
- ✅ `clinical_trials`
- ✅ `paper_tags`
- ✅ `paper_notes`

All tables should be empty (0 rows).

---

## ✅ Step 2: Migrate Data (30 seconds)

**On your Mac, run:**
```bash
cd /Users/perkins/.openclaw/workspace/medical-research-tracker
node migrate-to-supabase.mjs --user-id=82e75502-c890-4854-88ca-ca8799e92bc5
```

**Expected output:**
```
🔄 Starting Supabase Migration...

📚 Migrating research papers...
   ✅ IV vitamin C with chemotherapy...
   ✅ BT8009 (Zelenectide Pevedotin)...
   ...
   📊 Migrated 7/7 papers

🏷️  Migrating tags...
   ✅ bladder-cancer
   ✅ nectin-4
   ...
   📊 Migrated 69/69 tags

🔗 Migrating paper-tag associations...
   📊 Migrated 93/93 associations

✅ Migration complete!

📊 Summary:
   Papers: 7
   Tags: 69

🔒 PHI Data Status: Still encrypted locally (not migrated)
```

---

## ✅ Step 3: Verify (30 seconds)

### 3.1 Check Supabase Dashboard

1. Go to **Table Editor** → **papers**
2. Should see **7 rows**
3. Click **tags** table
4. Should see **69 rows**

### 3.2 Run Verification Script

```bash
cd /Users/perkins/.openclaw/workspace/medical-research-tracker
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
console.log(\`\n🎉 Success! Your research library is now in the cloud.\`);
"
```

---

## 🎯 Summary

**What you're migrating:**
- ✅ **7 research papers** (non-PHI)
- ✅ **69 tags** (non-PHI)
- ✅ **93 paper-tag associations**

**What stays local (encrypted):**
- 🔒 **23 medications** (PHI)
- 🔒 **517 lab results** (PHI)
- 🔒 **7 conditions** (PHI)
- 🔒 **1 patient profile** (PHI)

**Total time:** ~3 minutes

---

## 🚨 If Something Goes Wrong

### Error: "relation 'papers' does not exist"
**Fix:** SQL schema wasn't applied. Go back to Step 1.

### Error: "permission denied"
**Fix:** Make sure you're using `SUPABASE_SERVICE_KEY` in `.env` (not anon key).

### Error: "duplicate key value"
**Fix:** Data already migrated. Check Table Editor to verify.

---

## 📖 Next Steps

After migration completes:
1. ✅ Research library accessible from any device
2. ✅ Automatic cloud backups
3. ✅ Can now update frontend to use Supabase client
4. ✅ Future: Share papers with healthcare team

---

**Start here:** Step 1 - Apply Schema in Supabase Dashboard
