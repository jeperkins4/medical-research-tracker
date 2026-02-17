# Supabase Setup Guide

Complete this setup to enable cloud features (settings sync, research library, encrypted backups).

**Time required:** 15 minutes

---

## Step 1: Create Supabase Account (2 minutes)

1. Go to https://supabase.com
2. Click "Start your project"
3. Sign up with GitHub or email
4. Verify your email if required

---

## Step 2: Create New Project (3 minutes)

1. Click "New Project"
2. Select your organization (or create one)
3. Fill in project details:
   - **Name:** mytreatmentpath
   - **Database Password:** (generate a strong password - save it!)
   - **Region:** Choose closest to you:
     - `us-east-1` (Virginia) - East Coast USA
     - `us-west-1` (California) - West Coast USA
     - `eu-west-1` (Ireland) - Europe
   - **Pricing Plan:** Free (plenty for initial use)
4. Click "Create new project"
5. Wait 2-3 minutes for project to provision

---

## Step 3: Get API Keys (1 minute)

1. In your Supabase project dashboard, click "Settings" (⚙️ icon in left sidebar)
2. Click "API" in the settings menu
3. You'll see two important keys:
   - **Project URL:** `https://xxxxx.supabase.co`
   - **anon public:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (long string)
   - **service_role secret:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (different long string)

**Important:** Keep these safe! The service_role key is sensitive.

---

## Step 4: Configure Local Environment (2 minutes)

1. Copy the example environment file:
   ```bash
   cd ~/.openclaw/workspace/medical-research-tracker
   cp .env.local.example .env.local
   ```

2. Open `.env.local` and replace the placeholder values:
   ```bash
   # Replace these with your actual values from Step 3
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGci...your-anon-key...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...your-service-role-key...
   ```

3. Save the file

---

## Step 5: Run Database Migration (5 minutes)

1. In Supabase dashboard, click "SQL Editor" (left sidebar)
2. Click "New query"
3. Open the migration file:
   ```bash
   cat ~/.openclaw/workspace/medical-research-tracker/supabase/migrations/001_initial_schema.sql
   ```
4. Copy the entire SQL content
5. Paste it into the Supabase SQL Editor
6. Click "Run" (or press Cmd+Enter / Ctrl+Enter)
7. Wait for "Success. No rows returned" message

**What this creates:**
- `user_profiles` table (settings, preferences)
- `research_library` table (saved papers)
- `backup_metadata` table (backup tracking)
- `research_scan_results` table (daily scan results)
- Row-level security policies (users can only see their own data)
- Storage bucket for encrypted backups

---

## Step 6: Verify Setup (2 minutes)

1. In Supabase dashboard, click "Table Editor" (left sidebar)
2. You should see the new tables:
   - user_profiles
   - research_library
   - backup_metadata
   - research_scan_results

3. Click "Storage" (left sidebar)
4. You should see a "backups" bucket

5. Click "Authentication" (left sidebar)
6. Should show "Auth enabled" (it's on by default)

---

## Step 7: Test Connection (Optional)

Restart your Electron app to load the new environment variables:

```bash
# Stop the current Electron app (if running)
# Then restart:
cd ~/.openclaw/workspace/medical-research-tracker
npm run electron:dev
```

In the browser console (DevTools), you should see:
```
[Supabase] Client initialized
```

If you see:
```
[Supabase] Missing configuration. Cloud features disabled.
```

Then check that `.env.local` is properly configured.

---

## Troubleshooting

### Error: "Invalid API key"
- Double-check you copied the full key (they're very long)
- Make sure you used the `anon` key (not `service_role`) for `VITE_SUPABASE_ANON_KEY`

### Error: "relation does not exist"
- The migration didn't run successfully
- Go back to Step 5 and re-run the SQL migration
- Check for any error messages in the SQL Editor

### Error: "Unable to connect to Supabase"
- Check your internet connection
- Verify the project URL is correct
- Confirm your Supabase project is active (not paused)

### Tables not showing up
- Refresh the Supabase dashboard
- Wait 30 seconds and try again
- Re-run the migration SQL

---

## Security Notes

### What's Safe to Commit to Git:
- ✅ `.env.local.example` (template with placeholders)
- ✅ `supabase/migrations/*.sql` (database schema)
- ✅ `src/lib/supabase.js` (client setup code)

### What to Keep Private:
- ❌ `.env.local` (actual API keys)
- ❌ `SUPABASE_SERVICE_ROLE_KEY` (never expose to client)
- ❌ Database password

**Make sure `.env.local` is in your `.gitignore`!**

---

## Next Steps

Once setup is complete, you'll have:
- ✅ Cloud authentication ready
- ✅ Database tables for non-PHI data
- ✅ Encrypted backup storage
- ✅ Foundation for settings sync

Next: Implement authentication integration (Day 2-3)

---

## Cost Estimate

**Free Tier Includes:**
- 500 MB database
- 1 GB file storage
- 50,000 monthly active users
- 2 GB bandwidth
- 500,000 edge function invocations

**This is plenty for:**
- ~50-100 active users
- ~1000 research papers per user
- ~50 encrypted backups per user
- Daily research scans

**When you need to upgrade:**
- Pro tier: $25/month
- Scales to ~1000 users
- 8 GB database, 100 GB storage

---

## Support

- **Supabase Docs:** https://supabase.com/docs
- **Supabase Discord:** https://discord.supabase.com
- **Email:** support@supabase.io

**Setup complete?** You're ready for Day 2: Authentication Integration!
