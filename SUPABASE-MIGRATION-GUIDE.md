# Supabase Migration Guide - Non-PHI Data

## What Gets Migrated

✅ **Safe to migrate (Non-PHI):**
- Research papers (7 papers)
- Clinical trials (0 trials)
- Tags (69 tags)
- Paper-tag associations

🔒 **Stays local (PHI - encrypted):**
- Patient profile
- Medical conditions
- Medications
- Test results
- Vitals
- Symptoms
- Portal credentials
- Audit logs

**Your health data never leaves your device. Only research library goes to Supabase.**

---

## Step 1: Apply Database Schema

**Option A: Supabase Dashboard (Recommended)**

1. Go to https://app.supabase.com
2. Select your project: `akawgrcegxycfoobikbw`
3. Click **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy the entire contents of `supabase/migrations/020_research_library.sql`
6. Paste into SQL editor
7. Click **Run** (bottom right)
8. Verify: Should see "Success. No rows returned"

**Option B: Supabase CLI (if you fix Xcode tools)**

```bash
supabase db push
```

---

## Step 2: Create Supabase User Account

**You need a user account to associate your research data with.**

### Method 1: Email/Password Signup (Recommended)

1. Go to https://app.supabase.com
2. Select your project
3. Click **Authentication** → **Users** (left sidebar)
4. Click **Add user** → **Create new user**
5. Enter:
   - Email: `john@example.com` (or your real email)
   - Password: `[create strong password]`
   - Confirm password
6. Click **Create user**
7. **Copy the UUID** (looks like: `a1b2c3d4-1234-5678-90ab-cdef12345678`)

### Method 2: Magic Link (No Password)

1. Same steps as above, but choose **Send magic link**
2. Check your email
3. Click link to verify
4. **Copy your UUID from dashboard**

---

## Step 3: Run Migration Script

**Now copy your local research data → Supabase:**

```bash
cd /Users/perkins/.openclaw/workspace/medical-research-tracker

# Replace YOUR_UUID with the one you copied from Step 2
node migrate-to-supabase.mjs --user-id=YOUR_UUID
```

**Example:**
```bash
node migrate-to-supabase.mjs --user-id=a1b2c3d4-1234-5678-90ab-cdef12345678
```

**Expected output:**
```
🔄 Starting Supabase Migration...

📝 Using user ID: a1b2c3d4-1234-5678-90ab-cdef12345678

📚 Migrating research papers...
   ✅ IV vitamin C with chemotherapy for cisplatin ineligible bladder cancer patients (CI-MIBC) - NCT04046094
   ✅ BT8009 (Zelenectide Pevedotin) - Nectin-4 Targeting Bicycle Toxin Conjugate for Urothelial Cancer
   ...
   📊 Migrated 7/7 papers

🏷️  Migrating tags...
   ✅ bladder cancer
   ✅ nectin-4
   ✅ BT8009
   ...
   📊 Migrated 69/69 tags

🔗 Migrating paper-tag associations...
   📊 Migrated 23/23 associations

🔬 Migrating clinical trials...
   No trials to migrate

✅ Migration complete!

📊 Summary:
   Papers: 7
   Tags: 69

🔒 PHI Data Status: Still encrypted locally (not migrated)
```

---

## Step 4: Update Frontend to Use Supabase

**After migration completes, update your app to read research from Supabase instead of local SQLite.**

This will enable:
- ✅ Access research library from any device
- ✅ Sync across phone/tablet/computer
- ✅ Automatic backups
- ✅ Collaboration (future: share papers with doctors)

**I'll create a separate PR for this step.**

---

## Verify Migration

**Check Supabase dashboard:**

1. Go to **Table Editor** (left sidebar)
2. Click **papers** table
3. You should see your 7 papers
4. Click **tags** table
5. You should see your 69 tags

**Each row should have your `user_id` populated.**

---

## Rollback (If Needed)

**If something goes wrong, you can delete all migrated data:**

```bash
# Run in Supabase SQL Editor
DELETE FROM paper_tags WHERE paper_id IN (SELECT id FROM papers WHERE user_id = 'YOUR_UUID');
DELETE FROM papers WHERE user_id = 'YOUR_UUID';
DELETE FROM tags WHERE user_id = 'YOUR_UUID';
DELETE FROM clinical_trials WHERE user_id = 'YOUR_UUID';
```

**Your local data is untouched - you can always re-run the migration.**

---

## Troubleshooting

### Error: "Missing Supabase credentials"

- Check `.env` file has `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
- Service key should start with `eyJhbGc...` (not anon key)

### Error: "Missing DB_ENCRYPTION_KEY"

- Check `.env` file has `DB_ENCRYPTION_KEY`
- Should be 64-character hex string

### Error: "Duplicate key value violates unique constraint"

- Papers/tags already exist in Supabase
- Script will skip duplicates and continue
- Check output for `⚠️  Skipped duplicate` messages

### Error: "Row Level Security policy violation"

- Make sure you're using `SUPABASE_SERVICE_KEY` (not anon key)
- Service key bypasses RLS for migration
- Anon key would fail due to RLS policies

---

## Next Steps

After migration completes:

1. **Test frontend** - Verify papers still show up in Research tab
2. **Update ResearchSearch component** - Use Supabase client instead of local API
3. **Add sync button** - Let user manually sync local → Supabase
4. **Enable multi-device access** - Log in on phone/tablet and see same research library

---

## Security Notes

✅ **What's secure:**
- All PHI stays encrypted locally (AES-256)
- Supabase data uses Row Level Security (RLS)
- Each user can only see their own papers
- Research papers contain no patient identifiers

⚠️ **Paper notes could contain PHI:**
- If you wrote personal medical notes in paper_notes, those could be PHI
- Migration script migrates notes if they exist
- Consider: Only sync notes that are general research notes (not personal)

🔒 **Best practice:**
- Keep personal medical notes in local database only
- Use Supabase for research articles, mechanisms, trial info
- Use local SQLite for anything patient-specific

---

**Ready to migrate? Follow Steps 1-3 above!**
