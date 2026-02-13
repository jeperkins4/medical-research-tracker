# Portal Credential Vault - Security & Usage

## Overview

Securely store healthcare portal credentials for automated medical record syncing. All credentials encrypted at rest using AES-256-GCM, protected by your master password.

## Security Architecture

### Encryption
- **Algorithm**: AES-256-GCM (Galois/Counter Mode)
- **Key Derivation**: PBKDF2-SHA256, 100,000 iterations
- **Master Password**: Never stored, only PBKDF2 hash for verification
- **Encryption Key**: Derived from password, held in memory during session
- **Per-Field Encryption**: Each field gets unique IV + auth tag
- **Format**: `iv:authTag:ciphertext` (Base64)

### Storage
- **Location**: Local SQLite database (`data/health.db`)
- **Tables**:
  - `vault_master` - Password hash + salt (verification only)
  - `portal_credentials` - Encrypted credentials
  - `portal_sync_log` - Sync history

### Session Security
- Encryption key cleared on server restart
- Lock vault manually to clear key from memory
- Re-unlock required after lock/restart

## Setup

### First Time

1. Navigate to **🔐 Portals** tab
2. Set master password (min 8 characters, longer is better)
3. Password hashed with PBKDF2 (100k iterations)
4. Vault unlocked automatically after setup

### Subsequent Sessions

If vault is locked:
1. Enter master password
2. Encryption key derived and loaded into memory
3. Access credentials

## Adding Portal Credentials

### Supported Portal Types

**Epic MyChart** (Most common)
- Florida Cancer Specialists
- Moffitt Cancer Center
- Mayo Clinic
- MD Anderson
- Johns Hopkins
- AdventHealth (some locations)

**Cerner Health**
- Community hospitals
- AdventHealth (some locations)

**Athenahealth**
- Independent practices

**CareSpace Portal**
- CareSpace patient portal system
- Used by various healthcare providers

**Custom/Generic**
- Any portal with web interface (browser automation fallback)

### Form Fields

**Required:**
- Service Name (e.g., "Epic MyChart - FCS")
- Portal Type (epic/cerner/athena/generic)
- Username
- Password

**Optional:**
- Portal URL (for direct access)
- MFA Method (none/sms/email/totp)
- TOTP Secret (for automatic 2FA code generation)
- Notes (encrypted)

### MFA Support

**SMS/Email**: Manual entry during sync (prompted)
**TOTP (Authenticator App)**: 
- Provide Base32 secret from authenticator setup
- Codes generated automatically during sync
- No manual intervention needed

## Using Credentials

### Manual Sync
1. Click portal credential card
2. Click "Sync Now" (when implemented)
3. Connector fetches latest records
4. Data mapped to your schema
5. Imported to database

### Viewing Credentials
- List view: Service name, type, URL, MFA method, last sync
- Passwords never displayed in list
- Edit form: Decrypts fields for editing
- Delete: Removes credential + sync history

### Sync History
- Every sync logged with timestamp, status, records imported
- View per-credential or global history
- Troubleshoot failed syncs

## Security Best Practices

### Master Password
- Use strong, unique password (≥12 chars recommended)
- Mix uppercase, lowercase, numbers, symbols
- Don't reuse from other services
- Store in password manager if needed

### Portal Passwords
- Use strong passwords for healthcare portals
- Enable MFA when available
- Update credentials in app if changed on portal

### Physical Security
- Lock vault when leaving computer unattended
- Server restart clears encryption key automatically
- Consider full-disk encryption on your machine

### Sharing Database
If sharing app with others:
- Each database has independent vault
- Your master password ≠ their master password
- Credentials encrypted with their key, not yours
- No cross-contamination

## Database Portability

**Export for backup:**
```bash
cp data/health.db data/health.db.backup
```

**Move to another machine:**
1. Copy `health.db` file
2. Set up vault with SAME master password
3. Unlock vault - credentials decrypt correctly

**Share app template:**
1. Delete your `health.db`
2. App creates fresh database
3. User sets their own master password

## Troubleshooting

**"Vault is locked"**
- Enter master password to unlock
- Server may have restarted (key cleared)

**"Invalid master password"**
- Double-check password (case-sensitive)
- If forgotten, vault must be reset (data lost)

**Failed sync**
- Check credential is correct (test on portal website)
- MFA may have expired/changed
- Portal may be down or rate-limiting
- Check sync history for error details

**Cannot decrypt credentials**
- Master password must match original
- If database was corrupted, may be unrecoverable
- Restore from backup if available

## API Reference (Internal)

### Vault Endpoints
```
GET  /api/vault/status         - Check initialized/unlocked
POST /api/vault/setup          - Set master password (first time)
POST /api/vault/unlock         - Verify password, load key
POST /api/vault/lock           - Clear key from memory
```

### Credential Endpoints
```
GET    /api/portals/credentials           - List all (no passwords)
GET    /api/portals/credentials/:id       - Get one (decrypted)
POST   /api/portals/credentials           - Add new
PUT    /api/portals/credentials/:id       - Update
DELETE /api/portals/credentials/:id       - Delete
GET    /api/portals/sync-history          - Global sync log
GET    /api/portals/credentials/:id/sync-history - Per-credential log
```

## Future: Connector Implementation

### Phase 2: FHIR API Integration (Epic)
- OAuth 2.0 flow for Epic MyChart
- Fetch Patient, Condition, Medication, Observation resources
- Map FHIR → your schema
- No password scraping needed

### Phase 3: Browser Automation (Generic)
- Playwright-based scraper for unsupported portals
- Credentials injected securely at runtime
- Download records → parse → import
- Handle dynamic MFA prompts

### Phase 4: Automated Sync
- Schedule syncs (daily/weekly)
- Background job pulls updates
- Notify on new records
- Conflict resolution for changed data
