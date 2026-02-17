# Code Signing Guide for MyTreatmentPath

## Why Users See "Malware Warning"

Your app is **unsigned** - macOS doesn't know who built it, so it blocks installation by default.

**Current status:** Ad-hoc signed (developer testing only)  
**Needed for distribution:** Apple Developer certificate + Notarization

---

## Immediate Workaround (For Users)

**Tell users to do this:**

1. Download MyTreatmentPath-0.1.0-arm64.dmg
2. Open the DMG
3. **Right-click** on MyTreatmentPath.app
4. Select **"Open"** (not drag to Applications)
5. Click **"Open"** in warning dialog
6. App will launch - now drag to Applications
7. Future launches work normally

**Why this works:** Right-click → Open is Apple's official bypass for trusted developers without certificates.

---

## Proper Solution: Get Apple Developer Account

### Step 1: Join Apple Developer Program

**Cost:** $99/year  
**Link:** https://developer.apple.com/programs/enroll/

**Benefits:**
- Sign apps (removes "malware" warning)
- Notarize apps (even smoother install)
- Distribute on Mac App Store (optional)
- TestFlight for beta testing

### Step 2: Create Developer Certificate

**After enrollment:**

1. **Xcode → Settings → Accounts**
2. **Add your Apple ID**
3. **Manage Certificates → + → Developer ID Application**
4. Certificate downloads automatically

**Or via command line:**
```bash
# Request certificate
security create-keychain -p <password> build.keychain
security default-keychain -s build.keychain
security unlock-keychain -p <password> build.keychain

# Apple will email you the certificate
# Download and install in Keychain Access
```

### Step 3: Update electron-builder.yml

```yaml
mac:
  category: public.app-category.medical
  target:
    - dmg
    - zip
  icon: build/icon.icns
  hardenedRuntime: true  # Changed from false
  gatekeeperAssess: false
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist
  identity: "Developer ID Application: John Perkins (TEAM_ID)"  # Add this

dmg:
  sign: true  # Changed from false
```

### Step 4: Build Signed App

```bash
# electron-builder will auto-find your certificate
npm run electron:build:mac

# Or specify identity explicitly
npx electron-builder --mac --sign="Developer ID Application: John Perkins"
```

---

## Step 5: Notarize (Recommended)

**Why:** Even signed apps show a warning. Notarization removes it completely.

### Install Notarization Tool

```bash
npm install --save-dev @electron/notarize
```

### Update electron-builder.yml

```yaml
afterSign: "scripts/notarize.js"
```

### Create scripts/notarize.js

```javascript
const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;

  return await notarize({
    appBundleId: 'com.mytreatmentpath.app',
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_ID_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  });
};
```

### Set Environment Variables

```bash
# In ~/.zshrc or before build
export APPLE_ID="your-apple-id@email.com"
export APPLE_ID_PASSWORD="app-specific-password"  # Generate at appleid.apple.com
export APPLE_TEAM_ID="YOUR_TEAM_ID"  # From developer.apple.com
```

### Build Notarized App

```bash
npm run electron:build:mac
# electron-builder will:
# 1. Sign the app
# 2. Upload to Apple for notarization
# 3. Wait for approval (~2-5 minutes)
# 4. Staple notarization ticket to DMG
```

---

## Cost Breakdown

| Option | Cost | User Experience |
|--------|------|-----------------|
| **Current (unsigned)** | Free | ❌ "Malware" warning, manual bypass needed |
| **Signed only** | $99/year | ⚠️ Warning but easier to bypass |
| **Signed + Notarized** | $99/year | ✅ No warnings, smooth install |

---

## Quick Comparison

### Without Signing (Current)
```
User downloads DMG
→ macOS blocks: "can't verify it doesn't contain malware"
→ User must: Right-click → Open
→ First impression: Sketchy
```

### With Signing
```
User downloads DMG
→ macOS shows: "Developer identified"
→ Still a warning, but less scary
→ First impression: Better
```

