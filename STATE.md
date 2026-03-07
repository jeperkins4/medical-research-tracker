# STATE.md — MyTreatmentPath (medical-research-tracker)
<!-- Read this before touching any code. Update it after every session. -->

Last updated: 2026-03-06

## Current Version
**v0.1.78** — stable, all tests passing

## Current Branch
`main`

## What's Working Right Now

### Core App
- Electron 40.4.1 + Vite 5 + React 18: working
- Local SQLite DB (better-sqlite3): working
- AES-256-GCM vault encryption: working
- IPC-only mode (no Express in prod): working
- App correctly detects dev/prod via `app.isPackaged` (not NODE_ENV)

### API & Tests
- **353 tests passing, 0 failing, 1 intentionally skipped**
- Test command: `vitest run && playwright test --project=api-tests`
- Medications PUT: merge-on-update fixed (no NOT NULL constraint errors)
- JWT uniqueness: `jti: randomUUID()` prevents token collision flakiness
- Portal credential CRUD: all endpoints tested
- Vault: locked in test env (create/delete flow skipped intentionally)

### Features Shipped
- Genomics integration (ARID1A/FGFR3/PIK3CA parsing)
- Portal sync (Epic, CareSpace — no live credentials in test env)
- Biomarker cross-reference endpoint
- Clinical notes seeding
- Bone health analysis
- PDF parsing (Foundation One CDx scanned PDFs via Claude document block)

## What's In Progress
- FHIR OAuth state persistence hardening (in-memory state = restart risk)
- Portal credential update UI (backend exists, not yet wired to PortalManager UI)
- Genomic variant → therapy suggestion endpoint (planned)

## Hard Rules — Never Violate
- **`npmRebuild: true` in `electron-builder.yml`** — never remove. Node v25 = MODULE_VERSION 141; Electron 40 = 143. Must rebuild.
- **`pdf-parse@1.1.1`** — pinned. v2.x broke import API. Do not upgrade.
- **Per-column try-catch** in both `vault-ipc.cjs` AND `db-ipc.cjs` — never consolidate into one try-catch block.
- **Never SELECT `updated_at`** from `portal_credentials` — column may not exist post-migration.
- **Never use `NODE_ENV`** to detect dev/prod in Electron main process. Use `app.isPackaged`.

## Do Not Touch Without Reading First
- `db-ipc.cjs` + `vault-ipc.cjs` — per-column migration pattern is intentional. See Hard Rules.
- `electron-builder.yml` — `npmRebuild: true` must stay.
- Any JWT issuance code — must include `jti: randomUUID()` or token collision flakiness returns.

## Test Command
```bash
npm test
# = vitest run && playwright test --project=api-tests
# Must show: 353 passed, 0 failed before committing anything
```

## Architecture
- Electron 40.4.1 + Vite 5 + React 18 + better-sqlite3
- IPC-only in prod — no localhost server
- userData (prod): `~/Library/Application Support/MyTreatmentPath/`
- userData (dev): `~/Library/Application Support/medical-research-tracker/`
- DB: `{userData}/data/health-secure.db`
- Vault: AES-256-GCM, password-derived key, stored encrypted in SQLite

## Schema: portal_credentials key columns
`id, service_name, portal_type, username_encrypted, password_encrypted, portal_url, created_at`
Note: `updated_at` NOT reliably present — do not SELECT it.
