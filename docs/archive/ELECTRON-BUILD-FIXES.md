# Electron Build Fixes - Feb 19, 2026

This document tracks the issues encountered and fixed during the Electron app packaging process.

## Issues Fixed

### 1. UI Shows Marketing Website Instead of App (19:59 EST)
**Problem:** App loaded the marketing landing page instead of the health tracker UI.

**Root Cause:** 
- Vite was building with absolute paths (`/assets/index.js`)
- Electron uses `file://` protocol where absolute paths resolve to filesystem root
- Assets failed to load → blank/error state → somehow showed website

**Solution:**
```javascript
// vite.config.js
export default defineConfig({
  base: './', // Use relative paths for Electron
  // ...
});
```

**Result:** Assets now load as `./assets/index.js` which works with `file://` protocol.

---

### 2. Backend Startup Failure (19:53 EST)
**Problem:** "Failed to start the backend server. Please check the logs."

**Root Cause:**
- Production mode requires `JWT_SECRET`, `DB_ENCRYPTION_KEY`, `ALLOWED_ORIGINS`
- Packaged app doesn't have `.env` file
- Server config validator rejected startup

**Solution:**
```javascript
// electron/main.cjs
function getAppSecrets() {
  const secretsPath = path.join(app.getPath('userData'), '.app-secrets.json');
  if (fs.existsSync(secretsPath)) {
    return JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
  }
  const secrets = {
    JWT_SECRET: crypto.randomBytes(64).toString('base64'),
    DB_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'),
    BACKUP_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex')
  };
  fs.writeFileSync(secretsPath, JSON.stringify(secrets, null, 2), { mode: 0o600 });
  return secrets;
}
```

**Result:** Secrets auto-generated on first run, saved to `~/Library/Application Support/medical-research-tracker/.app-secrets.json`

---

### 3. Native Module Loading (19:26 EST)
**Problem:** Server crashed silently on startup due to `better-sqlite3-multiple-ciphers` native module.

**Root Cause:**
- Native modules packed inside `app.asar` can't load properly
- `better-sqlite3` needs to be accessible as regular files

**Solution:**
```yaml
# electron-builder.yml
asarUnpack:
  - node_modules/better-sqlite3-multiple-ciphers/**/*
  - server/**/*
  - data/**/*
```

**Result:** Native modules and server code unpacked to `app.asar.unpacked/` directory.

---

### 4. Python distutils Error (Attempted but abandoned)
**Problem:** `electron-rebuild` failed with `ModuleNotFoundError: No module named 'distutils'`

**Root Cause:** Python 3.12+ removed `distutils` module, breaking `node-gyp`

**Attempted Solution:** Install `setuptools` to restore `distutils`

**Actual Solution:** Skip rebuild entirely, use `asarUnpack` instead (see #3)

---

### 5. Duplicate Code Signing Certificate (14:17 EST)
**Problem:** `codesign: ambiguous (matches ... in System.keychain and ... in login.keychain-db)`

**Root Cause:** Same Developer ID certificate existed in two keychains

**Solution:**
```yaml
# electron-builder.yml
mac:
  identity: "DA7B788C70B5FD6A1507950B3F31B7ACC32EDA1B"  # Use hash instead of name
```

**Result:** Electron Builder uses certificate hash for unambiguous identification.

---

## Final Working Configuration

### vite.config.js
```javascript
export default defineConfig({
  plugins: [react()],
  base: './', // ← Critical for Electron
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
```

### electron-builder.yml
```yaml
npmRebuild: false
nodeGypRebuild: false
asarUnpack:
  - node_modules/better-sqlite3-multiple-ciphers/**/*
  - server/**/*
  - data/**/*

mac:
  identity: "DA7B788C70B5FD6A1507950B3F31B7ACC32EDA1B"
  hardenedRuntime: true
  notarize: true
```

### electron/main.cjs
- Auto-generates app secrets on first launch
- Uses Electron's Node binary for ES module support
- Proper stdout/stderr logging for debugging
- Unpacked resource path handling for production

---

## Build & Test Commands

```bash
# Clean build
rm -rf build/mac-arm64 dist node_modules/.vite
npm run build
npm run electron:build:mac

# Test from command line (see logs)
./build/mac-arm64/MyTreatmentPath.app/Contents/MacOS/MyTreatmentPath

# Test normally
open build/mac-arm64/MyTreatmentPath.app

# Verify backend
curl http://localhost:3000/api/ping
```

---

## Lessons Learned

1. **Always use relative paths** in Vite when building for Electron
2. **Native modules** must be unpacked from asar (use `asarUnpack`)
3. **Environment variables** don't transfer to packaged apps (generate at runtime)
4. **Certificate duplicates** cause signing ambiguity (use hash or delete duplicates)
5. **Test from CLI** to see actual error messages (GUI dialogs hide details)
6. **Skip unnecessary rebuilds** - `asarUnpack` is often simpler than `electron-rebuild`

---

## Future Improvements

- [ ] Implement Apple notarization (requires $99/year Developer account)
- [ ] Add Intel Mac build (`--mac --x64`)
- [ ] Add Windows build (`--win`)
- [ ] Add Linux build (`--linux`)
- [ ] Implement auto-update mechanism
- [ ] Code splitting to reduce bundle size (currently 2MB)
- [ ] Add crash reporting (Sentry or similar)

---

**Total debug time:** ~3 hours  
**Issues resolved:** 5 major, 3 minor  
**Final result:** Fully working signed macOS app ✅
