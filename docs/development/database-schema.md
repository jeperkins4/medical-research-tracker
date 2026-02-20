# Database Schema Reference

**Complete SQLite schema for MyTreatmentPath.**

All tables are encrypted with AES-256-CBC. PHI tables never sync to cloud.

---

## User Management

### `users`

Local user accounts.

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  -- Cloud sync fields (added v0.1.1)
  supabase_user_id TEXT,
  email TEXT,
  last_synced_at TEXT,
  sync_status TEXT DEFAULT 'local_only'
    CHECK (sync_status IN ('local_only', 'syncing', 'synced', 'sync_failed'))
);
```

---

## PHI Tables (NEVER sync to cloud)

### `patient_profile`

Patient demographics and insurance.

```sql
CREATE TABLE patient_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),  -- Single record
  first_name TEXT,
  last_name TEXT,
  date_of_birth TEXT,
  sex TEXT CHECK (sex IN ('M', 'F', 'Other', 'Prefer not to say')),
  blood_type TEXT,
  height_inches REAL,
  weight_lbs REAL,
  allergies TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  primary_physician TEXT,
  insurance_provider TEXT,
  insurance_id TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### `conditions`

Diagnoses and medical conditions.

```sql
CREATE TABLE conditions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  diagnosis_date TEXT,
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'resolved', 'chronic')),
  severity TEXT CHECK (severity IN ('mild', 'moderate', 'severe')),
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### `medications`

Prescriptions, supplements, and integrative treatments.

```sql
CREATE TABLE medications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  dosage TEXT,
  frequency TEXT,
  type TEXT CHECK (type IN (
    'chemotherapy', 'immunotherapy', 'targeted_therapy',
    'supplement', 'integrative', 'supportive_care', 'other'
  )),
  start_date TEXT,
  end_date TEXT,
  prescriber TEXT,
  notes TEXT,
  active BOOLEAN DEFAULT 1,
  evidence_level TEXT,  -- 'fda_approved', 'clinical_trial', 'preclinical', 'mechanistic'
  genomic_targets TEXT, -- JSON array: ['FGFR3', 'PIK3CA']
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### `lab_results`

Blood tests, imaging, tumor markers.

```sql
CREATE TABLE lab_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_name TEXT NOT NULL,
  result_value TEXT,
  result_unit TEXT,
  reference_range TEXT,
  abnormal_flag BOOLEAN DEFAULT 0,
  test_date TEXT,
  lab_name TEXT,
  notes TEXT,
  category TEXT,  -- 'cbc', 'cmp', 'tumor_marker', 'kidney', 'liver', 'other'
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### `vitals`

Weight, blood pressure, symptoms, pain scores.

```sql
CREATE TABLE vitals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN (
    'weight', 'blood_pressure', 'temperature', 'heart_rate',
    'pain_score', 'fatigue_score', 'nausea_score', 'symptom'
  )),
  value TEXT NOT NULL,
  unit TEXT,
  recorded_at TEXT DEFAULT CURRENT_TIMESTAMP,
  notes TEXT
);
```

### `genomic_mutations`

Foundation One, Tempus, Caris genomic data.

```sql
CREATE TABLE genomic_mutations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gene TEXT NOT NULL,
  variant_type TEXT,  -- 'activating', 'loss_of_function', 'amplification'
  clinical_significance TEXT,
  allele_frequency REAL,
  pathway TEXT,  -- 'PI3K/AKT/mTOR', 'FGFR', 'HIF1', etc.
  targetable_with TEXT,  -- JSON array of drugs/supplements
  evidence_level TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### `meal_analyses`

AI-powered nutrition tracking.

```sql
CREATE TABLE meal_analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meal_description TEXT NOT NULL,
  meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  analyzed_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  -- Nutrition facts
  calories INTEGER,
  protein_grams REAL,
  carbs_grams REAL,
  fat_grams REAL,
  fiber_grams REAL,
  
  -- AI analysis
  genomic_compatibility TEXT,  -- JSON: mutation-specific recommendations
  treatment_interactions TEXT,  -- JSON: drug interactions
  recommendations TEXT,
  analysis_model TEXT  -- 'claude-sonnet-4-6'
);
```

---

## Research Library (Syncs to cloud)

### `papers`

PubMed articles and clinical trials.

```sql
CREATE TABLE papers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  authors TEXT,
  journal TEXT,
  publication_date TEXT,
  abstract TEXT,
  url TEXT,
  pmid TEXT,  -- PubMed ID
  doi TEXT,
  type TEXT DEFAULT 'research'
    CHECK (type IN ('research', 'clinical_trial', 'review', 'meta_analysis')),
  cancer_type TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  -- Cloud sync fields (added v0.1.1)
  supabase_paper_id TEXT,
  synced_at TEXT
);
```

### `tags`

Paper categorization.

```sql
CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  category TEXT,  -- 'mutation', 'treatment', 'diet', 'trial', etc.
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### `paper_tags`

Many-to-many join table.

```sql
CREATE TABLE paper_tags (
  paper_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (paper_id, tag_id),
  FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
```

---

## Cloud Sync

### `sync_log`

Audit trail of all sync events.

```sql
CREATE TABLE sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('user', 'research', 'full')),
  status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
  items_synced INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## System Tables

### `audit_log`

Authentication events.

