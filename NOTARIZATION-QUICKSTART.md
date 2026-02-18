# ⚡ Notarization Quick Start

**Goal:** Build a notarized macOS app you can share with others (no security warnings)

---

## Option 1: Express Setup (5 minutes)

### 1. Create Apple App-Specific Password

1. Go to https://appleid.apple.com/ → Sign in
2. **Sign-In and Security** → **App-Specific Passwords**
3. Click **Generate** → Name it `MyTreatmentPath`
4. Copy the password: `xxxx-xxxx-xxxx-xxxx`

### 2. Save Credentials

```bash
# Copy template to home directory
cp notarize-credentials.template ~/.notarize-credentials

# Edit it (use nano, vim, or VS Code)
nano ~/.notarize-credentials

# Replace these values:
# - APPLE_ID="your-email@example.com"
# - APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"

# Save and load it
source ~/.notarize-credentials

# Make it permanent
echo 'source ~/.notarize-credentials' >> ~/.zshrc
```

### 3. Build Notarized App

```bash
npm run notarize
```

**Wait 5-15 minutes** for Apple to notarize your app.

### 4. Share

Send `build/MyTreatmentPath-0.1.0.dmg` to anyone - **no warnings!** 🎉

---

## Option 2: Manual Build (same result)

```bash
# Load credentials
source ~/.notarize-credentials

# Build
npm run electron:build:mac
```

---

## Option 3: Skip Notarization (local testing only)

```bash
# Build without notarization (faster, but shows warnings on other Macs)
unset APPLE_ID APPLE_APP_SPECIFIC_PASSWORD
npm run electron:build:mac
```

---

## Verify It Worked

```bash
spctl -a -vvv -t install build/MyTreatmentPath.app
```

**Expected:**
```
build/MyTreatmentPath.app: accepted
source=Notarized Developer ID
```

If you see `Notarized Developer ID`, **SUCCESS!** ✅

---

## Troubleshooting

### ❌ "Skipping notarization: APPLE_ID not set"

```bash
# Load credentials
source ~/.notarize-credentials

# Verify
echo $APPLE_ID  # Should print your email
```

### ❌ "Authentication failed"

- Wrong Apple ID email
- Wrong app-specific password
- Used regular password (not app-specific)

**Fix:** Regenerate app-specific password at appleid.apple.com

### ❌ Build takes forever

**Normal!** Notarization takes 5-15 minutes. Coffee time ☕

---

## What Gets Created

```
build/
├── MyTreatmentPath.app               # Signed & notarized app
├── MyTreatmentPath-0.1.0.dmg         # ← Share this!
└── MyTreatmentPath-0.1.0-mac.zip     # ← Or this!
```

---

## Need More Help?

Read the full guide: **NOTARIZATION-SETUP.md**

---

**Ready?** Just run:
```bash
npm run notarize
```
