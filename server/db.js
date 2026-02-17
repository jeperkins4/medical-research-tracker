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
  `);

  // Run migrations for columns added after initial schema
  const migrations = [
    `ALTER TABLE portal_credentials ADD COLUMN sync_schedule TEXT DEFAULT 'manual'`,
    `ALTER TABLE portal_credentials ADD COLUMN sync_time TEXT`,
    `ALTER TABLE portal_credentials ADD COLUMN sync_day_of_week INTEGER`,
    `ALTER TABLE portal_credentials ADD COLUMN sync_day_of_month INTEGER`,
    `ALTER TABLE portal_credentials ADD COLUMN auto_sync_on_open INTEGER DEFAULT 0`,
    `ALTER TABLE portal_credentials ADD COLUMN notify_on_sync INTEGER DEFAULT 1`,
  ];

  for (const migration of migrations) {
    try {
      db.exec(migration);
    } catch (e) {
      // Column already exists — safe to ignore
      if (!e.message.includes('duplicate column name')) throw e;
    }
  }

  console.log('✅ Database initialized');

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
