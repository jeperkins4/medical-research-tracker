# Changelog

All notable changes to MyTreatmentPath will be documented in this file.

## [0.1.16] - 2026-02-23

### Fixed
- **Data not loading from existing database** - IPC handlers now use legacy single-user database schema
- Database path now points to existing `data/health-secure.db` (backward compatibility)
- Table schemas match existing format (no user_id foreign keys)
- Profile reads from `patient_profile` table (legacy format)
- Medication columns use `started_date`/`stopped_date` (not `start_date`/`end_date`)

### Technical
- Updated `db-ipc.cjs` to use `~/Library/Application Support/MyTreatmentPath/data/health-secure.db`
- Changed table schemas to match legacy single-user format
- Removed user_id foreign keys from all queries
- Profile table uses legacy `patient_profile` with id=1 constraint

## [0.1.15] - 2026-02-23

### Fixed
- **Wizard buttons hanging** - Added 2-second timeout to config save endpoint
- **Button double-click protection** - Added loading state to prevent multiple clicks
- Wizard buttons now respond immediately (no longer waiting for HTTP timeout)
- Gracefully handles missing /api/config endpoint in IPC-only mode

### Technical
- Added AbortController with 2s timeout to fetch call
- Added `loading` state to disable buttons during async operations
- Shows "Finishing..." text on final button during save

## [0.1.14] - 2026-02-23

### Fixed
- **Persistent wizard skip flag** - Uses localStorage to remember if wizard has been shown
- Wizard now truly shows only once, even if user skips account creation
- After first launch, wizard never reappears (goes straight to login/signup)

### Technical
- Added `localStorage.getItem('firstRunWizardCompleted')` check
- Wizard shows if: (1) no users exist AND (2) wizard hasn't been completed yet
- Handles edge case: user sees wizard → skips it → comes back later

## [0.1.13] - 2026-02-23

### Fixed
- **Skip onboarding wizard after account creation** - Once you create an account, the app goes straight to login on next launch (no more wizard)
- Wizard gracefully handles missing config endpoint in IPC-only mode

### Changed
- Improved first-run flow: checks for existing user account before showing wizard

## [0.1.12] - 2026-02-23

### Changed
- **Major architecture refactor:** Removed HTTP server dependency for core features
- All core database operations now use Electron IPC (direct SQLite access)
- Much faster, more reliable, cannot crash like HTTP server

### Added
- Version number displayed in app footer
- Direct IPC database handlers in `electron/db-ipc.cjs`
- Unified API wrapper (`src/api.js`) that works in both Electron and web browser

### Fixed
- **Backend server crashes on startup** - eliminated by removing HTTP server
- Module resolution errors in production builds

### Core Features (IPC-based, no HTTP needed)
- Account creation and login
- Profile management
- Condition tracking
- Medication tracking
- Vitals recording
- Lab results (read-only)

### Optional Features (still use HTTP for now)
- Research search (requires Brave API key)
- AI meal analysis (requires Anthropic API key)
- Cloud sync (requires Supabase)
- Portal integrations

## [0.1.11] - 2026-02-23

### Fixed
- Module resolution in production builds (set working directory in main process)

## [0.1.10] - 2026-02-23

### Fixed
- ERR_MODULE_NOT_FOUND errors in production builds
- Set correct working directory for backend server
- Conditional dotenv loading (dev only)

## [0.1.9] - 2026-02-22

### Added
- First-run wizard for optional API key configuration
- Auto-generate missing encryption keys (never fail on startup)
- Config persistence at `~/Library/Application Support/MyTreatmentPath/config.json`

### Changed
- Core security keys (JWT, DB encryption) auto-generated if missing
- Optional features (Brave search, AI, cloud sync) configured via wizard
- Never call `process.exit(1)` on config errors - always degrade gracefully

## [0.1.8] - 2026-02-22

### Added
- Initial release with basic health tracking features
- Genomics integration
- Research discovery
- HIPAA-compliant encryption

---

## Version Numbering

- **0.1.x** - Alpha releases (architecture stabilization)
- **0.2.x** - Beta releases (feature complete)
- **1.0.0** - Production release
