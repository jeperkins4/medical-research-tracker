# Supabase Migration - Quick Start

## TL;DR

**Move your research library to the cloud** while keeping health data encrypted locally.

### What Gets Migrated

- ✅ **7 research papers** → Supabase (cloud)
- ✅ **69 tags** → Supabase (cloud)
- 🔒 **All patient health data** → Stays encrypted locally

### 3-Step Process

1. **Apply database schema** (2 minutes)
   - Open `supabase/migrations/020_research_library.sql`
   - Copy/paste into Supabase SQL Editor
   - Click "Run"

2. **Create Supabase user** (1 minute)
   - Go to Authentication → Users
   - Add new user (email/password)
   - Copy the UUID

3. **Run migration script** (30 seconds)
   ```bash
   node migrate-to-supabase.mjs --user-id=YOUR_UUID
   ```

**Total time:** ~5 minutes

---

## Why Migrate?

### Before (Local Only)
- ❌ Research library only accessible on Mac mini
- ❌ No automatic backups
- ❌ Can't access from phone/tablet

### After (Supabase Sync)
- ✅ Access research from any device
- ✅ Automatic cloud backups
- ✅ Faster search (PostgreSQL full-text search)
- ✅ Share papers with doctors (future feature)
- 🔒 **Health data still encrypted locally** (never leaves your device)

---

## Files Created

```
medical-research-tracker/
├── supabase/
│   └── migrations/
│       └── 020_research_library.sql       # Database schema (papers, trials, tags)
├── migrate-to-supabase.mjs                 # Migration script
├── SUPABASE-MIGRATION-GUIDE.md             # Detailed guide
└── SUPABASE-MIGRATION-README.md            # This file
```

---

## Safety

✅ **Your local data is not deleted** - Migration only copies to Supabase  
✅ **PHI never leaves your device** - Only research articles are synced  
✅ **Row Level Security** - Each user can only see their own data  
✅ **Rollback available** - Can delete cloud data and re-run  

---

## What's Next?

After migration:
1. Update frontend to use Supabase client (I'll create this)
2. Add "Sync Now" button for manual sync
3. Enable multi-device access (log in on phone/tablet)
4. Add real-time collaboration (share papers with healthcare team)

---

**Read the full guide:** [SUPABASE-MIGRATION-GUIDE.md](./SUPABASE-MIGRATION-GUIDE.md)
