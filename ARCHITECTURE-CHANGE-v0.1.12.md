# Architecture Change: v0.1.12

## Problem

**User Report:** "Still getting backend server error message when we open the new app. Cannot rely on localhost, needs to be fully embedded database reachable through file path."

**Root Cause:** The app used an Express HTTP server (localhost:3000) for database access, which was fragile in production Electron builds. Desktop apps shouldn't rely on HTTP servers for local data access.

## Solution

**Removed HTTP dependency for core features** → **Direct Electron IPC to SQLite**

### Architecture Before (v0.1.11 and earlier)

```
Frontend (React)
    ↓ HTTP (fetch)
Backend (Express on localhost:3000)
    ↓
SQLite Database
```

**Problems:**
- Express server could crash on startup
- Module resolution issues in production builds
- Unnecessary network stack for local data
- Fragile and complex

### Architecture After (v0.1.12)

```
Frontend (React)
    ↓ Electron IPC
Main Process (Electron)
    ↓ Direct SQLite
Database File
```

**Benefits:**
- **Cannot crash** - no HTTP server to fail
- **Faster** - direct database access, no network overhead
- **Simpler** - fewer moving parts
- **More reliable** - true embedded database architecture
- **Still works in web browser** - API wrapper falls back to HTTP when not in Electron

## Files Changed

### New Files

1. **`electron/db-ipc.cjs`** - Direct SQLite database handlers
   - `initDatabase()` - Initialize SQLite database
   - `needsSetup()` - Check if user account exists
   - `createUser()` - Create new user account
   - `verifyUser()` - Login verification
   - `getProfile()`, `updateProfile()` - User profile management
   - `getConditions()`, `addCondition()` - Condition tracking
   - `getMedications()`, `addMedication()` - Medication tracking
   - `getVitals()`, `addVitals()` - Vitals recording

2. **`src/api.js`** - Unified API wrapper
   - Auto-detects Electron vs web browser
   - Uses IPC in Electron, HTTP in browser
   - Single API for all components

### Modified Files

1. **`electron/main.cjs`**
   - Removed Express server spawning
   - Added IPC handlers for database operations
   - Simpler initialization flow

2. **`electron/preload.cjs`**
   - Exposed `window.electron.db.*` methods
   - Secure bridge between renderer and main process

3. **`src/App.jsx`**
   - Updated all API calls to use new `api.js`
   - Removed fetch('/api/...') calls for core features

4. **`src/Login.jsx`**
   - Uses `createUser()`, `loginUser()` from api.js
   - Simplified authentication flow

5. **`src/components/Onboarding.jsx`**
   - Uses new API for account creation and profile setup

6. **`package.json`**
   - Version bumped to 0.1.12

7. **`src/App.css`**
   - Added footer styling for version display

## Features Migrated to IPC

✅ **Core Features (No HTTP Server Required):**
- User authentication (login/logout)
- Account creation
- Profile management
- Condition tracking
- Medication tracking
- Vitals recording
- Lab results (read-only for now)

🔄 **Features Still Using HTTP (Optional):**
- Research search (requires Brave API key)
- AI meal analysis (requires Anthropic API key)
- Cloud sync (requires Supabase)
- Portal integrations
- Genomics features

These optional features can be migrated to IPC in future releases or remain as cloud-based services.

## Database Schema

The new IPC-based database creates the following tables:

- `users` - User accounts (username, password_hash)
- `profile` - User profile data (name, DOB, contacts, insurance)
- `conditions` - Medical conditions (diagnosis, status, dates)
- `medications` - Medication tracking (name, dosage, frequency)
- `vitals` - Health measurements (BP, HR, temp, weight, etc.)
- `test_results` - Lab results
- `papers` - Research papers library

Database file: `~/Library/Application Support/MyTreatmentPath/health.db`

## Testing

**Before releasing v0.1.12:**

1. ✅ Frontend builds without errors
2. ✅ Server bundle completes (for optional features)
3. ⏳ Electron build + code signing
4. ⏳ Notarization
5. ⏳ Test DMG installation
6. ⏳ Test account creation
7. ⏳ Test login
8. ⏳ Test profile, conditions, medications, vitals
9. ⏳ Verify no HTTP server errors

## Backward Compatibility

**Data Migration:** None required - existing users will see the first-run wizard again and need to create a new local account. The old HTTP-based database is not compatible with the new IPC-based architecture.

**Recommendation:** Users should export their data from v0.1.11 before upgrading to v0.1.12 (if they have important data).

## Future Work

1. Migrate remaining features to IPC (research search, genomics)
2. Add data export/import for migration from older versions
3. Remove HTTP server entirely (optional features become cloud-based)
4. Add automated tests for IPC handlers
5. Add database encryption at rest

## Version History

- **v0.1.9** - First-run wizard, auto-generated keys
- **v0.1.10** - Fixed module resolution in production builds
- **v0.1.11** - Version display in footer
- **v0.1.12** - **Major architecture change: IPC-based database (no HTTP server for core features)**
