# QA Hardening Checklist & Test Strategy
**Medical Research Tracker (MyTreatmentPath)**  
**Version:** v0.1.67+ | **QA Lead:** Jor-El | **Date:** 2026-03-03

> **Context:** PHI/HIPAA app. AES-256-GCM encryption at application layer. Electron-packaged. SQLite (better-sqlite3). Research scanner hits live APIs. Auth via JWT+cookies. Every regression here costs real health outcomes.

---

## 🔴 RISK MATRIX

| Risk | Likelihood | Impact | Priority |
|------|-----------|--------|----------|
| Auth token not invalidated on logout | Medium | 🔴 Critical | P0 |
| DB migration partial failure corrupts data | Low | 🔴 Critical | P0 |
| Encryption key loss = permanent PHI loss | Low | 🔴 Critical | P0 |
| Research scanner hangs/crashes → silent no results | High | 🟠 High | P1 |
| Electron packaged build missing server bundle | Medium | 🔴 Critical | P0 |
| JWT_SECRET left as default in production build | High | 🔴 Critical | P0 |
| Portal scraper credentials stored in plaintext | Medium | 🔴 Critical | P0 |
| White-screen regression on tab navigation | High | 🟠 High | P1 |
| Migration runs twice on re-open (no idempotency) | Medium | 🟠 High | P1 |
| Scanner results deduplication failure | Medium | 🟡 Medium | P2 |
| Backup/restore data integrity | Low | 🔴 Critical | P0 |
| Notarization not applied to new build | Medium | 🟠 High | P1 |
| AI summary key exposed in packaged build | Medium | 🔴 Critical | P0 |

---

## ✅ SECTION 1: SMOKE TESTS
*Run these first. If any fail, stop and fix before proceeding.*

### 1.1 Server Startup
```bash
# Must start clean with no errors
cd /Users/perkins/.openclaw/workspace/medical-research-tracker
node server/index.js &
sleep 3
curl -s http://localhost:3001/api/health | python3 -m json.tool
# EXPECT: {"status":"ok"} or similar — not connection refused, not 500
```

