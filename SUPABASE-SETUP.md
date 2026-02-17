# Supabase Setup for MyTreatmentPath

## Overview

Supabase provides:
- **PostgreSQL database** (for research library, user profiles, backups)
- **Authentication** (user signup/login)
- **Storage** (encrypted database backups)
- **Row-Level Security** (RLS) - users can only see their own data

**Critical:** **NO PHI (Protected Health Information) goes to Supabase**
- Patient health data stays local (encrypted SQLite on device)
- Only research papers, preferences, and encrypted backups sync to cloud

---

## Step 1: Create Supabase Project (5 min)

1. Go to https://supabase.com
2. Click "Start your project" (free tier)
3. Sign in with GitHub
4. Click "New Project"
5. Settings:
   - **Name:** `mytreatmentpath-production`
   - **Database Password:** Generate strong password (save it!)
   - **Region:** Closest to your users (e.g., `us-east-1`)
   - **Plan:** Free (or Pro $25/month for production)
6. Click "Create new project"
7. Wait ~2 minutes for provisioning

---

## Step 2: Get API Keys (2 min)

1. In Supabase dashboard, go to **Settings → API**
2. Copy these values:

```bash
# Save these for .env file:

SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3...
```

**Important:**
- **ANON_KEY** → Use in Electron app (client-side, safe to expose)
- **SERVICE_KEY** → Use in backend API (server-side, **keep secret!**)

---

## Step 3: Run Database Migration (5 min)

### Option A: Supabase SQL Editor (Easiest)

1. In Supabase dashboard, go to **SQL Editor**
2. Click "New query"
3. Copy/paste contents of `supabase/migrations/001_initial_schema.sql`
4. Click "Run" (bottom right)
5. Verify success: "Success. No rows returned"

### Option B: Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref YOUR_PROJECT_ID

# Run migration
supabase db push

# Verify
supabase db diff
```

---

## Step 4: Verify Tables Created (2 min)

In Supabase dashboard, go to **Table Editor**. You should see:

- ✅ `user_profiles`
- ✅ `research_library`
- ✅ `backup_metadata`
- ✅ `research_scan_results`

Click each table to see columns and RLS policies enabled.

---

## Step 5: Test Authentication (5 min)

### Create Test User

1. In Supabase dashboard, go to **Authentication → Users**
2. Click "Add user"
3. Settings:
   - **Email:** test@mytreatmentpath.com
   - **Password:** TestPassword123!
   - **Auto confirm user:** ✅ Yes
4. Click "Create user"

### Test Login via SQL

```sql
-- In SQL Editor, run:
SELECT * FROM auth.users WHERE email = 'test@mytreatmentpath.com';

-- Should return 1 row with user details
```

### Test RLS Policies

```sql
-- Create test research paper
INSERT INTO research_library (user_id, title, authors, journal)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'test@mytreatmentpath.com' LIMIT 1),
  'Test Paper',
  'Test Author',
  'Test Journal'
);

