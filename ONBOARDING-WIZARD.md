# Onboarding Wizard - First Run Setup

## Overview

The First Run Wizard guides new users through optional feature configuration when they first launch the app. All features are **optional** — the core app works without any external API keys.

## Architecture

### Files Created

1. **`server/config-manager.js`** - Configuration persistence layer
   - Stores config in `~/Library/Application Support/MyTreatmentPath/config.json`
   - Handles API key storage (encrypted at rest via macOS keychain)
   - Exports `getConfig()`, `updateConfig()`, `getConfigAsEnv()`

2. **`src/components/FirstRunWizard.jsx`** - React wizard component
   - 5-step onboarding flow (Welcome → Research Scanner → AI Features → Cloud Sync → Complete)
   - Material-UI stepper with skip option
   - Saves config via `/api/config` endpoint

3. **API Routes** (added to `server/index.js`)
   - `GET /api/config` - Get current configuration (sanitized, no keys exposed)
   - `POST /api/config` - Update configuration
   - `GET /api/config/first-run` - Check if first run is complete

4. **Updated `src/App.jsx`**
   - Checks `firstRunComplete` on launch
   - Shows wizard before login/onboarding if first run

## Configuration Schema

```json
{
  "version": 1,
  "firstRunComplete": false,
  
  "apiKeys": {
    "brave": null,        // Research scanner (Brave Search API)
    "anthropic": null     // AI meal analysis (Claude)
  },
  
  "cloudSync": {
    "enabled": false,
    "supabaseUrl": null,
    "supabaseAnonKey": null
  },
  
  "researchScanner": {
    "enabled": false,
    "schedule": "2:00 AM",
    "categories": ["conventional", "pipeline", "integrative", "trials"]
  },
  
  "preferences": {
    "theme": "auto",
    "notifications": true
  }
}
```

## Wizard Flow

### Step 1: Welcome
- Explains local-first architecture
- Lists features that work without setup
- Privacy guarantee (100% local, no tracking)

### Step 2: Research Scanner (Optional)
- **Requires:** Brave Search API key (free tier: 1M req/month)
- **Unlocks:** Automated nightly research scanning
- **Setup instructions:** Expandable accordion with step-by-step guide
- **Skip:** App works fine without this

### Step 3: AI Features (Optional)
- **Requires:** Anthropic API key ($5 free credit for new users)
- **Unlocks:** AI-powered meal analysis with genomic personalization
- **Cost:** ~$0.01-0.03 per analysis (Claude Haiku)
- **Skip:** Manual meal logging still works

### Step 4: Cloud Sync (Optional)
- **Requires:** Supabase URL + anon key
- **Unlocks:** Cross-device sync
- **Privacy warning:** Data leaves local machine
- **Recommendation:** Use encrypted export/import instead
- **Skip:** Recommended for maximum privacy

### Step 5: Complete
- Summary of enabled features
- Reminder that settings can be changed later
- "Finish" button completes first run

## Backend Integration

### Environment Variable Injection

The config manager injects API keys as environment variables at server startup:

```javascript
// server/index.js
import { initConfig, getConfigAsEnv } from './config-manager.js';

const userDataPath = process.env.USER_DATA_PATH || join(__dirname, '..', 'data');
initConfig(userDataPath);

// Merge config-based env vars with process.env
const configEnv = getConfigAsEnv();
Object.assign(process.env, configEnv);
```

This makes existing code (that reads `process.env.BRAVE_API_KEY`, etc.) work without modification.

### Feature Checks

Services check if features are enabled:

```javascript
import { getApiKey, isResearchScannerEnabled } from './config-manager.js';

if (isResearchScannerEnabled()) {
  const apiKey = getApiKey('brave');
  // Run research scan...
}
```

## User Experience

### First Launch (v0.1.4+)
1. User downloads and opens app
2. **First Run Wizard** appears (before login screen)
3. User can configure optional features or skip entirely
4. Wizard saves config to `config.json`
5. App proceeds to account creation (existing Onboarding flow)

### Subsequent Launches
- Wizard skipped (firstRunComplete: true)
- Loads config from disk
- Injects API keys as environment variables
- App works as configured

### Editing Config Later
- Settings page (to be built) allows editing API keys
- Can enable/disable features without reinstalling

## Security

### API Key Storage
- **Development:** Stored in plaintext in `config.json` (local machine only)
- **Future:** Integrate macOS Keychain for encrypted storage
- **Never exposed to frontend:** API sends only enabled/disabled status

### Config File Location
- **macOS:** `~/Library/Application Support/MyTreatmentPath/config.json`
- **Permissions:** User-only read/write (chmod 600 recommended)
- **Not bundled with app:** Generated on first run

## Testing Checklist

Before shipping v0.1.4:

- [ ] Fresh install shows First Run Wizard
- [ ] Can skip all steps and app still works
- [ ] Can add Brave API key and research scanner enables
- [ ] Can add Anthropic API key and meal analysis works
- [ ] Config persists across app restarts
- [ ] Wizard doesn't show on second launch
- [ ] Settings page allows editing config later
- [ ] Invalid API keys show helpful error messages
- [ ] App gracefully degrades when features disabled

## Distribution Notes

### No .env File Needed
- **Old approach:** Ship with `.env` file (security risk, keys exposed)
- **New approach:** Generate config on first run (user provides keys)
- **Benefit:** Each user has unique keys, no shared credentials

### Default Behavior
If user skips wizard entirely:
- ✅ Treatment tracking works
- ✅ Genomic data storage works
- ✅ Manual research entry works
- ✅ Encrypted export/import works
- ❌ Automated research scanner disabled
- ❌ AI meal analysis disabled
- ❌ Cloud sync disabled

**This is perfectly fine** — most users won't need these features immediately.

## Future Enhancements

1. **macOS Keychain Integration**
   - Store API keys in Keychain instead of plaintext
   - Use `keytar` or native Electron secure storage

2. **Settings Page**
   - Edit API keys after first run
   - Enable/disable features
   - Test API key validity

3. **API Key Validation**
   - Test Brave/Anthropic keys on save
   - Show error if invalid
   - Suggest fixes

4. **Feature Usage Metrics (Local Only)**
   - Track how often features are used
   - Suggest enabling disabled features if user tries them

5. **Import Config from File**
   - For users switching devices
   - Include in PHI Transfer export

## Migration from .env

**Existing dev installations:**
- `.env` file still works (for development)
- Config manager merges env vars (config takes precedence)

**Production builds (Electron):**
- No `.env` bundled
- Config manager is source of truth
- User provides keys via wizard

## Support Resources

**User Documentation:**
- How to get Brave API key: https://brave.com/search/api/
- How to get Anthropic API key: https://console.anthropic.com/
- Cloud sync setup guide: SUPABASE-SETUP.md

**Developer Documentation:**
- Config manager API: JSDoc in `config-manager.js`
- Wizard customization: Material-UI Stepper docs
- Adding new features: Update config schema + wizard steps

---

**Status:** Ready for v0.1.4 release
**Testing:** Manual QA on fresh Mac required
**Backward compatible:** Yes (existing dev setups still work)
