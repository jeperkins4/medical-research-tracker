# Apple Notarization - To-Do List

## 🎯 Goal
Get Medical Research Tracker Electron app **notarized by Apple** so users can install without "unidentified developer" warnings.

---

## ✅ What's Already Done

**Code & Scripts (Complete):**
- ✅ `build-notarized.sh` - Automated build + notarization script
- ✅ `NOTARIZATION-QUICKSTART.md` - Quick start guide
- ✅ `NOTARIZATION-SETUP.md` - Detailed setup instructions
- ✅ `electron-builder.yml` - Configured for code signing
- ✅ `package.json` - Build scripts ready

**App is ready to notarize - just needs Apple credentials.**

---

## ❌ What You Need to Do

### Step 1: Get Apple Developer Account (15 min)

**Cost:** $99/year

1. Go to https://developer.apple.com/programs/enroll/
2. Sign in with Apple ID
3. Choose **Individual** account type
4. Pay $99 annual fee
5. Wait for approval (usually instant, can take up to 24 hours)

**You need this to:**
- Get Developer ID Application certificate
- Submit app for notarization
- Distribute outside Mac App Store

---

### Step 2: Request Developer ID Certificate (5 min)

**After Apple Developer account is approved:**

1. Open **Keychain Access** app (in Applications/Utilities)
2. Menu: **Keychain Access → Certificate Assistant → Request a Certificate from a Certificate Authority**
3. Fill in:
   - **User Email:** Your email
   - **Common Name:** Your name
   - **CA Email:** Leave blank
   - **Request is:** Saved to disk
4. Click **Continue**, save as `CertificateSigningRequest.certSigningRequest`
5. Go to https://developer.apple.com/account/resources/certificates/list
6. Click **➕ (plus button)** → Choose **Developer ID Application**
7. Upload the `.certSigningRequest` file
8. Download the certificate (`.cer` file)
9. **Double-click** the `.cer` file to install in Keychain Access

**Verify it's installed:**
```bash
security find-identity -v -p codesigning
```

You should see: `"Developer ID Application: Your Name (TEAM_ID)"`

---

### Step 3: Generate App-Specific Password (2 min)

1. Go to https://appleid.apple.com/account/manage
2. Sign in
3. Under **Security** → **App-Specific Passwords** → Click **Generate**
4. Label: `Medical Research Tracker Notarization`
5. Copy the password (format: `xxxx-xxxx-xxxx-xxxx`)

**Save it - you can't see it again!**

---

### Step 4: Configure Credentials (1 min)

Copy the template:
```bash
cd /Users/perkins/.openclaw/workspace/medical-research-tracker
cp notarize-credentials.template notarize-credentials.sh
```

Edit `notarize-credentials.sh`:
```bash
export APPLE_ID="your-apple-id@example.com"
export APPLE_ID_PASSWORD="xxxx-xxxx-xxxx-xxxx"  # App-specific password from Step 3
export APPLE_TEAM_ID="ABC1234567"                # Found at developer.apple.com/account
```

**How to find TEAM_ID:**
- Go to https://developer.apple.com/account
- Click **Membership** (left sidebar)
- Copy the **Team ID** (10 characters, like `ABC1234567`)

**Make it executable:**
```bash
chmod +x notarize-credentials.sh
```

---

### Step 5: Build & Notarize (5 min)

**Run the automated script:**
```bash
cd /Users/perkins/.openclaw/workspace/medical-research-tracker
./build-notarized.sh
```

**What it does:**
1. Loads credentials from `notarize-credentials.sh`
2. Builds Electron app with `electron-builder`
3. Code signs with your Developer ID certificate
4. Uploads to Apple for notarization
5. Waits for Apple's approval (~2-5 minutes)
6. Staples notarization ticket to the app
7. Creates distributable `.dmg` file

**Expected output:**
```
✅ Building Electron app...
✅ Code signing complete
✅ Uploading to Apple for notarization...
✅ Notarization successful!
✅ Stapling ticket to app...
✅ Done! DMG ready: dist/Medical-Research-Tracker-0.1.0.dmg
```

**Final file:** `dist/Medical-Research-Tracker-0.1.0.dmg`

Users can now download and install **without Gatekeeper warnings**! 🎉

---

## 🔍 Troubleshooting

### "No identity found" Error

**Cause:** Developer ID certificate not installed

**Fix:**
1. Check Keychain Access for "Developer ID Application" certificate
2. If missing, re-do Step 2
3. Verify with: `security find-identity -v -p codesigning`

### "Invalid credentials" Error

**Cause:** Wrong Apple ID or app-specific password

**Fix:**
1. Verify Apple ID is correct (the one with Developer account)
2. Generate new app-specific password (old ones can't be retrieved)
3. Update `notarize-credentials.sh`

### "Team ID not found" Error

**Cause:** Wrong or missing APPLE_TEAM_ID

**Fix:**
1. Go to https://developer.apple.com/account
2. Click **Membership**
3. Copy **Team ID** exactly (case-sensitive)
4. Update `notarize-credentials.sh`

### Notarization Rejected

**Cause:** Usually code signing issues

**Fix:**
1. Check Apple's rejection email for details
2. Common issues:
   - Hardened runtime not enabled (already configured in `electron-builder.yml`)
   - Entitlements missing (already configured)
   - Unsigned native modules (should auto-sign)
3. Re-run `./build-notarized.sh` after fixing

---

## 📚 Resources

**Quick Start:** `NOTARIZATION-QUICKSTART.md` (2-page summary)  
**Detailed Guide:** `NOTARIZATION-SETUP.md` (comprehensive)  
**Build Script:** `build-notarized.sh` (automated build + notarize)  
**Template:** `notarize-credentials.template` (credential format)

**Apple Docs:**
- https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution
- https://developer.apple.com/support/certificates/

**Electron Docs:**
- https://www.electron.build/code-signing
- https://www.electron.build/configuration/mac#notarization

---

## ⏱️ Time Estimate

| Step | Time | Cost |
|------|------|------|
| 1. Apple Developer Account | 15 min | $99/year |
| 2. Developer ID Certificate | 5 min | Free |
| 3. App-Specific Password | 2 min | Free |
| 4. Configure Credentials | 1 min | Free |
| 5. Build & Notarize | 5 min | Free |
| **Total** | **~30 min** | **$99/year** |

**One-time setup, then automated builds forever.**

---

## ✅ Checklist

**Tomorrow's checklist:**
- [ ] Create Apple Developer account ($99)
- [ ] Request Developer ID Application certificate
- [ ] Install certificate in Keychain Access
- [ ] Generate app-specific password
- [ ] Copy `notarize-credentials.template` → `notarize-credentials.sh`
- [ ] Fill in Apple ID, password, Team ID
- [ ] Run `./build-notarized.sh`
- [ ] Test the `.dmg` file on a clean Mac
- [ ] Distribute! 🎉

---

## 🎯 Success Criteria

**You'll know it worked when:**
1. Build script completes without errors
2. Apple sends "Notarization complete" email
3. `.dmg` file opens without "unidentified developer" warning
4. Users can install by dragging to Applications folder
5. App launches without Gatekeeper blocking it

**After notarization, you can distribute the app via:**
- Direct download (website)
- GitHub Releases
- Email/Slack/Dropbox
- Anywhere except Mac App Store (that's a different process)

---

**Start here tomorrow:** Step 1 (Apple Developer account)  
**Estimated completion:** ~30 minutes after Apple approves account

Good luck! 🍀
