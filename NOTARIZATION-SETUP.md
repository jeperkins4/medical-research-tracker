# 🔐 macOS Notarization Setup Guide

This guide will walk you through notarizing your Electron app so you can distribute it to others without security warnings.

## Prerequisites

✅ **Apple Developer Account** ($99/year)  
✅ **Developer ID Certificate** installed in Keychain (already have: "John Perkins (7UU4H2GZAW)")  
⬜ **App-Specific Password** (we'll create this)

---

## Step 1: Create App-Specific Password

1. Go to https://appleid.apple.com/
2. Sign in with your Apple ID
3. Navigate to **Sign-In and Security** → **App-Specific Passwords**
4. Click **Generate an app-specific password**
5. Name it: `MyTreatmentPath Notarization`
6. Copy the password (format: `xxxx-xxxx-xxxx-xxxx`)
7. **Save it securely** - you can't see it again!

---

## Step 2: Set Environment Variables

Create a file `~/.notarize-credentials` (one-time setup):

```bash
export APPLE_ID="your-apple-id@email.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="7UU4H2GZAW"
```

**Replace:**
- `your-apple-id@email.com` with your actual Apple ID email
- `xxxx-xxxx-xxxx-xxxx` with the app-specific password you just created

**Make it permanent** (add to your shell profile):

```bash
# For zsh (default on macOS):
echo 'source ~/.notarize-credentials' >> ~/.zshrc
source ~/.zshrc

# Or for bash:
echo 'source ~/.notarize-credentials' >> ~/.bash_profile
source ~/.bash_profile
```

**Verify it works:**
```bash
echo $APPLE_ID
# Should print your Apple ID email
```

---

## Step 3: Build & Notarize

### Option A: Full Build (Recommended)

```bash
cd /Users/perkins/.openclaw/workspace/medical-research-tracker
npm run electron:build:mac
```

**What happens:**
1. ✅ Builds Vite frontend → `dist/`
2. ✅ Packages Electron app → `build/MyTreatmentPath.app`
3. ✅ Signs app with Developer ID certificate
4. ✅ **Notarizes app with Apple** (5-15 minutes)
5. ✅ Staples notarization ticket to app
6. ✅ Creates DMG installer → `build/MyTreatmentPath-0.1.0.dmg`
7. ✅ Creates ZIP archive → `build/MyTreatmentPath-0.1.0-mac.zip`

### Option B: Skip Notarization (Faster)

If you just want to test locally:

```bash
# Temporarily unset credentials to skip notarization
unset APPLE_ID APPLE_APP_SPECIFIC_PASSWORD
npm run electron:build:mac
```

App will be **signed** but not **notarized** (works on your Mac, warning on others).

---

## Step 4: Verify Notarization

After building, verify the app is properly notarized:

```bash
spctl -a -vvv -t install build/MyTreatmentPath.app
```

**Expected output:**
```
build/MyTreatmentPath.app: accepted
source=Notarized Developer ID
```

If you see `source=Notarized Developer ID`, **SUCCESS!** 🎉

---

## Step 5: Distribute

### Method 1: DMG Installer (Recommended)

Send `build/MyTreatmentPath-0.1.0.dmg` to others.

**Recipient experience:**
1. Double-click DMG
2. Drag app to Applications folder
3. Launch app - **no warnings!**

### Method 2: ZIP Archive

Send `build/MyTreatmentPath-0.1.0-mac.zip` to others.

**Recipient experience:**
1. Unzip archive
2. Move app to Applications
3. Launch app - **no warnings!**

### Method 3: AirDrop

1. Open Finder → `build/` folder
2. Right-click `MyTreatmentPath.app`
3. Share → AirDrop

---

## Troubleshooting

### ❌ "Skipping notarization: APPLE_ID not set"

**Fix:** Environment variables not loaded. Run:
```bash
source ~/.notarize-credentials
echo $APPLE_ID  # Verify it prints your email
```

### ❌ "Authentication failed"

**Causes:**
- Wrong Apple ID email
- Wrong app-specific password
- Regular password used instead of app-specific password

**Fix:** Regenerate app-specific password at appleid.apple.com

### ❌ "Notarization timed out"

**Cause:** Apple's notarization servers are slow (normal)

**Fix:** Wait 15-30 minutes and the build will complete

### ❌ "Invalid Developer ID certificate"

**Cause:** Certificate expired or not installed

**Fix:** 
1. Open **Keychain Access**
2. Check for "Developer ID Application: John Perkins (7UU4H2GZAW)"
3. If expired, renew at developer.apple.com

### ❌ "App is damaged and can't be opened"

**Cause:** Notarization wasn't stapled to the app

**Fix:** Manually staple:
```bash
xcrun stapler staple build/MyTreatmentPath.app
```

---

## Files Changed

**electron-builder.yml:**
- Added `afterSign: build/notarize.js`
- Added `notarize.teamId: "7UU4H2GZAW"`

**build/notarize.js:** (new)
- Handles notarization using `@electron/notarize`
- Checks for environment variables
- Gracefully skips if credentials missing

**package.json:**
- Added `@electron/notarize` dev dependency

---

## Build Artifacts

After successful build:

```
build/
├── MyTreatmentPath.app               # Signed & notarized app
├── MyTreatmentPath-0.1.0.dmg         # DMG installer (signed & notarized)
├── MyTreatmentPath-0.1.0-mac.zip     # ZIP archive (signed & notarized)
└── mac/                              # Build metadata
```

**Distribute:** Send the `.dmg` or `.zip` file

---

## Security Notes

⚠️ **NEVER commit credentials to Git**
- `~/.notarize-credentials` is in your home directory (safe)
- Environment variables are loaded at build time only
- App-specific password is NOT your Apple ID password

✅ **Best practices:**
- Use app-specific password (not main password)
- Rotate password annually
- Store in password manager (1Password, etc.)

---

## Cost

- **Apple Developer Program:** $99/year (required)
- **Notarization:** FREE (included with developer account)
- **Code signing:** FREE (included)

---

## Testing Checklist

Before distributing:

- [ ] Build app: `npm run electron:build:mac`
- [ ] Check console for "✅ Notarization complete!"
- [ ] Verify notarization: `spctl -a -vvv -t install build/MyTreatmentPath.app`
- [ ] Test DMG on YOUR Mac (should open without warnings)
- [ ] Test DMG on ANOTHER Mac (ask friend/family to test)
- [ ] Confirm no "unidentified developer" warning

---

## Quick Reference

**Build signed & notarized app:**
```bash
npm run electron:build:mac
```

**Check notarization status:**
```bash
spctl -a -vvv -t install build/MyTreatmentPath.app
```

**Manually notarize (if needed):**
```bash
xcrun notarytool submit build/MyTreatmentPath-0.1.0.dmg \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait
```

**Check notarization history:**
```bash
xcrun notarytool history --apple-id "$APPLE_ID" --password "$APPLE_APP_SPECIFIC_PASSWORD" --team-id "$APPLE_TEAM_ID"
```

---

## Ready to Build?

1. ✅ Create app-specific password at appleid.apple.com
2. ✅ Save credentials to `~/.notarize-credentials`
3. ✅ Source credentials: `source ~/.notarize-credentials`
4. ✅ Run: `npm run electron:build:mac`
5. ✅ Wait 5-15 minutes for notarization
6. ✅ Share `build/MyTreatmentPath-0.1.0.dmg` with others!

**Questions?** Check the troubleshooting section or run `npm run electron:build:mac` and paste any errors.

---

**Status:** ✅ READY TO USE  
**Created:** February 18, 2026  
**For:** MyTreatmentPath Electron App
