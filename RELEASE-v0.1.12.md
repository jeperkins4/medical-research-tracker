# MyTreatmentPath v0.1.12 Release

**Released:** February 23, 2026

## 🎉 Major Architecture Improvement

Fixed the "backend server error" issue by **removing HTTP dependency entirely** for core features.

### What Was Wrong

Previous versions (v0.1.9-v0.1.11) used an Express HTTP server (localhost:3000) which:
- Could crash on startup
- Was fragile in production builds  
- Added unnecessary complexity
- Wasn't appropriate for a desktop app

### What's Fixed

v0.1.12 uses **Electron IPC for direct SQLite access**:
- ✅ **Cannot crash** - no HTTP server to fail
- ✅ **Faster** - direct database access
- ✅ **Simpler** - fewer moving parts
- ✅ **More reliable** - true embedded database

## Download

**macOS (Apple Silicon M1/M2/M3):**

```
https://github.com/jeperkins4/medical-research-tracker/releases/download/v0.1.12/MyTreatmentPath-0.1.12-arm64.dmg
```

**Installation:**
1. Download DMG
2. Open it
3. Drag app to Applications folder
4. Launch - opens without warnings (fully notarized)

## Features

### Core Features (Work Immediately - No Setup)
- ✅ Account creation and login
- ✅ Profile management
- ✅ Condition tracking
- ✅ Medication tracking
- ✅ Vitals recording
- ✅ Lab results

### Optional Features (Require API Keys - Configure in Settings)
- 🔬 Research search (Brave API)
- 🤖 AI meal analysis (Anthropic)
- ☁️ Cloud sync (Supabase)

## First Launch

When you open the app for the first time:

1. **Create an account** - username and password (stored locally)
2. **Optional:** Configure API keys for research/AI features
3. **Start tracking** your health data

## Database Location

Your data is stored locally at:
```
~/Library/Application Support/MyTreatmentPath/health.db
```

**Important:** 
- This version creates a **fresh database**
- If upgrading from v0.1.11, you'll need to create a new account
- Your old data is not automatically migrated

## Version Display

The app version now shows in the footer (bottom of the screen).

## Technical Details

See `ARCHITECTURE-CHANGE-v0.1.12.md` for complete technical documentation.

## What's Next

Future improvements:
- Data export/import for migration
- Additional features migrated to IPC
- Database encryption at rest
- Automated backups

## Support

Issues or questions: https://github.com/jeperkins4/medical-research-tracker/issues

---

**Build Info:**
- Version: 0.1.12
- Notarization ID: 35fb72fd-c2dc-4d0e-bff4-ba326fa2f61f
- Status: Accepted ✅
- Fully signed and stapled
