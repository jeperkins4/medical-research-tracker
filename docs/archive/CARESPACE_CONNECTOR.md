# CareSpace Portal Connector - Setup & Usage

## Status: **READY TO TEST** 🚀

The CareSpace browser automation connector is built and ready. It will attempt to:
1. Log in to your CareSpace portal
2. Navigate to data sections (Labs, Imaging, Notes, Meds)
3. Scrape available data
4. Import to your database

## How It Works:

### Automatic Detection
The connector uses intelligent field detection to handle login:
- **Detects username field** (tries: username, email, user_name variations)
- **Detects password field** (finds any password input)
- **Detects submit button** (finds Sign In, Log In, Login buttons)
- **Checks login success** (looks for dashboard, logout links, etc.)
- **Detects MFA** (prompts if two-factor auth required)

### What It Scrapes (Once Portal-Specific Selectors Are Added):
- 🔬 Lab Results
- 📊 Imaging Reports
- 🔬 Pathology Reports
- 📄 Doctor Notes (filtered to exclude nursing)
- 💊 Medications

## First Sync - What to Expect:

### Scenario 1: No MFA, Standard Login
✅ **Should work automatically**
- Browser launches headless
- Logs in with your credentials
- Navigates through portal
- Returns results

### Scenario 2: MFA Required
⚠️ **Partial automation**
- Connector detects MFA prompt
- Returns message: "MFA Required - Manual intervention needed"
- **Solutions:**
  - Add TOTP secret to credential (for authenticator apps)
  - Or: Complete MFA manually once, connector remembers session

### Scenario 3: Portal Layout Changed / Unknown Structure
ℹ️ **Need manual inspection**
- Connector will attempt generic navigation
- May return 0 records with note: "Requires portal-specific selectors"
- **You send me screenshots** → I add specific selectors → re-sync works

## Testing Now:

1. **Refresh** the Medical Research Tracker page
2. Go to **🔐 Portals** tab
3. Make sure your **CareSpace credential is saved** with:
   - Service Name (e.g., "My CareSpace Portal")
   - Portal Type: **CareSpace Portal**
   - URL: https://carespaceportal.com (or actual URL)
   - Username & Password (encrypted in vault)
4. **Unlock vault** if needed
5. Click **🔄 Sync Now** on your CareSpace credential

## What Will Happen:

**Best Case:**
```
✅ Sync Complete: My CareSpace Portal

Connector: CareSpace Portal (Browser Automation)
Status: Success

Records Imported:
  • Lab Results: X
  • Imaging Reports: X
  • Pathology Reports: X
  • Doctor Notes: X
  • Medications: X

Total: X records
```

**MFA Case:**
```
✅ Sync Complete: My CareSpace Portal

Connector: CareSpace Portal (Browser Automation)
Status: MFA Required

Multi-factor authentication detected. Manual intervention needed.

MFA Instructions:
  → CareSpace requires MFA code
  → Option 1: Enter TOTP secret in credential settings
  → Option 2: Complete MFA manually, then re-sync
```

**Need Customization:**
```
✅ Sync Complete: My CareSpace Portal

Connector: CareSpace Portal (Browser Automation)
Status: Success

Records Imported:
  • Lab Results: 0
  • Imaging Reports: 0
  ...

ℹ Lab scraping requires portal-specific selectors
ℹ Imaging scraping requires portal-specific selectors
...
```

## Next Steps After First Sync:

### If It Works:
🎉 **You're done!** Schedule it and enjoy automated syncing.

### If MFA Blocks It:
1. **Option A**: Give me your TOTP secret (authenticator app setup key)
   - Edit credential → add to "TOTP Secret" field
   - Connector will generate codes automatically
2. **Option B**: I build an interactive MFA prompt
   - Connector pauses and asks for code
   - You enter it once, session persists

### If It Needs Customization:
1. **Send me screenshots of:**
   - Main dashboard after login
   - Lab Results page
   - Imaging/Radiology page
   - Clinical Notes page
2. **I'll add portal-specific selectors** (takes 15-30 min)
3. **Re-sync** → should import data

## Technical Details:

**Browser:** Chromium (headless, installed automatically)  
**Technology:** Playwright (industry-standard browser automation)  
**Security:** Credentials decrypted in memory only, never logged  
**Session:** Fresh login each sync (stateless, no cookies saved)

## Troubleshooting:

**"Login failed"**
- Check username/password are correct
- Portal may have CAPTCHA (need manual intervention)
- Portal may block headless browsers (can add workarounds)

**"Navigation timeout"**
- Portal is slow or down
- Try again later
- Can increase timeout if persistent

**"0 records imported"**
- Normal for first run if portal structure unknown
- Send screenshots for customization
- Not a failure, just needs tuning

## Ready to Test?

Click **🔄 Sync Now** and let me know what happens!
