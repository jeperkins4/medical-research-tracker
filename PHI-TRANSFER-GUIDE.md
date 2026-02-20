# PHI Data Transfer Guide

## Overview

Securely transfer your complete health database between devices (e.g., Macbook → Mac Mini) without cloud sync.

**Security:** AES-256-GCM encryption with user-provided password  
**Format:** Encrypted binary file (`.enc`)  
**One-way transfer:** This is NOT a sync system. Each export/import is a standalone snapshot.

---

## Quick Start

### Export (Source Device)

1. Open Medical Research Tracker
2. Navigate to **Profile → Settings**
3. Scroll to **PHI Data Transfer** section
4. Enter a **strong password** (minimum 8 characters)
5. Click **Export Database**
6. Save the `.enc` file to a secure location

**File saved:** `health-data-export-YYYY-MM-DDTHH-MM-SS.enc`

---

### Import (Target Device)

1. Transfer the `.enc` file to your target device (USB drive, secure transfer)
2. Open Medical Research Tracker on target device
3. Navigate to **Profile → Settings → PHI Data Transfer**
4. Choose import mode:
   - **Merge** (recommended): Combines imported data with existing data
   - **Replace** (⚠️ destructive): Deletes all existing data first
5. Click **Select Export File** and choose your `.enc` file
6. Enter the **same password** you used when exporting
7. Click **Import Database**
8. Page will reload automatically after successful import

---

## Import Modes

### Merge Mode (Recommended)
- Combines imported data with existing data
- Skips duplicate records (based on PRIMARY KEY/UNIQUE constraints)
- Safe for multiple imports
- **Use case:** Transfer data from Macbook to Mac Mini while keeping any local changes on Mac Mini

### Replace Mode (⚠️ Destructive)
- **Deletes ALL existing data** before importing
- Completely replaces database with imported data
- Cannot be undone
- **Use case:** Fresh start on a new device, exact clone of source database

---

## Security Best Practices

### Password
- **Use a strong, unique password** for each export
- Minimum 8 characters (longer is better)
- Store password securely (password manager recommended)
- **Do NOT reuse your login password**

### Storage
- Store `.enc` file on **encrypted USB drive** or secure cloud storage
- **Delete the export file** after successful import
- Do not leave export files on shared drives or cloud storage long-term

### Transfer Method
- **Preferred:** Physical USB drive (offline transfer)
- **Acceptable:** Encrypted file transfer (e.g., AirDrop with encryption, secure SFTP)
- **Avoid:** Unencrypted email, public cloud links

---

## Technical Details

### Encryption
- **Algorithm:** AES-256-GCM (authenticated encryption)
- **Key derivation:** scrypt (password → 256-bit key)
- **Components:**
  - Random salt (32 bytes)
  - Random IV (16 bytes)
  - Authentication tag (16 bytes)
  - Encrypted data

### Export Format
```
[salt (32 bytes)][IV (16 bytes)][authTag (16 bytes)][encrypted JSON data]
```

### Database Export
All tables are exported as JSON:
```json
{
  "users": [...],
  "lab_results": [...],
  "medications": [...],
  "supplements": [...],
  // ... all tables
}
```

### Import Process
1. Extract salt, IV, authTag from encrypted file
2. Derive decryption key from password + salt
3. Decrypt data using AES-256-GCM
4. Verify authentication tag (detects tampering/wrong password)
5. Parse JSON
6. Insert/update records into SQLite database

---

## API Endpoints

### Export
```http
POST /api/phi/export
Content-Type: application/json

{
  "password": "your-strong-password"
}

Response: Binary file (application/octet-stream)
```

### Import
```http
POST /api/phi/import
Content-Type: multipart/form-data

Fields:
- file: .enc file
- password: decryption password
- mode: "merge" | "replace"

Response:
{
  "success": true,
  "stats": {
    "mode": "merge",
    "totalInserted": 1234,
    "totalUpdated": 0,
    "totalSkipped": 56,
    "tables": {
      "medications": { "inserted": 12, "updated": 0, "skipped": 3 },
      // ... per-table stats
    }
  }
}
```

---

## Troubleshooting

### "Invalid password or corrupted data"
- **Cause:** Wrong password OR file corruption
- **Fix:** Double-check password (case-sensitive). If still fails, re-export from source device.

### Import appears stuck
- **Cause:** Large database can take 30-60 seconds
- **Wait:** Progress indicator shown. Do not refresh page.

### "File required" error
- **Cause:** No file selected
- **Fix:** Click "Select Export File" and choose your `.enc` file

### Data missing after import
- **Cause:** Using **Replace** mode deleted data before import
- **Fix:** No recovery possible. Re-import with **Merge** mode next time.

### Network/CORS errors
- **Cause:** Server not running or CORS misconfiguration
- **Fix:** Ensure server is running (`npm run server`) and accessing from `localhost:5173`

---

## Use Cases

### Scenario 1: Macbook → Mac Mini Transfer
1. **Export from Macbook:** Save to USB drive
2. **Transfer:** Plug USB into Mac Mini
3. **Import on Mac Mini:** Use "Merge" mode
4. **Result:** Mac Mini now has all Macbook data + any local data preserved

### Scenario 2: Fresh Install
1. **Export from current device:** Before reinstalling OS
2. **Reinstall OS:** Fresh system
3. **Install Medical Research Tracker:** New installation
4. **Import:** Use "Replace" mode (empty database anyway)
5. **Result:** Exact clone of previous database

### Scenario 3: Device Upgrade
1. **Export from old device**
2. **Set up new device**
3. **Import with Replace mode**
4. **Verify data integrity**
5. **Delete export file from old device**

---

## Limitations

- **Not a sync system:** Each export is a snapshot. Changes after export are NOT reflected.
- **No conflict resolution:** If both devices have changes, "Merge" mode keeps both (duplicates possible).
- **No versioning:** Cannot compare export files or merge selectively.
- **File size:** Large databases (100+ MB) may take 1-2 minutes to export/import.

---

## Future Enhancements

Potential improvements (not yet implemented):

- [ ] Selective table export (choose which tables to include)
- [ ] Compression (gzip encrypted data to reduce file size)
- [ ] Incremental exports (only changes since last export)
- [ ] Export verification (checksum before/after transfer)
- [ ] Automatic backups before import
- [ ] Export history tracking

---

## Support

**Questions?** Open an issue on GitHub or contact support@mytreatmentpath.com

**Security concerns?** security@mytreatmentpath.com (PGP key available)

---

Built with ❤️ for secure, private health data management.
