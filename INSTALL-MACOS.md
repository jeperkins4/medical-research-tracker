# Installing MyTreatmentPath on macOS

## ⚠️ Security Warning (Expected)

macOS will show this warning:

> **"MyTreatmentPath" can't be opened because Apple cannot verify that it does not contain malware.**

**This is normal!** The app isn't signed with an Apple Developer certificate (costs $99/year).

**Your app is safe** - it's just macOS being cautious about unsigned apps.

---

## ✅ How to Install (2 minutes)

### Step 1: Download
Download `MyTreatmentPath-0.1.0-arm64.dmg` from:  
https://github.com/jeperkins4/medical-research-tracker/releases/tag/v0.1.0

### Step 2: Open DMG
Double-click the downloaded DMG file.

### Step 3: Right-Click the App
**DON'T drag to Applications yet!**

1. **Right-click** (or Control+click) on `MyTreatmentPath.app`
2. Select **"Open"** from the menu
3. Click **"Open"** in the warning dialog

The app will launch (proving it's safe).

### Step 4: Drag to Applications
Now drag `MyTreatmentPath.app` to your Applications folder.

### Step 5: Done!
Future launches work normally - no more warnings.

---

## Alternative Method: System Settings

If right-click doesn't work:

1. Try to open the app normally (it will be blocked)
2. Go to **System Settings → Privacy & Security**
3. Scroll down to find the security message
4. Click **"Open Anyway"**
5. Enter your password
6. App will open

---

## Why This Happens

Apple requires developers to:
1. Pay $99/year for a Developer account
2. Sign the app with a certificate
3. Upload to Apple for "notarization"

We're an independent developer and haven't done this yet. The app works perfectly - it's just not "verified" by Apple.

**Your privacy is protected:** All your health data stays 100% local on your Mac. Nothing is sent to Apple or us.

---

## For Advanced Users

If you're comfortable with Terminal:

```bash
# Remove quarantine attribute
xattr -d com.apple.quarantine /Applications/MyTreatmentPath.app

# Or from Downloads folder
xattr -d com.apple.quarantine ~/Downloads/MyTreatmentPath.app
```

This permanently removes the Gatekeeper check for this app.

---

## Still Having Issues?

**Error: "damaged and can't be opened"**
- This means download was corrupted
- Re-download the DMG and try again

**Error: "no disk image to open"**
- Safari may have auto-extracted the DMG
- Look for `MyTreatmentPath.app` in Downloads
- Right-click it → Open

**App crashes on launch:**
- Check you're on macOS 11.0 (Big Sur) or later
- Check you have Apple Silicon (M1/M2/M3)
- Report issue: https://github.com/jeperkins4/medical-research-tracker/issues

---

## Questions?

- GitHub Issues: https://github.com/jeperkins4/medical-research-tracker/issues
- Email: support@mytreatmentpath.com

---

**Thank you for trying MyTreatmentPath!** 🎉