- [ ] Server starts on port 3001 without errors
- [ ] Health endpoint responds `200 OK`
- [ ] No `JWT_SECRET` warning printed (check if it's using default)
- [ ] DB initializes without migration errors
- [ ] `data/health.db` exists and is readable

### 1.2 Dev Server (Vite + Express)
```bash
npm run dev
# Open http://localhost:5173
```
- [ ] Login page renders (no white screen)
- [ ] Login with `jeperkins4` / `health2024` succeeds
- [ ] Dashboard loads with data (not empty)
- [ ] No console errors on initial load

### 1.3 Electron Dev Mode
```bash
npm run electron:dev
```
- [ ] App window opens
- [ ] Login works inside Electron
- [ ] No IPC errors in DevTools console
- [ ] Window title correct

---

## ✅ SECTION 2: AUTH / LOGIN FLOWS

### 2.1 Happy Path
- [ ] Valid credentials → JWT cookie set → dashboard loads
- [ ] Cookie is `HttpOnly` (verify in browser DevTools → Application → Cookies)
- [ ] `auth_token` cookie has `SameSite=Strict` or `Lax`
- [ ] Token expiry is 7 days (check JWT payload: `exp` field)

### 2.2 Failure Modes
- [ ] Wrong password → stays on login, shows error message (no crash)
- [ ] Wrong username → same behavior
- [ ] Empty fields → form validation fires before API call
- [ ] Expired token → redirected to login (not infinite spinner)
- [ ] Manually deleted cookie → next page load redirects to login
- [ ] 500 from auth API → user sees error, not white screen

### 2.3 Security Checks
- [ ] **CRITICAL:** Confirm `JWT_SECRET` is NOT `'medical-tracker-secret-change-in-production'` in any shipped build
  ```bash
  grep -r "medical-tracker-secret" dist-server/ electron/ dist/
  # Should return nothing (or only in comments/docs)
  ```
- [ ] `requireAuth` middleware applied to ALL `/api/*` routes that return PHI
- [ ] Logout actually clears the cookie (not just client-side redirect)
- [ ] No username/password logged to console in production mode

### 2.4 Regression Tests (map to existing Playwright specs)
```bash
npm run test:e2e -- --grep "Authentication"
```
- [ ] `shows login form on first load` ✓
- [ ] `logs in with valid credentials` ✓
- [ ] `shows error on invalid credentials` ✓

---

## ✅ SECTION 3: CRITICAL USER JOURNEYS

### CUJ-1: View Lab Results
- [ ] Lab Results tab loads without error
- [ ] 354 CareSpace results visible (or correct count)
- [ ] Sorting and filtering work
- [ ] Abnormal flags display correctly (check `fix-abnormal-flags.js` was applied)
- [ ] No PHI visible in browser network tab as plaintext (should be encrypted at rest)

### CUJ-2: Research Scanner (28 terms)
```bash
node run-scanner.js
# Or via UI trigger
```
- [ ] Scanner runs all categories: conventional, pipeline, integrative, trials, research
- [ ] Results appear in news_feed table after run
- [ ] Duplicate articles not re-inserted (deduplication by URL or title)
- [ ] Scanner completes within reasonable timeout (< 5 minutes)
- [ ] Failure on one term doesn't abort entire scan
- [ ] Error terms logged with reason, not silently swallowed

**Failure mode test:**
```bash
# Temporarily break network and run scanner
# networksetup -setairportpower en0 off  # WARNING: only on test machine
node run-scanner.js
# EXPECT: graceful error per term, partial results saved, no crash
```
- [ ] Scanner handles network timeout per term gracefully
- [ ] Scanner handles API rate-limit (429) gracefully
- [ ] Results from previous successful terms preserved when one fails

### CUJ-3: Medication Evidence Modals (22 medications)
- [ ] Each medication card opens its evidence modal
- [ ] Modal loads evidence content (not blank)
- [ ] Modal closes cleanly (no memory leak/zombie listeners)
- [ ] Ubiquinol added correctly (see `add-ubiquinol.js` — confirm it ran)

### CUJ-4: Genomics Tab
- [ ] Tab loads without white screen **[REGRESSION — highest recurrence]**
- [ ] ARID1A, FGFR3, PIK3CA mutations displayed
- [ ] No `undefined` rendering in mutation list
- [ ] Supplement protocol section visible

### CUJ-5: Nutrition Tracking
- [ ] Meal entry form submits successfully
- [ ] Meal analyzer returns AI analysis
- [ ] Genomic nutrition tracking shows relevant recommendations
- [ ] Meal history persists after page reload

### CUJ-6: Portal Sync (CareSpace)
- [ ] Sync button triggers scrape without crash
- [ ] Progress indicator updates during sync
- [ ] Portal credentials stored encrypted (not in plaintext in DB)
  ```bash
  sqlite3 data/health.db "SELECT * FROM portal_credentials LIMIT 1;"
  # Should be encrypted blob, not plaintext username/password
  ```
- [ ] Sync failure (wrong credentials) shows user-friendly error
- [ ] Auto-sync on open (migration 008) works if enabled

### CUJ-7: AI Healthcare Summary
- [ ] Summary generates with GPT-4o
- [ ] API key not exposed in client-side JS bundle
  ```bash
  grep -r "sk-" dist/assets/
  # Must return nothing
  ```
- [ ] Summary displays correctly in UI
- [ ] Error if OpenAI API down → user-visible message, not crash

---

## ✅ SECTION 4: DB MIGRATIONS

### 4.1 Migration Inventory
| Migration | File | Key Change | Test |
|-----------|------|------------|------|
| 002 | 002-nutrition-module.sql | Nutrition tables | Nutrition tab loads |
| 003 | 003-meal-analysis-storage.sql | Meal storage | Meal save works |
| 004 | 004-add-sync-schedule.js / .sql | Sync scheduling | Sync settings save |
| 005 | 005-add-sync-time.js | Sync time column | No "column not found" error |
| 006 | 006-add-sync-day-of-week.js | Sync DOW | Same |
| 007 | 007-add-remaining-sync-columns.js | Remaining columns | Same |
| 008 | 008-add-auto-sync-on-open.js | Auto-sync flag | Settings toggle works |
| 009 | 009-add-notify-on-sync.js | Notify flag | Settings save works |
| 010 | 010-add-fhir-oauth.sql | FHIR OAuth | Epic FHIR tab loads |
| 011 | 011-enhanced-medications.sql | Medications schema | 22 meds load |
| 012 | 012-analytics.sql | Analytics | Analytics tab loads |

### 4.2 Migration Tests
- [ ] Fresh DB (delete `data/health.db`) → server starts → all migrations run → app works
  ```bash
  mv data/health.db data/health.db.bak
  node server/index.js &
  sleep 5
  curl http://localhost:3001/api/health
  # Then run full smoke tests
  mv data/health.db.bak data/health.db  # restore
  ```
- [ ] **Idempotency:** Run migrations twice → no error, no duplicate data
- [ ] Migration failure mid-run → server logs error, doesn't start in broken state
- [ ] Each migration wrapped in transaction (partial failure rolls back)
- [ ] After migration, verify with `check-conditions-schema.js` and `check-nutrition.js`

### 4.3 Pre-Release Migration Checklist
- [ ] List all `.sql` and `.js` in `server/migrations/` — confirm sequential numbering, no gaps
- [ ] All `.sql` migrations use `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE IF NOT EXISTS` style
- [ ] Migration log table exists to track applied migrations
  ```bash
  sqlite3 data/health.db ".tables" | grep -i migration
  ```

---

## ✅ SECTION 5: ELECTRON PACKAGING SANITY CHECKS

### 5.1 Pre-Build Checklist
- [ ] `dist-server/server.bundle.js` is current (rebuild if `server/` changed)
  ```bash
  ls -la dist-server/server.bundle.js
  # Compare mtime to last server/ edit
  ```
- [ ] `dist/assets/index-*.js` is current (run `npm run build` fresh)
- [ ] No hardcoded localhost URLs in bundled JS:
  ```bash
  grep -r "localhost:3001\|localhost:5173" dist/assets/
  # Should only appear in dev-mode guards, not as fallback
  ```
- [ ] `electron/main.cjs` correctly points to bundled server, not dev path
- [ ] `package.json` version bumped before `electron:build:mac`

### 5.2 Post-Build Checklist
```bash
npm run electron:build:mac
```
- [ ] DMG generated in `dist-electron/` or `release/`
- [ ] DMG size reasonable (~129 MB ± 10 MB)
- [ ] App opens from DMG without "damaged app" warning (notarization)
- [ ] No Gatekeeper rejection:
  ```bash
  spctl --assess --type exec --verbose /Volumes/MyTreatmentPath/MyTreatmentPath.app
  # EXPECT: accepted (source: Notarized Developer ID)
  ```
- [ ] `codesign --verify --deep --strict MyTreatmentPath.app` passes
- [ ] App starts from DMG install without developer mode
- [ ] All tabs functional in packaged build (not just dev)

### 5.3 Notarization
```bash
npm run notarize  # or check NOTARIZATION-QUICKSTART.md
```
- [ ] Apple notarization ticket stapled to DMG
- [ ] `xcrun stapler validate MyTreatmentPath.dmg` passes
- [ ] Upload to GitHub Releases with correct tag `v{version}`
- [ ] SHA256 checksum published alongside DMG and ZIP

### 5.4 IPC Tests (Electron-specific)
```bash
npm run test:ipc
npm run test:ipc-coverage
```
- [ ] All IPC handlers respond (see `tests/e2e/ipc-coverage.spec.js`)
- [ ] IPC module tests pass (see `tests/e2e/ipc-modules.spec.js`)
- [ ] No exposed `require` or `electron` APIs to renderer (contextIsolation check)
  ```bash
  grep -r "contextIsolation: false\|nodeIntegration: true" electron/
  # Should return nothing (both should be false/disabled)
  ```

---

## ✅ SECTION 6: REGRESSION SUITE PRIORITIES

Run in this order before every release:

```bash
# Full suite
npm run test:e2e

# API-only (faster, run first)
npm run test:api

# IPC tests
npm run test:ipc
npm run test:ipc-coverage
```

### Priority Regressions (highest recurrence — always run)
1. **Genomics white screen** — `tests/e2e/app.spec.js` `Genomics tab loads without white screen`
2. **Login invalid credentials** — stays on login page
3. **Auth token cookie set** — HttpOnly cookie present after login
4. **Navigation crash-free** — all tabs load without JS errors
5. **API health endpoint** — `GET /api/health` returns 200

### Known Fragile Areas (extra attention)
- Any tab that fetches genomic data (ARID1A/FGFR3/PIK3CA) → white screen risk
- Research scanner network calls → timeout/hang risk
- Portal sync (CareSpace scraper) → credential/session expiry risk
- Meal analyzer → OpenAI API key/rate-limit risk

---

## ✅ SECTION 7: ENCRYPTION & SECURITY HARDENING

### 7.1 AES-256-GCM Encryption (server/encryption.js + server/db-secure.js)
- [ ] Encryption key derived from user password + salt (not hardcoded)
- [ ] IV is unique per encryption operation (never reused)
- [ ] Encrypted blobs include IV + auth tag (not just ciphertext)
- [ ] `db-secure.js` functions used consistently for all PHI fields
- [ ] Decryption failure surfaces as error (not silent empty string)

### 7.2 PHI Data Audit
```bash
# Check what's stored unencrypted
sqlite3 data/health.db ".schema" | grep -i "name\|password\|credential\|token\|ssn\|dob"
```
- [ ] Passwords: bcrypt hash only (never plaintext)
- [ ] Portal credentials: AES-256-GCM encrypted
- [ ] Lab result values: acceptable as plaintext (patient's own data, local only)
- [ ] JWT tokens: not stored in DB
- [ ] OpenAI API key: environment variable only, not in DB or code

### 7.3 PHI Transfer (phi-transfer.js)
- [ ] PHI export requires auth
- [ ] Exported files are encrypted
- [ ] Export destination logged in audit trail
- [ ] `server/audit.js` records all PHI access events

---

## ✅ SECTION 8: FAILURE MODE TESTING

### 8.1 Database Failures
- [ ] DB locked (SQLite concurrent access) → server logs error, API returns 503, not crash
- [ ] Corrupted DB → preflight checks (`server/preflight-checks.js`) detect and report
- [ ] DB on read-only filesystem → meaningful error on startup
- [ ] DB file deleted mid-run → server handles gracefully

### 8.2 Network Failures
- [ ] Research scanner: DNS failure per term → logs error, continues
- [ ] Portal sync: CareSpace portal down → user-visible error, no crash
- [ ] OpenAI API: 429 rate limit → message shown, no crash
- [ ] FHIR API: Epic token expired → re-auth prompt, not silent failure

### 8.3 Electron-Specific Failures
- [ ] Renderer crash → Electron shows "page crashed" and offers reload
- [ ] Server fails to start → Electron shows error dialog, not blank window
- [ ] Port 3001 already in use → meaningful error, suggest resolution
- [ ] App opened while another instance running → handled (single-instance lock?)

### 8.4 Encryption Failures
- [ ] Wrong decryption key → error thrown, not garbage data returned
- [ ] Truncated ciphertext → graceful error
- [ ] DB-secure functions: test with known plaintext round-trip
  ```bash
  node -e "
  import('./server/encryption.js').then(({encrypt, decrypt}) => {
    const key = Buffer.alloc(32, 0x42);
    const ct = encrypt('test PHI data', key);
    const pt = decrypt(ct, key);
    console.assert(pt === 'test PHI data', 'ENCRYPTION ROUND-TRIP FAILED');
    console.log('Encryption round-trip: PASS');
  });
  "
  ```

---

## ✅ SECTION 9: PRE-RELEASE RELEASE CHECKLIST

Run this in sequence before tagging a release:

```bash
# 1. Clean build
rm -rf dist dist-server dist-electron
npm run build
node esbuild.config.js  # or however server bundle is built

# 2. Run all tests
npm run test:api
npm run test:ipc
npm run test:ipc-coverage
npm run test:e2e

# 3. Sanity checks
node check-conditions-schema.js
node check-nutrition.js

# 4. Security check
grep -r "sk-" dist/assets/ && echo "⚠️ API KEY LEAK" || echo "✅ No API keys in bundle"
grep -r "medical-tracker-secret-change-in-production" dist-server/ && echo "⚠️ DEFAULT JWT SECRET" || echo "✅ JWT secret OK"
grep -r "contextIsolation: false\|nodeIntegration: true" electron/ && echo "⚠️ INSECURE IPC" || echo "✅ IPC security OK"

# 5. Package
npm run electron:build:mac

# 6. Verify package
spctl --assess --type exec --verbose dist-electron/mac/MyTreatmentPath.app

# 7. Manual smoke test in packaged app
# Open DMG, install, login, check all tabs

# 8. Tag and release
git tag v$(node -p "require('./package.json').version")
git push origin --tags
# Upload DMG + ZIP to GitHub Releases
```

---

## ✅ SECTION 10: TEST GAPS TO FILL

These are not currently covered and should be added to the test suite:

| Gap | Suggested Test | Priority |
|-----|---------------|----------|
| Research scanner full run | Jest/Node test for each category | P1 |
| Encryption round-trip | Unit test in `tests/unit/encryption.test.js` | P0 |
| Migration idempotency | Script: run migrations twice on fresh DB | P1 |
| Portal credential encryption | Check DB column is not plaintext | P0 |
| JWT_SECRET validation on startup | Preflight check + test | P0 |
| All 22 medication modals open | Playwright: loop through all meds | P1 |
| Scanner deduplication | Insert same URL twice, verify count=1 | P2 |
| Auth cookie flags | Playwright: check HttpOnly, SameSite | P0 |
| Packaged IPC (not just dev) | Post-notarize automated open + check | P1 |
| Backup/restore round-trip | Script: backup, delete, restore, verify | P0 |

---

## 🔧 QUICK COMMANDS REFERENCE

```bash
# Run all tests
npm run test:e2e && npm run test:api && npm run test:ipc

# Check DB schema
sqlite3 data/health.db ".schema"

# Check migration status
sqlite3 data/health.db ".tables"

# Run scanner manually
node run-scanner.js

# Check for security issues
grep -rn "sk-\|password.*=.*[\"'][^\"']\|JWT_SECRET.*secret" server/ --include="*.js"

# Verify Electron signature
codesign --verify --deep --strict --verbose=2 /path/to/MyTreatmentPath.app

# Fresh DB test
cp data/health.db data/health.db.bak && rm data/health.db
node server/index.js &
sleep 5 && curl http://localhost:3001/api/health
# Restore: kill %1 && mv data/health.db.bak data/health.db
```

---

*This document lives at `medical-research-tracker/QA-HARDENING.md`. Update after each release.*
