# ✅ Notarization Setup Complete!

Your Electron app is now configured for macOS code signing and notarization.

---

## What Was Configured

### 1. **Electron Builder Config** (`electron-builder.yml`)
- ✅ Added `afterSign: build/notarize.js`
- ✅ Added `notarize.teamId: "7UU4H2GZAW"`
- ✅ Configured hardened runtime
- ✅ Set up entitlements
- ✅ DMG and ZIP output

### 2. **Notarization Script** (`build/notarize.js`)
- ✅ Uses `@electron/notarize` package
- ✅ Reads credentials from environment variables
- ✅ Gracefully skips if credentials missing
- ✅ Detailed logging for debugging

### 3. **Build Helper Script** (`build-notarized.sh`)
- ✅ Checks for credentials
- ✅ Loads from `~/.notarize-credentials` if available
- ✅ Shows progress during build
- ✅ Verifies notarization when complete

### 4. **NPM Script** (`package.json`)
- ✅ Added `npm run notarize` shortcut

### 5. **Documentation**
- ✅ `NOTARIZATION-QUICKSTART.md` - 5-minute setup guide
- ✅ `NOTARIZATION-SETUP.md` - Comprehensive reference
- ✅ `notarize-credentials.template` - Credentials template

---

## Next Steps (First Time Setup)

### Step 1: Create App-Specific Password (2 minutes)

1. Go to https://appleid.apple.com/
2. Sign in with your Apple ID
3. Navigate to **Sign-In and Security** → **App-Specific Passwords**
4. Click **Generate** → Name it `MyTreatmentPath Notarization`
5. Copy the password (format: `xxxx-xxxx-xxxx-xxxx`)

### Step 2: Save Credentials (1 minute)

```bash
cd /Users/perkins/.openclaw/workspace/medical-research-tracker

# Copy template
cp notarize-credentials.template ~/.notarize-credentials

# Edit with your values
nano ~/.notarize-credentials
```

**Replace:**
- `APPLE_ID="your-apple-id@email.com"` → Your actual Apple ID
- `APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"` → Password from Step 1

**Save and load:**
```bash
source ~/.notarize-credentials

# Make it permanent
echo 'source ~/.notarize-credentials' >> ~/.zshrc
```

### Step 3: Build Notarized App (5-15 minutes)

```bash
npm run notarize
```

**What happens:**
1. Builds Vite frontend
2. Packages Electron app
3. Signs with Developer ID certificate
4. **Submits to Apple for notarization** (5-15 min wait)
5. Staples notarization ticket
6. Creates DMG and ZIP

### Step 4: Distribute (1 minute)

Share `build/MyTreatmentPath-0.1.0.dmg` via:
- AirDrop
- Email
- Dropbox/Google Drive
- USB drive

**Recipients will:**
1. Double-click DMG
2. Drag to Applications
3. Launch - **no warnings!** ✅

---

## Future Builds (After Initial Setup)

Once credentials are saved, just run:

```bash
npm run notarize
```

That's it! The script handles everything.

---

## Quick Commands Reference

**Build notarized app:**
```bash
npm run notarize
```

**Build WITHOUT notarization (faster, local testing):**
```bash
unset APPLE_ID APPLE_APP_SPECIFIC_PASSWORD
npm run electron:build:mac
```

**Verify notarization:**
```bash
spctl -a -vvv -t install build/MyTreatmentPath.app
```

**Check notarization status:**
```bash
xcrun notarytool history --apple-id "$APPLE_ID" --password "$APPLE_APP_SPECIFIC_PASSWORD" --team-id "7UU4H2GZAW"
```

---

## Files & Locations

**Source files:**
- `electron-builder.yml` - Build configuration
- `build/notarize.js` - Notarization script
- `build-notarized.sh` - Helper script
- `package.json` - NPM scripts

**Credentials:**
- `~/.notarize-credentials` - Your Apple credentials (KEEP PRIVATE!)

**Build output:**
- `build/MyTreatmentPath.app` - Signed & notarized app
- `build/MyTreatmentPath-0.1.0.dmg` - DMG installer ← **Share this!**
- `build/MyTreatmentPath-0.1.0-mac.zip` - ZIP archive ← **Or this!**

**Documentation:**
- `NOTARIZATION-QUICKSTART.md` - Quick start guide
- `NOTARIZATION-SETUP.md` - Comprehensive guide
- `NOTARIZATION-COMPLETE.md` - This file

---

## Security Notes

⚠️ **NEVER commit credentials to Git!**
- `~/.notarize-credentials` is in your home directory (safe)
- `notarize-credentials.template` is a template (no real values)
- Environment variables only loaded during build

✅ **Best practices:**
- Use app-specific password (NOT your main Apple password)
- Store in password manager (1Password, etc.)
- Don't share credentials with anyone
- Rotate password annually

---

## Cost

- **Apple Developer Program:** $99/year (required, you already have)
- **Notarization:** FREE
- **Code signing:** FREE
- **Total:** $0 (already paid for dev account)

---

## Testing Checklist

Before sharing with others:

- [ ] Created app-specific password at appleid.apple.com
- [ ] Saved credentials to `~/.notarize-credentials`
- [ ] Loaded credentials: `source ~/.notarize-credentials`
- [ ] Built app: `npm run notarize`
- [ ] Saw "✅ Notarization complete!" in console
- [ ] Verified: `spctl -a -vvv -t install build/MyTreatmentPath.app`
- [ ] Tested DMG on YOUR Mac (no warnings)
- [ ] Tested DMG on ANOTHER Mac (ask friend/family)

---

## Support

**Questions?** Check these docs:
1. `NOTARIZATION-QUICKSTART.md` - Quick setup
2. `NOTARIZATION-SETUP.md` - Detailed guide
3. Troubleshooting section in setup guide

**Common issues:**
- Credentials not loaded → `source ~/.notarize-credentials`
- Wrong password → Regenerate at appleid.apple.com
- Notarization slow → Normal! Wait 15 minutes

---

## Ready to Build?

**First time:**
1. Create app-specific password (2 min)
2. Save to `~/.notarize-credentials` (1 min)
3. Run `npm run notarize` (5-15 min)

**Future builds:**
```bash
npm run notarize
```

---

**Status:** ✅ READY TO USE  
**Created:** February 18, 2026  
**Configuration:** COMPLETE  
**Next Step:** Create app-specific password and run `npm run notarize`

🎉 **Your app is ready for distribution!**
