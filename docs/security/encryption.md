# Encryption & Data Security

**How MyTreatmentPath keeps your health data secure.**

---

## Overview

MyTreatmentPath uses **military-grade AES-256 encryption** to protect all your health data (PHI). Your data is encrypted at rest on your device and never transmitted unencrypted.

---

## Encryption Methods

### AES-256-CBC Encryption

**Algorithm:** Advanced Encryption Standard (AES) with 256-bit keys  
**Mode:** Cipher Block Chaining (CBC)  
**Library:** `better-sqlite3-multiple-ciphers`

**What's encrypted:**
- ✅ SQLite database (all PHI)
- ✅ Automated backups
- ✅ Manual exports

**What's NOT encrypted:**
- ❌ Application code (open source)
- ❌ UI preferences (non-sensitive)

### Key Management

**Encryption keys stored in:**
- `.env` file (local development)
- Environment variables (production)
- Keychain/Credential Manager (future: macOS Keychain integration)

**Keys used:**
- `DB_ENCRYPTION_KEY` - Database encryption (32 bytes)
- `BACKUP_ENCRYPTION_KEY` - Backup encryption (32 bytes)
- `JWT_SECRET` - Session tokens (32 bytes)

**Key rotation:**
- Not yet implemented (planned for v0.2.0)
- Manual process: re-encrypt database with new key

---

## Database Encryption

### At Rest

SQLite database encrypted with AES-256:

```javascript
const db = new Database(dbPath, {
  key: process.env.DB_ENCRYPTION_KEY,
  cipher: 'aes256cbc'
});
```

**Verification on startup:**
```
✅ Database encryption verified (AES-256)
✅ Secure database initialized (PHI encrypted at rest)
```

### In Memory

- Database decrypted in memory during use
- Protected by OS memory isolation
- Cleared on app exit

### In Transit

- No network transmission of PHI (local-first architecture)
- API calls use HTTPS (TLS 1.3) for non-PHI data
- Cloud sync (research papers only) uses Supabase's encryption

---

## Backup Encryption

### Automated Backups

Daily backups (2:00 AM local time):

```javascript
// Encrypt backup with AES-256
const encryptedBackup = encrypt(databaseBlob, BACKUP_ENCRYPTION_KEY);

// Save to secure location
fs.writeFileSync(`backups/encrypted-${timestamp}.db.enc`, encryptedBackup);
```

**Backup schedule:**
- Daily at 2:00 AM
- 7-day retention (auto-cleanup)
- Optional cloud upload (encrypted, to Supabase Storage)

### Manual Backups

Export encrypted database:

1. **Settings** → **Backup & Restore**
2. Click **"Export Encrypted Backup"**
3. Save `.db.enc` file to secure location
4. Store encryption key separately (password manager)

### Restore from Backup

```bash
# Decrypt backup
openssl enc -d -aes-256-cbc -in backup.db.enc -out restored.db -k YOUR_KEY

# Verify integrity
sqlite3 restored.db "PRAGMA integrity_check;"
```

---

## Cloud Storage Encryption

### Supabase Storage

**What's stored:**
- Encrypted database backups
- Research paper metadata (non-PHI)

**Encryption layers:**
1. **Client-side:** AES-256 before upload
2. **Transport:** TLS 1.3 (HTTPS)
3. **At rest:** Supabase's AES-256 (second layer)

**Key storage:**
- Encryption keys NEVER uploaded
- Only you can decrypt your backups

---

## Authentication Security

### JWT Tokens

**Algorithm:** HMAC-SHA256  
**Expiry:** 7 days  
**Storage:** HTTP-only cookies (XSS protection)

**Token payload:**
```json
{
  "userId": 1,
  "username": "john",
  "iat": 1708387200,
  "exp": 1708992000
}
```

### Password Hashing

**Algorithm:** bcrypt  
**Rounds:** 10 (2^10 = 1,024 iterations)  
**Salt:** Unique per password (auto-generated)

```javascript
const hash = await bcrypt.hash(password, 10);
```