```sql
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  username TEXT,
  action TEXT NOT NULL,  -- 'login', 'logout', 'register', 'backup'
  status TEXT NOT NULL,  -- 'success', 'failure'
  reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### `backup_metadata`

Automated backup tracking.

```sql
CREATE TABLE backup_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  backup_path TEXT NOT NULL,
  size_bytes INTEGER,
  encrypted BOOLEAN DEFAULT 1,
  backup_type TEXT DEFAULT 'automated'
    CHECK (backup_type IN ('automated', 'manual')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## Analytics (Optional, HIPAA Safe Harbor)

### `analytics_events`

Anonymized usage analytics.

```sql
CREATE TABLE analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  event_category TEXT,
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
  user_id_hash TEXT,  -- SHA-256 hash (not reversible)
  session_id TEXT,
  properties TEXT  -- JSON (no PHI)
);
```

### `analytics_aggregates`

Pre-computed aggregates (≥11 users).

```sql
CREATE TABLE analytics_aggregates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_name TEXT NOT NULL,
  date TEXT NOT NULL,
  count INTEGER,
  average REAL,
  min REAL,
  max REAL,
  metadata TEXT,  -- JSON
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

---

## Indexes

**Performance optimization for common queries.**

```sql
-- Users
CREATE INDEX idx_users_supabase ON users(supabase_user_id);
CREATE INDEX idx_users_email ON users(email);

-- Papers
CREATE INDEX idx_papers_pmid ON papers(pmid);
CREATE INDEX idx_papers_doi ON papers(doi);
CREATE INDEX idx_papers_supabase ON papers(supabase_paper_id);
CREATE INDEX idx_papers_created ON papers(created_at DESC);

-- Lab results
CREATE INDEX idx_labs_date ON lab_results(test_date DESC);
CREATE INDEX idx_labs_category ON lab_results(category);

-- Vitals
CREATE INDEX idx_vitals_date ON vitals(recorded_at DESC);
CREATE INDEX idx_vitals_type ON vitals(type);

-- Medications
CREATE INDEX idx_medications_active ON medications(active);
CREATE INDEX idx_medications_type ON medications(type);

-- Sync log
CREATE INDEX idx_sync_log_user ON sync_log(user_id, created_at DESC);

-- Audit log
CREATE INDEX idx_audit_log_user ON audit_log(user_id, created_at DESC);
```

---

## Migrations

Database schema changes tracked in `server/migrations/`.

**Applied migrations:**
- `001_initial_schema.sql` - Base tables
- `002_genomics.sql` - Genomic mutations + pathways
- `003_analytics.sql` - HIPAA-compliant analytics
- `004_add_cloud_sync.sql` - Sync tracking (v0.1.1)

**Run migration:**
```bash
node run-cloud-sync-migration.js
```

---

## Data Types

### SQLite → JavaScript

```javascript
// SQLite          → JavaScript
INTEGER            → number
REAL               → number
TEXT               → string
BOOLEAN            → boolean (0/1)
NULL               → null
```

### JSON Fields

Several fields store JSON for flexibility:

```javascript
// genomic_mutations.targetable_with
["Erdafitinib", "BGJ398", "Curcumin"]

// medications.genomic_targets
["FGFR3", "PIK3CA"]

// meal_analyses.genomic_compatibility
{
  "ARID1A": "Turmeric inhibits HIF1α",
  "PIK3CA": "Green tea modulates PI3K"
}
```

---

## Constraints

### Primary Keys
- `INTEGER PRIMARY KEY AUTOINCREMENT` - Auto-incrementing IDs
- Single-record tables use `CHECK (id = 1)` (e.g., patient_profile)

### Foreign Keys
- `ON DELETE CASCADE` - Delete related records
- `ON DELETE SET NULL` - Set to NULL on parent delete

### Check Constraints
- Enum-like values: `CHECK (type IN ('a', 'b', 'c'))`
- Boolean flags: `BOOLEAN DEFAULT 0` (SQLite stores as 0/1)

### Unique Constraints
- `username` - No duplicate usernames
- `tag.name` - No duplicate tags

---

## Vacuum & Maintenance

**Weekly maintenance:**
```sql
VACUUM;
ANALYZE;
```

**Check integrity:**
```sql
PRAGMA integrity_check;
-- Output: ok
```

**Check encryption:**
```bash
sqlite3 medical-tracker.db "SELECT * FROM users;"
# Error: file is not a database (good!)
```

---

## Backup & Restore

### Backup
```bash
# Encrypted backup (automated daily at 2 AM)
sqlite3 medical-tracker.db ".backup backups/backup-2026-02-19.db"

# Encrypt with AES-256
openssl enc -aes-256-cbc -in backup.db -out backup.db.enc -k YOUR_KEY
```

### Restore
```bash
# Decrypt
openssl enc -d -aes-256-cbc -in backup.db.enc -out restored.db -k YOUR_KEY

# Verify
sqlite3 restored.db "PRAGMA integrity_check;"
```

---

## Schema Evolution

**v0.1.0 → v0.1.1:**
- Added `users.supabase_user_id`
- Added `users.email`
- Added `users.last_synced_at`
- Added `users.sync_status`
- Added `papers.supabase_paper_id`
- Added `papers.synced_at`
- Created `sync_log` table

**Backward compatible:** Old databases auto-migrate on startup.

---

## Questions?

- **Add new table?** Create migration in `server/migrations/`
- **Query examples?** See [API Reference](api-reference.md)
- **Performance issues?** Add index with `CREATE INDEX`
