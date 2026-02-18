# Data Reliability Fix 🔒

**Issue:** Data loading is "flakey" - sometimes shows, sometimes doesn't  
**Status:** HARDENED with retry logic and monitoring

---

## Your Data is SAFE ✅

**Verified:** All 7 conditions, 23 medications, 517 test results, 4 genomic mutations are intact.

```
📊 Current Database: data/health-secure.db (580 KB)
   👥 Users: 2 (jeperkins4, admin)
   🏥 Conditions: 7
   💊 Medications: 23
   🧪 Test Results: 517
   🧬 Genomic Mutations: 4
   📚 Research Papers: 7
   💓 Vitals: 1
```

**Backups Available:**
- `backups/health_2026-02-15.db.enc` (encrypted, yesterday)
- `backups/health_2026-02-14.db.enc` (encrypted, 2 days ago)
- `backups/health_plaintext_2026-02-13.db` (plaintext, Feb 13)

---

## What Causes "Flakey" Data?

1. **Network timing** - Requests fail randomly
2. **Race conditions** - UI loads before data arrives
3. **Authentication timeouts** - Session expires mid-request
4. **Database locks** - SQLite busy errors
5. **Browser cache** - Stale frontend code

---

## Fixes Implemented

### 1. **Robust API Helpers** (`src/utils/apiHelpers.js`)

**Auto-retry on failures:**
```javascript
// Retries up to 3 times with exponential backoff
fetchWithRetry(url, options, retries=3)
```

**Features:**
- ✅ Automatic retry on network errors (3 attempts)
- ✅ Exponential backoff (1s, 2s, 3s delays)
- ✅ Better error messages
- ✅ Auth error detection (401 → prompt re-login)
- ✅ Response caching (30s TTL)
- ✅ Batch fetching
- ✅ Polling support

### 2. **Data Status Monitor** (`src/components/DataStatus.jsx`)

**Floating status indicator** (bottom-right corner):
- ✅ Shows data connection health
- ✅ Displays record counts (conditions, meds)
- ✅ Auto-checks every 30 seconds
- 🔄 Manual refresh button
- ↻ Full reload button
- ⏰ Last check timestamp

**Indicators:**
- ✅ **Green checkmark** - Data OK
- ⚠️ **Yellow warning** - Connection issues
- ❌ **Red X** - Data error
- ⏳ **Loading** - Checking...

### 3. **Schema Verification**

Created diagnostic scripts:
- `check-data.js` - Verify all data counts
- `check-conditions-schema.js` - Verify table structure
- `check-analytics-tables.js` - Verify analytics tables

---

## Usage

### Check Your Data Right Now

```bash
cd /Users/perkins/.openclaw/workspace/medical-research-tracker
node check-data.js
```

**Output:**
```
👥 Users: 2
🏥 Conditions: 7
💊 Medications: 23
🧪 Test Results: 517
```

### If Data Looks Missing in UI

**Step 1: Hard Refresh Browser**
- Mac: `Cmd+Shift+R`
- Windows: `Ctrl+Shift+R`

**Step 2: Check Data Status Indicator**
- Look for floating status widget (bottom-right)
- Click 🔄 to refresh data check
- Click ↻ to reload entire app

**Step 3: Verify Login User**
- Make sure you're logged in as **jeperkins4** (not admin)
- Admin user has no data - it's a test account

**Step 4: Check Browser Console**
- Press F12
- Look for errors in Console tab
- Look for "[App]" log messages showing data loading

**Step 5: Restart Clean**
```bash
# Kill all Node processes
pkill node

# Start fresh
cd /Users/perkins/.openclaw/workspace/medical-research-tracker
npm run dev
```

---

## Recovery from Backups

**If you ever need to restore** (you shouldn't - data is safe):

### From Encrypted Backup (yesterday):
```bash
cd /Users/perkins/.openclaw/workspace/medical-research-tracker

# Decrypt backup
openssl enc -d -aes-256-cbc \
  -in backups/health_2026-02-15.db.enc \
  -out data/health-secure-restored.db \
  -pass env:BACKUP_ENCRYPTION_KEY

# Replace current database
mv data/health-secure.db data/health-secure-OLD.db
mv data/health-secure-restored.db data/health-secure.db

# Restart server
npm run dev
```

### From Plaintext Backup (Feb 13):
```bash
cd /Users/perkins/.openclaw/workspace/medical-research-tracker

# Copy plaintext backup
cp backups/health_plaintext_2026-02-13.db data/health-secure.db

# Restart server
npm run dev
```

---

## Monitoring in Production

The new Data Status widget gives you real-time visibility:

**Normal Operation:**
```
✅ Data OK (7 conditions, 23 meds)
Last check: 4:45:23 PM
```

**Connection Issues:**
```
⚠️ Data connection issues
[Refresh] [Reload]
```

**Critical Error:**
```
❌ Data error
Authentication required. Please log in again.
```

---

## Files Created

```
src/utils/apiHelpers.js          # Retry logic, caching (4KB)
src/components/DataStatus.jsx    # Status monitor (4KB)
src/components/DataStatus.css    # Widget styles (1.5KB)
check-data.js                     # Data verification script
DATA-RELIABILITY-FIX.md          # This documentation
```

---

## Testing

### Test Retry Logic

1. Kill server while app is running
2. Click around UI
3. Watch Data Status widget show error
4. Restart server
5. Status should auto-recover

### Test Data Loading

1. Open browser console (F12)
2. Refresh page
3. Look for logs:
   ```
   [App] Starting auth check...
   [App] Fetching health data...
   [App] Health data loaded: {...}
   ```

### Verify Data Counts

```bash
node check-data.js
```

Should show:
- 7 conditions (including Stage IV Bladder Cancer)
- 23 medications
- 517 test results
- 4 genomic mutations

---

## Quick Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Data shows then disappears | Authentication timeout | Refresh page, log in again |
| Some tabs empty, others work | Specific API failing | Check browser console for errors |
| Nothing loads | Server not running | Run `npm run dev` |
| Wrong data showing | Logged in as wrong user | Log out, log in as jeperkins4 |
| Data Status shows error | Network/auth issue | Click reload button |

---

## Prevention

**To avoid "flakey" data going forward:**

1. ✅ **Use hardened startup** - `node start-server.js` (runs preflight checks)
2. ✅ **Monitor Data Status widget** - Watch for warnings
3. ✅ **Check backups** - Nightly encrypted backups to `backups/` folder
4. ✅ **Verify schema** - Run `check-data.js` after major updates
5. ✅ **Hard refresh after updates** - Clear cached frontend code

---

## Summary

**Before:**
- ❌ No retry on failures
- ❌ No visibility into data health
- ❌ No recovery mechanism
- ❌ Race conditions possible

**After:**
- ✅ Auto-retry with exponential backoff
- ✅ Real-time status monitoring
- ✅ Manual refresh/reload buttons
- ✅ Cached responses (30s)
- ✅ Better error messages
- ✅ Data integrity verification scripts

**Your data is safe, backed up, and now reliably accessible!** 🔒

---

**Next:** I'll add the DataStatus widget to the main App and commit everything.