**Storage:**
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL  -- bcrypt hash, NEVER plaintext
);
```

---

## Network Security

### HTTPS Only

- **Development:** HTTP (localhost only)
- **Production:** HTTPS enforced (TLS 1.3)

### CORS Policy

```javascript
cors({
  origin: ['https://mytreatmentpath.com'],
  credentials: true
})
```

### Security Headers

```javascript
{
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
}
```

---

## Audit Logging

All authentication events logged:

```sql
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  action TEXT,        -- 'login', 'logout', 'register', 'backup'
  status TEXT,        -- 'success', 'failure'
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Logged events:**
- ✅ Login attempts (success/failure)
- ✅ Account creation
- ✅ Backup creation
- ✅ Database queries (optional, debug mode)

---

## File Permissions

### Production (.env)

```bash
# Secure .env file
chmod 600 .env  # Owner read/write only
```

### Database File

```bash
# Restrict database access
chmod 600 medical-tracker.db
```

### Backup Directory

```bash
# Secure backup storage
chmod 700 backups/  # Owner access only
```

---

## Threat Model

### What We Protect Against

✅ **Unauthorized access** - Database encryption  
✅ **Data theft** - Encrypted backups  
✅ **Network sniffing** - HTTPS/TLS  
✅ **XSS attacks** - HTTP-only cookies  
✅ **SQL injection** - Parameterized queries  
✅ **Brute force** - bcrypt password hashing  

### What We DON'T Protect Against

❌ **Physical device access** - If attacker has your device + .env file, they can decrypt  
❌ **Malware/keyloggers** - OS-level compromise  
❌ **Insider threat** - You have root access to your own data  

**Mitigation:**
- Store encryption keys in password manager
- Use full-disk encryption (FileVault, BitLocker)
- Keep backups on encrypted external drive

---

## Compliance

### HIPAA Safe Harbor

De-identification rules (§164.514(b)(2)):

✅ **18 identifiers removed** from cloud analytics:
1. Names
2. Geographic subdivisions (smaller than state)
3. Dates (except year)
4. Phone/fax numbers
5. Email addresses
6. SSN
7. Medical record numbers
8. Health plan beneficiary numbers
9. Account numbers
10. Certificate/license numbers
11. Vehicle identifiers
12. Device identifiers
13. URLs
14. IP addresses
15. Biometric identifiers
16. Photos
17. Other unique identifying codes

**Analytics:** Aggregated with ≥11 users (cell size minimum)

---

## Best Practices

### For Users

✅ **Use strong password** - 12+ chars, unique  
✅ **Enable FileVault** - macOS disk encryption  
✅ **Backup encryption key** - Store in 1Password/Bitwarden  
✅ **Verify backups** - Test restore monthly  
✅ **Update regularly** - Security patches  

### For Developers

✅ **Never commit .env** - Use .env.example template  
✅ **Rotate keys annually** - Update DB_ENCRYPTION_KEY  
✅ **Use parameterized queries** - Prevent SQL injection  
✅ **Audit dependencies** - `npm audit` regularly  
✅ **Test encryption** - Verify decrypt works  

---

## Encryption Verification

### Check Database Encryption

```bash
# Try to open without key (should fail)
sqlite3 medical-tracker.db "SELECT * FROM users;"
# Error: file is not a database

# With correct key (should work)
DB_ENCRYPTION_KEY=your-key npm run server
# ✅ Database encryption verified
```

### Verify Backup Integrity

```bash
# Check encrypted backup
file backup.db.enc
# Output: data (encrypted)

# Decrypt and verify
openssl enc -d -aes-256-cbc -in backup.db.enc -out test.db -k YOUR_KEY
sqlite3 test.db "PRAGMA integrity_check;"
# Output: ok
```

---

## Future Enhancements

### Planned (v0.2.0+)

- [ ] **macOS Keychain integration** - Store encryption keys securely
- [ ] **Key rotation** - Automated re-encryption with new keys
- [ ] **Hardware security** - Touch ID for app unlock
- [ ] **End-to-end encryption** - For cloud sync (zero-knowledge)
- [ ] **Audit log export** - CSV export for compliance

---

## Questions?

- **Lost encryption key?** Sorry, data is unrecoverable (by design)
- **Change encryption key?** Re-encrypt database (manual process)
- **Cloud backup security?** Encrypted client-side before upload
- **Compliance certifications?** HIPAA Safe Harbor compliant

See [HIPAA Compliance](hipaa-compliance.md) for full security roadmap.