-- Query research (should only see this user's papers)
SELECT * FROM research_library;
```

---

## Step 6: Configure Backend API (5 min)

### Update `.env` file

```bash
# In medical-research-tracker/.env

# Supabase Configuration
SUPABASE_URL=https://ylcgxdfhexeyvythdnmg.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... # SECRET!

# OpenAI (for AI summaries)
OPENAI_API_KEY=sk-proj-...

# Session Secret
SESSION_SECRET=random-32-char-string-here

# Environment
NODE_ENV=production
```

### Update Backend Code (if needed)

Check `server/index.js` has Supabase client:

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Use service key on backend!
);

// Example: Get user research papers
app.get('/api/research', async (req, res) => {
  const { data, error } = await supabase
    .from('research_library')
    .select('*')
    .eq('user_id', req.user.id) // Authenticated user
    .order('saved_at', { ascending: false });
    
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
```

---

## Step 7: Configure Electron App (5 min)

### Update `.env.local` (client-side config)

```bash
# In medical-research-tracker/.env.local

VITE_SUPABASE_URL=https://ylcgxdfhexeyvythdnmg.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... # ANON key (safe for client)
```

### Update Electron Code

Check `src/services/supabase.js` (or create it):

```javascript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Example: Sign up new user
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  
  if (error) throw error;
  return data;
}

// Example: Sign in existing user
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) throw error;
  return data;
}

// Example: Save research paper
export async function saveResearchPaper(paper) {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('research_library')
    .insert({
      user_id: user.id,
      title: paper.title,
      authors: paper.authors,
      journal: paper.journal,
      pubmed_id: paper.pubmedId,
      abstract: paper.abstract,
      url: paper.url,
      cancer_types: paper.cancerTypes || [],
      mutations: paper.mutations || [],
      tags: paper.tags || [],
    })
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

// Example: Get user's research papers
export async function getResearchPapers() {
  const { data, error } = await supabase
    .from('research_library')
    .select('*')
    .order('saved_at', { ascending: false });
    
  if (error) throw error;
  return data;
}
```

---

## Step 8: Test End-to-End (10 min)

### Test Backend API

```bash
# Start backend
npm run server

# Test signup
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test2@mytreatmentpath.com","password":"TestPass123!"}'

# Test login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test2@mytreatmentpath.com","password":"TestPass123!"}'

# Should return JWT token
```

### Test Electron App

```bash
# Start app
npm run electron:dev

# Test signup flow:
# 1. Open app
# 2. Click "Sign Up"
# 3. Enter email/password
# 4. Verify account created in Supabase dashboard

# Test research save flow:
# 1. Search for paper
# 2. Click "Save"
# 3. Verify appears in Supabase research_library table
```

---

## Step 9: Enable Email Confirmation (Optional)

### SMTP Configuration

1. In Supabase dashboard, go to **Authentication → Email Templates**
2. Customize "Confirm signup" email
3. Go to **Settings → Auth → SMTP Settings**
4. Choose:
   - **Option A:** Use Supabase's email (limited, may go to spam)
   - **Option B:** Add custom SMTP (SendGrid, Mailgun, etc.)

**Recommended for production:** Custom SMTP

---

## Step 10: Storage Setup (for encrypted backups)

Storage bucket was created by migration, but verify:

1. Go to **Storage** in Supabase dashboard
2. Verify `backups` bucket exists
3. Click bucket → **Policies**
4. Verify 3 policies exist:
   - ✅ Users can upload own backups
   - ✅ Users can view own backups
   - ✅ Users can delete own backups

### Test Backup Upload (from Electron)

```javascript
// src/services/backup.js
import { supabase } from './supabase';

export async function uploadBackup(encryptedBlob, deviceName) {
  const { data: { user } } = await supabase.auth.getUser();
  const timestamp = new Date().toISOString();
  const fileName = `${user.id}/${timestamp}-backup.db.enc`;
  
  // Upload encrypted backup to Storage
  const { data, error } = await supabase.storage
    .from('backups')
    .upload(fileName, encryptedBlob, {
      contentType: 'application/octet-stream',
      upsert: false,
    });
    
  if (error) throw error;
  
  // Save metadata
  await supabase.from('backup_metadata').insert({
    user_id: user.id,
    backup_path: fileName,
    size_bytes: encryptedBlob.size,
    encrypted: true,
    device_name: deviceName,
    app_version: '0.1.0',
    status: 'completed',
  });
  
  return data;
}
```

---

## Security Checklist

### ✅ RLS Enabled
```sql
-- Verify RLS is enabled on all tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- All tables should have rowsecurity = true
```

### ✅ Service Key Protected
- ❌ Never commit `SUPABASE_SERVICE_KEY` to git
- ✅ Use environment variables
- ✅ Backend only (never in Electron app)

### ✅ ANON Key Usage
- ✅ Safe to use in Electron app
- ✅ RLS policies enforce data access rules
- ✅ Users can't see other users' data

### ✅ Backup Encryption
- ✅ Backups encrypted client-side **before** upload
- ✅ Supabase never sees unencrypted health data
- ✅ Encryption key stays on device

---

## Environment Variables Summary

### Backend API (`server/.env`)
```bash
NODE_ENV=production
PORT=3000

# Supabase (use SERVICE_KEY)
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_KEY=eyJhbG... # SECRET!

# OpenAI
OPENAI_API_KEY=sk-proj-...

# Session
SESSION_SECRET=random-32-char-string
```

### Electron App (`.env.local`)
```bash
# Supabase (use ANON_KEY)
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG... # Safe for client

# API Endpoint
VITE_API_URL=http://localhost:3000 # Dev
# VITE_API_URL=https://api.mytreatmentpath.com # Production
```

---

## Deployment Checklist

Before deploying to production:

- [ ] Supabase project created
- [ ] Migration run successfully
- [ ] Test user created and can login
- [ ] RLS policies verified (users can't see others' data)
- [ ] Backend `.env` configured with `SERVICE_KEY`
- [ ] Electron `.env.local` configured with `ANON_KEY`
- [ ] Email confirmation configured (or disabled for testing)
- [ ] Storage bucket created with policies
- [ ] Backup upload/download tested
- [ ] All tests pass

---

## Troubleshooting

### "relation does not exist" error
**Problem:** Migration didn't run  
**Fix:** Re-run migration in SQL Editor

### "JWT expired" error
**Problem:** Token expired  
**Fix:** Re-authenticate user

### "Row-level security policy violation"
**Problem:** User trying to access another user's data  
**Fix:** Verify `user_id` matches authenticated user

### "Failed to fetch" error
**Problem:** CORS or wrong URL  
**Fix:** Check `SUPABASE_URL` is correct

### Can't upload to Storage
**Problem:** Storage policies not created  
**Fix:** Re-run storage policy section of migration

---

## Next Steps

1. **Configure Supabase project** (follow steps above)
2. **Test locally** (Electron app + Supabase)
3. **Deploy backend** (Render with Supabase env vars)
4. **Deploy Electron app** (with production Supabase URL)
5. **Monitor usage** (Supabase dashboard → Database → Usage)

---

## Cost Estimate

**Free Tier (good for MVP):**
- 500 MB database
- 1 GB file storage
- 50,000 monthly active users
- 2 GB bandwidth/month
- **Cost:** $0/month

**Pro Tier (recommended for production):**
- 8 GB database
- 100 GB file storage
- 100,000 monthly active users
- 250 GB bandwidth/month
- Daily backups
- Point-in-time recovery
- **Cost:** $25/month

---

**You're ready! Start with Step 1 and follow the guide.**
