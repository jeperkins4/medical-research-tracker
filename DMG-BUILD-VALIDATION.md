# MRT Electron DMG Build Validation

## Known Historical Issues to Test Against

### 1. **NODE_ENV=development in Packaged App** (v0.1.38 fix)
- **Problem:** Bundled `.env` set `NODE_ENV=development`, causing packaged app to load `localhost:5173` (Vite dev server) instead of bundled UI
- **Fix:** Use `!app.isPackaged` instead of `NODE_ENV` check in `electron/main.cjs`
- **Test:** Launch app, verify it loads the bundled UI (not localhost), check for errors in `/tmp/mrt-test.log`

### 2. **better-sqlite3 NODE_MODULE_VERSION Mismatch** (v0.1.38 fix)
- **Problem:** Native module compiled against system Node.js ABI, not Electron's ABI (e.g., v141 vs v143)
- **Error message:** "was compiled against a different Node.js version"
- **Fix:** `npmRebuild: true` in `electron-builder.yml` + postinstall script rebuilds against Electron ABI
- **Test:** App launches without ABI mismatch errors, check `/tmp/mrt-test.log` for "NODE_MODULE_VERSION" or "different Node.js"

### 3. **Playwright Browser Path in Bundle** (v0.1.64 fix)
- **Problem:** Playwright tries to download browsers into read-only app bundle, fails
- **Fix:** Set `PLAYWRIGHT_BROWSERS_PATH` to user data dir in `electron/main.cjs` BEFORE requiring Playwright
- **Test:** App launches without permission errors, no "cannot create directory" messages in logs

### 4. **Code Signing / Notarization Issues** (v0.1.87 issue)
- **Problem:** Broken Electron Framework signing during build, prevents launch with error 163 (launchd spawn failure)
- **Fix:** Build unsigned (identity: null, sign: false) — users will see gatekeeper warning but can allow via System Preferences
- **Test:** App launches (may show gatekeeper warning), no "Launch failed" errors

### 5. **DMG Mount/Eject Issues** (v0.1.87 issue)
- **Problem:** Stale volume mounts prevent DMG creation or ejection
- **Fix:** Use unique volume names, force-detach stale mounts before building, test mount/unmount cycle
- **Test:** DMG mounts cleanly, app launches from mounted volume, detaches without errors

## Build Validation Checklist

```bash
# 1. Build the DMG
npm run electron:build:mac

# 2. Verify file size (should be > 100MB, < 200MB)
ls -lh build/MyTreatmentPath-0.1.87-arm64.dmg

# 3. Mount and test
hdiutil attach -quiet build/MyTreatmentPath-0.1.87-arm64.dmg
/Volumes/MyTreatmentPath/MyTreatmentPath.app/Contents/MacOS/MyTreatmentPath > /tmp/mrt-test.log 2>&1 &
sleep 3

# 4. Verify process running (check for PID)
ps aux | grep MyTreatmentPath | grep -v grep

# 5. Check logs for known errors
grep -E "NODE_MODULE_VERSION|different Node.js|cannot create directory|Launch failed|ABI mismatch" /tmp/mrt-test.log || echo "✅ No known issues found"

# 6. Check that app loaded bundled UI (look for Express server startup messages)
grep -E "Server running|listening on|localhost" /tmp/mrt-test.log || echo "✅ Using bundled files (expected)"

# 7. Clean up
killall MyTreatmentPath 2>/dev/null
sleep 2
hdiutil detach -quiet /Volumes/MyTreatmentPath

# 8. Verify clean detach
mount | grep -i mytreatmentpath || echo "✅ Volume detached cleanly"
```

## Success Criteria

✅ **DMG is valid** if:
- File size is 100-200 MB
- Mounts without errors
- App process starts successfully
- No "NODE_MODULE_VERSION" errors
- No "Launch failed" errors
- No "cannot create directory" errors
- Detaches cleanly without stale mounts
- No localhost:5173 in logs (using bundled UI)

❌ **DMG is invalid** if any of the above fail.

## Version History

- **v0.1.86:** Last known good signed/notarized build (March 16, 2026)
- **v0.1.87:** Current target with 3D radiology viewer, unsigned build (April 3, 2026)
