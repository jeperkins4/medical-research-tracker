import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dataDir = join(__dirname, '..', 'data');
const dbPath = join(dataDir, 'health.db');

// Ensure data directory exists
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

let db;

const initDb = () => {
  // Open database (creates if doesn't exist)
  db = new Database(dbPath);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Initialize schema
  db.exec(`
    -- User authentication
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Patient profile
    CREATE TABLE IF NOT EXISTS patient_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      first_name TEXT,
      last_name TEXT,
      date_of_birth TEXT,
      sex TEXT,
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
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Health profile
    CREATE TABLE IF NOT EXISTS conditions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      diagnosed_date TEXT,
      status TEXT DEFAULT 'active',
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS symptoms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      severity INTEGER CHECK(severity BETWEEN 1 AND 10),
      date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS medications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      dosage TEXT,
      frequency TEXT,
      started_date TEXT,
      stopped_date TEXT,
      reason TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS test_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_name TEXT NOT NULL,
      result TEXT,
      date TEXT NOT NULL,
      provider TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS vitals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      time TEXT,
      systolic INTEGER,
      diastolic INTEGER,
      heart_rate INTEGER,
      temperature_f REAL,
      respiratory_rate INTEGER,
      oxygen_saturation INTEGER,
      weight_lbs REAL,
      height_inches REAL,
      blood_glucose REAL,
      pain_level INTEGER CHECK(pain_level BETWEEN 0 AND 10),
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Dietary habits and philosophy
    CREATE TABLE IF NOT EXISTS dietary_habits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Secure credential vault for healthcare portal integration
    CREATE TABLE IF NOT EXISTS vault_master (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      iterations INTEGER DEFAULT 100000,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS portal_credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_name TEXT NOT NULL,
      portal_type TEXT NOT NULL,
      base_url TEXT,
      username_encrypted TEXT NOT NULL,
      password_encrypted TEXT NOT NULL,
      mfa_method TEXT DEFAULT 'none',
      totp_secret_encrypted TEXT,
      notes_encrypted TEXT,
      last_sync TEXT,
      last_sync_status TEXT DEFAULT 'never',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS portal_sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      credential_id INTEGER NOT NULL,
      sync_started TEXT NOT NULL,
      sync_completed TEXT,
      status TEXT NOT NULL,
      records_imported INTEGER DEFAULT 0,
      error_message TEXT,
      FOREIGN KEY (credential_id) REFERENCES portal_credentials(id) ON DELETE CASCADE
    );

    -- Associations between conditions and other records
    CREATE TABLE IF NOT EXISTS condition_vitals (
      condition_id INTEGER,
      vital_id INTEGER,
      PRIMARY KEY (condition_id, vital_id),
      FOREIGN KEY (condition_id) REFERENCES conditions(id),
      FOREIGN KEY (vital_id) REFERENCES vitals(id)
    );

    CREATE TABLE IF NOT EXISTS condition_symptoms (
      condition_id INTEGER,
      symptom_id INTEGER,
      PRIMARY KEY (condition_id, symptom_id),
      FOREIGN KEY (condition_id) REFERENCES conditions(id),
      FOREIGN KEY (symptom_id) REFERENCES symptoms(id)
    );

    CREATE TABLE IF NOT EXISTS condition_tests (
      condition_id INTEGER,
      test_id INTEGER,
      PRIMARY KEY (condition_id, test_id),
      FOREIGN KEY (condition_id) REFERENCES conditions(id),
      FOREIGN KEY (test_id) REFERENCES test_results(id)
    );

    -- Research library
    CREATE TABLE IF NOT EXISTS papers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pubmed_id TEXT UNIQUE,
      title TEXT NOT NULL,
      authors TEXT,
      journal TEXT,
      publication_date TEXT,
      abstract TEXT,
      url TEXT,
      type TEXT DEFAULT 'conventional',
      saved_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS paper_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paper_id INTEGER NOT NULL,
      note TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (paper_id) REFERENCES papers(id)
    );

    CREATE TABLE IF NOT EXISTS clinical_trials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nct_id TEXT UNIQUE,
      title TEXT NOT NULL,
      status TEXT,
      phase TEXT,
      conditions TEXT,
      interventions TEXT,
      locations TEXT,
      url TEXT,
      saved_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS paper_tags (
      paper_id INTEGER,
      tag_id INTEGER,
      PRIMARY KEY (paper_id, tag_id),
      FOREIGN KEY (paper_id) REFERENCES papers(id),
      FOREIGN KEY (tag_id) REFERENCES tags(id)
    );

    -- ── Subscription Tracker ──────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS subscriptions (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id             INTEGER REFERENCES users(id) ON DELETE CASCADE,
      service_name        TEXT    NOT NULL,
      provider            TEXT,
      category            TEXT    DEFAULT 'Other',
      status              TEXT    NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','trial','paused','cancelled','inactive')),
      cost                REAL    NOT NULL DEFAULT 0,
      currency            TEXT    NOT NULL DEFAULT 'USD',
      billing_cycle       TEXT    NOT NULL DEFAULT 'monthly'
                            CHECK (billing_cycle IN ('monthly','annual','quarterly','biannual','weekly','one_time')),
      billing_day         INTEGER CHECK (billing_day BETWEEN 1 AND 31),
      billing_month       INTEGER CHECK (billing_month BETWEEN 1 AND 12),
      next_billing_date   TEXT,
      trial_ends_at       TEXT,
      auto_renews         INTEGER NOT NULL DEFAULT 1,
      reminder_days       INTEGER NOT NULL DEFAULT 3,
      payment_method      TEXT,
      account_email       TEXT,
      account_username    TEXT,
      dashboard_url       TEXT,
      support_url         TEXT,
      notes               TEXT,
      tags                TEXT    DEFAULT '[]',
      cancelled_at        TEXT,
      created_at          TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at          TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subscription_payments (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      subscription_id       INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
      amount                REAL    NOT NULL,
      currency              TEXT    NOT NULL DEFAULT 'USD',
      paid_at               TEXT,
      billing_period_start  TEXT,
      billing_period_end    TEXT,
      status                TEXT    NOT NULL DEFAULT 'paid'
                              CHECK (status IN ('paid','failed','pending','refunded')),
      transaction_id        TEXT,
      notes                 TEXT,
      created_at            TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('✅ Database initialized');

  // --- Migrations (safe, idempotent) ---
  const runMigration = (table, column, definition) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    const exists = cols.some(c => c.name === column);
    if (!exists) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      console.log(`✅ Migration: added ${table}.${column}`);
    }
  };

  runMigration('portal_credentials', 'last_sync',           'TEXT');
  runMigration('portal_credentials', 'last_sync_status',    "TEXT DEFAULT 'never'");
  runMigration('portal_credentials', 'sync_schedule',       "TEXT DEFAULT 'manual'");
  runMigration('portal_credentials', 'sync_time',           "TEXT DEFAULT '02:00'");
  runMigration('portal_credentials', 'sync_day_of_week',    'INTEGER DEFAULT 1');
  runMigration('portal_credentials', 'sync_day_of_month',   'INTEGER DEFAULT 1');
  runMigration('portal_credentials', 'auto_sync_on_open',   'INTEGER DEFAULT 0');
  runMigration('portal_credentials', 'notify_on_sync',      'INTEGER DEFAULT 1');
  runMigration('genomic_mutations',  'transcript_id',       'TEXT');
  runMigration('genomic_mutations',  'coding_effect',       'TEXT');
  runMigration('genomic_mutations',  'exon',                'TEXT');
  runMigration('genomic_mutations',  'protein_change',      'TEXT');
  // --- End migrations ---

  return db;
};

// Query function - returns array of objects
export const query = (sql, params = []) => {
  const stmt = db.prepare(sql);
  return stmt.all(...params);
};

// Run function - for INSERT/UPDATE/DELETE
export const run = (sql, params = []) => {
  const stmt = db.prepare(sql);
  const info = stmt.run(...params);
  return { lastInsertRowid: info.lastInsertRowid, changes: info.changes };
};

// Initialize and export
export const init = initDb;
export const getDb = () => db;
