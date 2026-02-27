# MyTreatmentPath — Project Memory
<!-- Last updated: 2026-02-24 18:00 EST -->
Last updated: 2026-02-24

## Current Version
**v0.1.64** — Exercise Tracker + Pain Tracker added (v0.1.42–v0.1.63 were prior patches)

## Architecture
- **Electron 40.4.1** + **Vite 5** + **React 18**
- **better-sqlite3** for local DB (requires rebuild for each Electron version)
- **IPC-only mode** in production — no Express server, no localhost
- **Vault** = AES-256-GCM encryption of portal credentials in SQLite
- App name: `MyTreatmentPath` | Binary: `medical-research-tracker`
- userData path (prod): `~/Library/Application Support/MyTreatmentPath/`
- userData path (dev): `~/Library/Application Support/medical-research-tracker/`
- DB file: `{userData}/data/health-secure.db`

## Critical Bug History (so we don't repeat)

### BUG: App loads localhost:5173 instead of own UI (fixed v0.1.38)
- **Root cause:** `.env` bundled via `extraResources` sets `NODE_ENV=development`
- `const isDev = process.env.NODE_ENV === 'development'` → always true in prod
- **Fix:** `const isDev = !app.isPackaged` — use Electron's official API
- **Never** use `NODE_ENV` to detect dev/prod in Electron main process

### BUG: "Failed to load credentials" / vault not unlocking (fixed v0.1.37+)
- **Root cause:** `autoUnlockVault()` called in `db:verify-user` but result ignored
- If vault init failed silently, `encryptionKey` stayed null → all vault ops threw
- **Fix:** Store session password in `currentSessionPassword`, retry in `vault:get-credentials`
- **Fix:** Per-column try-catch in migration so one failure doesn't block others

### BUG: "SqliteError: no such column: updated_at" (fixed v0.1.40)
- **Root cause:** Migration loop had ONE try-catch — any column failure aborted the rest
- `updated_at` never got added; SELECT query included it → crash
- **Fix:** Individual try-catch per column in BOTH `vault-ipc.cjs` AND `db-ipc.cjs`
- **Fix:** Removed `updated_at` from SELECT (not shown in UI anyway)

### BUG: PDF parse "Could not extract text" (fixed v0.1.39)
- **Root cause:** Foundation One CDx = scanned/image-based PDF, no embedded text
- `pdf-parse` returns empty string → parser threw
- **Fix:** If text < 100 chars, send raw PDF bytes to Claude as `document` block
- Claude reads it visually via beta `pdfs-2024-09-25` API

### BUG: Portal sync crashes on decrypt (fixed v0.1.41)
- **Root cause:** `vault.decrypt(cred.password)` — column is `password_encrypted`
- Username also not decrypted — `credential.username` was null
- **Fix:** Decrypt `cred.password_encrypted` and `cred.username_encrypted` explicitly
- **Fix:** Playwright `executablePath()` passed explicitly (ASAR can't auto-resolve)

### BUG: better-sqlite3 NODE_MODULE_VERSION mismatch
- System Node (v25) = MODULE_VERSION 141; Electron 40 = 143
- **Fix:** `npmRebuild: true` in `electron-builder.yml` — MUST stay, never remove
- Running `npm rebuild` outside the build pipeline will break native modules

### BUG: pdf-parse v2.x broke import (not a function)
- v2.x switched to class-based API; v1.x exports a function
- **Fix:** `npm install pdf-parse@1.1.1 --save` — pinned, do not upgrade

## Schema: portal_credentials
Key columns vault-ipc.cjs needs:
- `service_name`, `portal_type`, `base_url`
- `username_encrypted`, `password_encrypted`
- `mfa_method`, `totp_secret_encrypted`, `notes_encrypted`
- `last_sync`, `last_sync_status`, `last_sync_records`
- `created_at` (do NOT select `updated_at` — not always migrated)

Both `db-ipc.cjs` creates with OLD schema, then migration adds new columns.
Both `vault-ipc.cjs` opens its OWN DB connection — runs its own migration.
`portal-sync-ipc.cjs` opens a THIRD connection — defensive UPDATE fallbacks needed.

## IPC Module Architecture
- `db-ipc.cjs` — user auth, health records, conditions, medications, vitals
- `vault-ipc.cjs` — portal credential encryption/decryption, vault lock/unlock
- `portal-sync-ipc.cjs` — Playwright scraper for CareSpace + future portals
- `ai-genomics-parser.cjs` — PDF → Claude → structured mutation JSON
- `foundation-one-parser.cjs` — legacy regex parser (kept for fallback)

## Vault Flow
1. User logs in → `db:verify-user` IPC → `vault.autoUnlockVault(password)` + stores `currentSessionPassword`
2. `vault:get-credentials` → if locked, retries with `currentSessionPassword`
3. `vault:lock` → clears `encryptionKey` AND `currentSessionPassword`
4. Logout → locks vault, clears session password

## Build Pipeline
```bash
./build-notarized.sh  # ~15-20 min (sign + notarize)
# Log: /tmp/mrt-build-XXXX.log
# DMG: build/MyTreatmentPath-{version}-arm64.dmg
# ZIP: build/MyTreatmentPath-{version}-arm64-mac.zip
```
Upload workaround (gh CLI times out on large files):
```bash
curl -X POST -H "Authorization: Bearer $GH_TOKEN" -H "Content-Type: application/octet-stream" \
  --data-binary @file.dmg "https://uploads.github.com/repos/jeperkins4/medical-research-tracker/releases/{id}/assets?name=file.dmg"
```

## CareSpace Portal Sync
- Portal type: `carespace`
- Playwright headless Chromium (installed at `~/Library/Caches/ms-playwright/`)
- Scrapes: Lab Reports (up to 10 most recent), imaging, pathology, notes, meds
- Lab data → `test_results` table with dedup check
- Lab extraction: `.rt-tbody .rt-tr[role="row"]` → cells[1]=name, [2]=value, [3]=range

## Genomics / AI Parser
- `genomics:parse-foundation-one` IPC → lazy requires `ai-genomics-parser.cjs`
- Tries pdf-parse first; if < 100 chars of text → Claude document/vision API
- Returns structured mutation JSON → `genomic_mutations` table
- Requires `ANTHROPIC_API_KEY` in `.env` (bundled via `extraResources`)

## Signing
- Identity: `Developer ID Application: John Perkins (7UU4H2GZAW)`
- Hash: `DA7B788C70B5FD6A1507950B3F31B7ACC32EDA1B`
- Cert expires: 2027-02-01
- Notarization: Apple ID `jeperkins4@hotmail.com`, Team ID `7UU4H2GZAW`

## GitHub
- Repo: `jeperkins4/medical-research-tracker`
- All releases: https://github.com/jeperkins4/medical-research-tracker/releases