### With Signing + Notarization
```
User downloads DMG
→ macOS: No warning
→ Double-click to install
→ First impression: Professional ✅
```

---

## Recommendation

### For Testing/Beta (Current Phase)
**Keep unsigned.** Tell testers to right-click → Open.

**Why:**
- Saves $99/year
- Testers expect this
- Focus on product, not distribution

### For Public Launch
**Get Apple Developer account + Notarize.**

**Why:**
- Professional first impression
- Users trust signed apps
- No friction during install
- Required for Mac App Store (if you go that route)

### For Enterprise/Medical
**Definitely sign + notarize.**

**Why:**
- Medical software needs trust
- IT departments require signed apps
- HIPAA compliance audits check this
- Liability protection

---

## Timeline

### Current State
- ❌ Unsigned
- ✅ Works (with manual bypass)
- ✅ Good for testing

### To Get Signed (1 day)
1. Join Apple Developer Program
2. Wait for approval (~24 hours)
3. Create certificate (~5 minutes)
4. Update config (~5 minutes)
5. Rebuild (~5 minutes)

### To Get Notarized (1 day)
1. Everything above, plus:
2. Generate app-specific password (~5 minutes)
3. Create notarize script (~10 minutes)
4. Test notarization (~30 minutes)
5. Rebuild (~10 minutes, includes upload to Apple)

---

## Alternative: Distribute Without Apple Developer Account

If you don't want to pay $99/year:

### Option A: Direct Download with Instructions
**What you're doing now.** Just document the bypass:

```markdown
## Installation (macOS)

1. Download MyTreatmentPath-0.1.0-arm64.dmg
2. Open the DMG
3. **Right-click** MyTreatmentPath.app → "Open"
4. Click "Open" in the warning
5. Drag to Applications

macOS shows this warning because we're an independent developer.
Your data stays 100% local and private.
```

### Option B: GitHub Releases with Clear Warning
Add to release notes:

```markdown
⚠️ **macOS Security Warning**

macOS will show a warning because this app isn't notarized.
This is normal for independent software.

**To install safely:**
1. Right-click the app → "Open"
2. Click "Open" in the dialog

Your Mac will remember this choice.
```

### Option C: Web-based Version
Build a web app (no download needed):
- No signing required
- No installation friction
- Cross-platform automatically
- Supabase for cloud storage

---

## What I Recommend

### Right Now (Free)
✅ Add installation instructions to:
- GitHub README
- Release notes
- Landing page

Example:
```markdown
### macOS Installation

macOS may show a security warning (we're not App Store verified).

**Safe workaround:**
1. Right-click MyTreatmentPath.app
2. Select "Open"
3. Click "Open" again

This is a one-time step.
```

### Within 3 Months (If Getting Traction)
✅ Get Apple Developer account ($99/year)
✅ Sign + Notarize future releases
✅ Update to v0.2.0 with proper signature

### Long Term (If Going Medical/Enterprise)
✅ Apple Developer account
✅ Notarization
✅ Professional support
✅ Potentially Mac App Store

---

## FAQs

**Q: Is my app actually malware?**  
A: No! macOS shows this for ANY unsigned app. It's just a warning system.

**Q: Can I ship without signing?**  
A: Yes! Many indie apps do. Just document the bypass.

**Q: Will users trust an unsigned app?**  
A: Some will, some won't. Medical users may be more cautious.

**Q: How long does notarization take?**  
A: 2-5 minutes per build (Apple's review process).

**Q: Can I sign old releases?**  
A: No. Must rebuild with signing enabled.

---

## Next Steps

**Choose your path:**

**Path 1: Stay Free (For Now)**
- Update release notes with install instructions
- Add bypass steps to landing page
- Focus on product development

**Path 2: Go Professional (Recommended for Launch)**
- Join Apple Developer Program: https://developer.apple.com/programs/
- Follow setup steps above
- Rebuild v0.1.1 with signature

**Path 3: Web App Instead**
- Build Progressive Web App
- No installation needed
- No code signing needed

Which path makes sense for your timeline and budget?
