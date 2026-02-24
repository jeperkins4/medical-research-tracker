/**
 * Electron IPC database handlers
 * Direct SQLite access from main process - no HTTP/localhost needed
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const crypto = require('crypto');

let db = null;
let dbPath = null;

/**
 * Initialize database with encryption
 */
function initDatabase(userDataPath) {
  console.log('[DB-IPC] Initializing database at:', userDataPath);
  
  // Ensure data directory exists (for backward compatibility with older versions)
  const dataDir = path.join(userDataPath, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  // Use existing database path (health-secure.db for compatibility with older versions)
  dbPath = path.join(dataDir, 'health-secure.db');
  
  console.log('[DB-IPC] Database path:', dbPath);
  
  // Open database
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  
  // Create tables if they don't exist
  createTables();
  
  console.log('[DB-IPC] Database initialized successfully');
  return true;
}

/**
 * Create database schema (compatible with existing health-secure.db format)
 */
function createTables() {
  const tables = [
    // Users table (multi-user support)
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Patient profile (single-user legacy format - no foreign key)
    `CREATE TABLE IF NOT EXISTS patient_profile (
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
    )`,
    
    // Conditions (single-user legacy format - no foreign key)
    `CREATE TABLE IF NOT EXISTS conditions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      diagnosed_date TEXT,
      status TEXT DEFAULT 'active',
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Medications (single-user legacy format - no foreign key)
    `CREATE TABLE IF NOT EXISTS medications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      dosage TEXT,
      frequency TEXT,
      started_date TEXT,
      stopped_date TEXT,
      reason TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Vitals (single-user legacy format - no foreign key)
    `CREATE TABLE IF NOT EXISTS vitals (
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
    )`,
    
    // Test Results (single-user legacy format - no foreign key)
    `CREATE TABLE IF NOT EXISTS test_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_name TEXT NOT NULL,
      result TEXT,
      date TEXT NOT NULL,
      provider TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Vault Master (for portal credential encryption)
    `CREATE TABLE IF NOT EXISTS vault_master (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      iterations INTEGER DEFAULT 100000,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Portal Credentials (encrypted storage)
    `CREATE TABLE IF NOT EXISTS portal_credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      portal_name TEXT NOT NULL,
      username TEXT NOT NULL,
      password_encrypted TEXT,
      url TEXT,
      notes TEXT,
      last_synced TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Portal Sync Log
    `CREATE TABLE IF NOT EXISTS portal_sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      credential_id INTEGER,
      sync_started TEXT,
      sync_completed TEXT,
      records_imported INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      error_message TEXT,
      FOREIGN KEY (credential_id) REFERENCES portal_credentials (id) ON DELETE CASCADE
    )`,
    
    // Genomic Mutations
    `CREATE TABLE IF NOT EXISTS genomic_mutations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gene TEXT NOT NULL,
      mutation_type TEXT,
      mutation_detail TEXT,
      vaf REAL,
      clinical_significance TEXT,
      report_source TEXT,
      report_date TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Mutation Therapies (targeted treatments)
    `CREATE TABLE IF NOT EXISTS mutation_therapies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mutation_id INTEGER NOT NULL,
      therapy_name TEXT NOT NULL,
      therapy_type TEXT,
      evidence_level TEXT,
      clinical_trial_id TEXT,
      trial_phase TEXT,
      mechanism TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (mutation_id) REFERENCES genomic_mutations (id) ON DELETE CASCADE
    )`,
    
    // Cellular Pathways affected by mutations
    `CREATE TABLE IF NOT EXISTS mutation_pathways (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mutation_id INTEGER NOT NULL,
      pathway_name TEXT NOT NULL,
      pathway_role TEXT,
      impact_description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (mutation_id) REFERENCES genomic_mutations (id) ON DELETE CASCADE
    )`,

    // ── Subscription Tracker ─────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS subscriptions (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id             INTEGER,
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
    )`,

    `CREATE TABLE IF NOT EXISTS subscription_payments (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      subscription_id       INTEGER NOT NULL,
      amount                REAL    NOT NULL,
      currency              TEXT    NOT NULL DEFAULT 'USD',
      paid_at               TEXT,
      billing_period_start  TEXT,
      billing_period_end    TEXT,
      status                TEXT    NOT NULL DEFAULT 'paid'
                              CHECK (status IN ('paid','failed','pending','refunded')),
      transaction_id        TEXT,
      notes                 TEXT,
      created_at            TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
    )`
  ];
  
  tables.forEach(sql => {
    try {
      db.exec(sql);
    } catch (err) {
      console.error('[DB-IPC] Failed to create table:', err.message);
    }
  });
  
  // Run migrations for existing databases
  migratePortalSyncLog();
  migratePortalCredentialColumns();
  migrateGenomicMutationColumns();
}

function migrateGenomicMutationColumns() {
  const needed = [
    ['transcript_id',        'TEXT'],
    ['coding_effect',        'TEXT'],
    ['exon',                 'TEXT'],
    ['protein_change',       'TEXT'],
    ['chromosome',           'TEXT'],
    ['position',             'TEXT'],
    ['allele_fraction',      'REAL'],
  ];
  try {
    const cols = db.prepare('PRAGMA table_info(genomic_mutations)').all();
    const existing = new Set(cols.map(c => c.name));
    for (const [col, def] of needed) {
      if (!existing.has(col)) {
        db.exec(`ALTER TABLE genomic_mutations ADD COLUMN ${col} ${def}`);
        console.log(`[DB-IPC] Migration: added genomic_mutations.${col}`);
      }
    }
  } catch (err) {
    console.error('[DB-IPC] migrateGenomicMutationColumns failed:', err.message);
  }
}

/**
 * Add missing columns to portal_credentials (safe, idempotent).
 * Aligns the schema used by portal-sync-ipc.cjs with what the DB actually has.
 */
function migratePortalCredentialColumns() {
  const needed = [
    // New schema columns vault-ipc.cjs expects (old table has portal_name/username/notes/url)
    ['service_name',            'TEXT'],
    ['username_encrypted',      'TEXT'],
    ['notes_encrypted',         'TEXT'],
    ['totp_secret_encrypted',   'TEXT'],
    ['updated_at',              'TEXT DEFAULT CURRENT_TIMESTAMP'],
    // Sync columns
    ['last_sync',               'TEXT'],
    ['last_sync_status',        "TEXT DEFAULT 'never'"],
    ['last_sync_records',       'INTEGER DEFAULT 0'],
    // Portal config columns
    ['portal_type',             "TEXT DEFAULT 'generic'"],
    ['base_url',                'TEXT'],
    ['mfa_method',              "TEXT DEFAULT 'none'"],
    ['auto_sync_on_open',       'INTEGER DEFAULT 0'],
    ['notify_on_sync',          'INTEGER DEFAULT 1'],
    ['sync_schedule',           "TEXT DEFAULT 'manual'"],
    ['sync_time',               "TEXT DEFAULT '02:00'"],
    ['sync_day_of_week',        'INTEGER DEFAULT 1'],
    ['sync_day_of_month',       'INTEGER DEFAULT 1'],
  ];

  try {
    const cols = db.prepare('PRAGMA table_info(portal_credentials)').all();
    const existing = new Set(cols.map(c => c.name));

    for (const [col, def] of needed) {
      if (!existing.has(col)) {
        db.exec(`ALTER TABLE portal_credentials ADD COLUMN ${col} ${def}`);
        console.log(`[DB-IPC] Migration: added portal_credentials.${col}`);
      }
    }

    // Backfill: copy portal_name → service_name and url → base_url for old rows
    if (!existing.has('service_name') || db.prepare(
      "SELECT COUNT(*) as n FROM portal_credentials WHERE service_name IS NULL AND portal_name IS NOT NULL"
    ).get()?.n > 0) {
      db.exec("UPDATE portal_credentials SET service_name = portal_name WHERE service_name IS NULL AND portal_name IS NOT NULL");
      console.log('[DB-IPC] Migration: backfilled service_name from portal_name');
    }
    if (!existing.has('base_url') || db.prepare(
      "SELECT COUNT(*) as n FROM portal_credentials WHERE base_url IS NULL AND url IS NOT NULL"
    ).get()?.n > 0) {
      db.exec("UPDATE portal_credentials SET base_url = url WHERE base_url IS NULL AND url IS NOT NULL");
      console.log('[DB-IPC] Migration: backfilled base_url from url');
    }
    if (!existing.has('username_encrypted') || db.prepare(
      "SELECT COUNT(*) as n FROM portal_credentials WHERE username_encrypted IS NULL AND username IS NOT NULL"
    ).get()?.n > 0) {
      db.exec("UPDATE portal_credentials SET username_encrypted = username WHERE username_encrypted IS NULL AND username IS NOT NULL");
      console.log('[DB-IPC] Migration: backfilled username_encrypted from username');
    }
  } catch (err) {
    console.error('[DB-IPC] migratePortalCredentialColumns failed:', err.message);
  }
}

/**
 * Migrate portal_sync_log table schema (portal_id → credential_id)
 */
function migratePortalSyncLog() {
  try {
    // Check if table exists and has old schema
    const tableInfo = db.prepare("PRAGMA table_info(portal_sync_log)").all();
    const hasOldSchema = tableInfo.some(col => col.name === 'portal_id');
    const hasNewSchema = tableInfo.some(col => col.name === 'credential_id');
    
    if (hasOldSchema && !hasNewSchema) {
      console.log('[DB-IPC] Migrating portal_sync_log schema...');
      
      // SQLite doesn't support ALTER COLUMN, so we need to recreate the table
      db.exec(`
        -- Create new table with correct schema
        CREATE TABLE portal_sync_log_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          credential_id INTEGER,
          sync_started TEXT,
          sync_completed TEXT,
          records_imported INTEGER DEFAULT 0,
          status TEXT DEFAULT 'pending',
          error_message TEXT,
          FOREIGN KEY (credential_id) REFERENCES portal_credentials (id) ON DELETE CASCADE
        );
        
        -- Copy data from old table (map portal_id to credential_id)
        INSERT INTO portal_sync_log_new (id, credential_id, sync_started, sync_completed, records_imported, status, error_message)
        SELECT id, portal_id, sync_date, sync_date, records_synced, status, error_message
        FROM portal_sync_log;
        
        -- Drop old table
        DROP TABLE portal_sync_log;
        
        -- Rename new table
        ALTER TABLE portal_sync_log_new RENAME TO portal_sync_log;
      `);
      
      console.log('[DB-IPC] portal_sync_log migration complete');
    }
  } catch (err) {
    console.error('[DB-IPC] portal_sync_log migration failed:', err.message);
  }
}

/**
 * Check if setup is needed (no users exist)
 */
function needsSetup() {
  if (!db) return true;
  const result = db.prepare('SELECT COUNT(*) as count FROM users').get();
  return result.count === 0;
}

/**
 * Create new user
 */
function createUser(username, password) {
  if (!db) throw new Error('Database not initialized');
  
  // Hash password
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  
  try {
    const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
    const result = stmt.run(username, hash);
    return { success: true, userId: result.lastInsertRowid };
  } catch (err) {
    console.error('[DB-IPC] Create user failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Verify user credentials
 */
function verifyUser(username, password) {
  if (!db) throw new Error('Database not initialized');
  
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  
  try {
    const user = db.prepare('SELECT id FROM users WHERE username = ? AND password_hash = ?').get(username, hash);
    if (user) {
      return { success: true, userId: user.id };
    }
    return { success: false, error: 'Invalid credentials' };
  } catch (err) {
    console.error('[DB-IPC] Verify user failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get user profile (legacy single-user format)
 */
function getProfile(userId) {
  if (!db) throw new Error('Database not initialized');
  
  try {
    // Legacy single-user - always get id=1
    const profile = db.prepare('SELECT * FROM patient_profile WHERE id = 1').get();
    return { success: true, profile: profile || {} };
  } catch (err) {
    console.error('[DB-IPC] Get profile failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Update user profile (legacy single-user format)
 */
function updateProfile(userId, data) {
  if (!db) throw new Error('Database not initialized');
  
  try {
    // Check if profile exists (legacy single-user - always id=1)
    const existing = db.prepare('SELECT id FROM patient_profile WHERE id = 1').get();
    
    if (existing) {
      // Update existing
      const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
      const values = Object.values(data);
      db.prepare(`UPDATE patient_profile SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = 1`).run(...values);
    } else {
      // Insert new (force id=1)
      const fields = Object.keys(data).join(', ');
      const placeholders = Object.keys(data).map(() => '?').join(', ');
      const values = Object.values(data);
      db.prepare(`INSERT INTO patient_profile (id, ${fields}) VALUES (1, ${placeholders})`).run(...values);
    }
    
    return { success: true };
  } catch (err) {
    console.error('[DB-IPC] Update profile failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get all conditions (legacy single-user format)
 */
function getConditions(userId) {
  if (!db) throw new Error('Database not initialized');
  
  try {
    // Legacy single-user - no user_id filter
    const conditions = db.prepare('SELECT * FROM conditions ORDER BY created_at DESC').all();
    return { success: true, conditions };
  } catch (err) {
    console.error('[DB-IPC] Get conditions failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get all medications (legacy single-user format)
 */
function getMedications(userId) {
  if (!db) throw new Error('Database not initialized');
  
  try {
    // Legacy single-user - no user_id filter
    const medications = db.prepare('SELECT * FROM medications ORDER BY created_at DESC').all();
    return { success: true, medications };
  } catch (err) {
    console.error('[DB-IPC] Get medications failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get recent vitals (legacy single-user format)
 */
function getVitals(userId, limit = 10) {
  if (!db) throw new Error('Database not initialized');
  
  try {
    // Legacy single-user - no user_id filter
    const vitals = db.prepare('SELECT * FROM vitals ORDER BY date DESC, time DESC LIMIT ?').all(limit);
    return { success: true, vitals };
  } catch (err) {
    console.error('[DB-IPC] Get vitals failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Add condition (legacy single-user format)
 */
function addCondition(userId, data) {
  if (!db) throw new Error('Database not initialized');
  
  try {
    // Legacy single-user - no user_id column
    const stmt = db.prepare('INSERT INTO conditions (name, diagnosed_date, status, notes) VALUES (?, ?, ?, ?)');
    const result = stmt.run(data.name, data.diagnosed_date, data.status || 'active', data.notes);
    return { success: true, id: result.lastInsertRowid };
  } catch (err) {
    console.error('[DB-IPC] Add condition failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Add medication (legacy single-user format)
 */
function addMedication(userId, data) {
  if (!db) throw new Error('Database not initialized');
  
  try {
    // Legacy single-user - no user_id column, different column names
    const stmt = db.prepare('INSERT INTO medications (name, dosage, frequency, started_date, stopped_date, reason, notes) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const result = stmt.run(data.name, data.dosage, data.frequency, data.start_date, data.end_date, data.purpose, data.notes);
    return { success: true, id: result.lastInsertRowid };
  } catch (err) {
    console.error('[DB-IPC] Add medication failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Add vitals (legacy single-user format)
 */
function addVitals(userId, data) {
  if (!db) throw new Error('Database not initialized');
  
  try {
    // Legacy single-user - no user_id column
    const stmt = db.prepare(`
      INSERT INTO vitals 
      (date, time, systolic, diastolic, heart_rate, temperature_f, respiratory_rate, oxygen_saturation, weight_lbs, height_inches, blood_glucose, pain_level, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.date, data.time, data.systolic, data.diastolic, data.heart_rate, 
      data.temperature_f, data.respiratory_rate, data.oxygen_saturation, 
      data.weight_lbs, data.height_inches, data.blood_glucose, data.pain_level, data.notes
    );
    return { success: true, id: result.lastInsertRowid };
  } catch (err) {
    console.error('[DB-IPC] Add vitals failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Close database
 */
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Get genomic dashboard data
 */
function getGenomicDashboard() {
  if (!db) throw new Error('Database not initialized');
  
  try {
    // Get all mutations with their therapies and pathways
    const mutations = db.prepare(`
      SELECT id, gene, mutation_type, mutation_detail, vaf, clinical_significance, 
             report_source, report_date, notes
      FROM genomic_mutations
      ORDER BY vaf DESC
    `).all();
    
    // For each mutation, get therapies and pathways
    const dashboard = {
      mutations: mutations.map(mutation => {
        const therapies = db.prepare(`
          SELECT id, therapy_name, therapy_type, evidence_level, clinical_trial_id, 
                 trial_phase, mechanism, notes
          FROM mutation_therapies
          WHERE mutation_id = ?
          ORDER BY CASE evidence_level
            WHEN 'FDA_approved' THEN 1
            WHEN 'Phase_3' THEN 2
            WHEN 'Phase_2' THEN 3
            WHEN 'Phase_1' THEN 4
            ELSE 5
          END
        `).all(mutation.id);
        
        const pathways = db.prepare(`
          SELECT pathway_name, pathway_role, impact_description
          FROM mutation_pathways
          WHERE mutation_id = ?
        `).all(mutation.id);
        
        return {
          ...mutation,
          // Normalised aliases for UI field names
          alteration: mutation.mutation_detail || mutation.mutation_type || '',
          variant_allele_frequency: mutation.vaf ?? null,
          transcript_id: mutation.transcript_id || null,
          coding_effect: mutation.coding_effect || null,
          pathway_count: pathways.length,
          treatment_count: therapies.length,
          trial_count: therapies.filter(t => t.clinical_trial_id).length,
          therapies,
          pathways
        };
      }),
      // Safe defaults for sections the IPC doesn't populate yet
      biomarkers: [],
      treatmentOpportunities: [],
      topTrials: [],
      summary: {
        totalMutations: mutations.length,
        actionableMutations: mutations.filter(m =>
          m.clinical_significance === 'pathogenic' ||
          m.clinical_significance === 'likely_pathogenic' ||
          m.clinical_significance === 'Pathogenic' ||
          m.clinical_significance === 'Likely pathogenic'
        ).length,
        highVAF: mutations.filter(m => (m.vaf ?? 0) >= 20).length,
        mediumVAF: mutations.filter(m => (m.vaf ?? 0) >= 10 && (m.vaf ?? 0) < 20).length,
        lowVAF: mutations.filter(m => (m.vaf ?? 0) < 10).length
      }
    };
    
    return dashboard;
  } catch (err) {
    console.error('[DB-IPC] Get genomic dashboard failed:', err.message);
    throw err;
  }
}

/**
 * Get mutation details by ID
 */
function getMutationDetails(mutationId) {
  if (!db) throw new Error('Database not initialized');
  
  try {
    const mutation = db.prepare(`
      SELECT * FROM genomic_mutations WHERE id = ?
    `).get(mutationId);
    
    if (!mutation) {
      throw new Error('Mutation not found');
    }
    
    const therapies = db.prepare(`
      SELECT * FROM mutation_therapies WHERE mutation_id = ?
    `).all(mutationId);
    
    const pathways = db.prepare(`
      SELECT * FROM mutation_pathways WHERE mutation_id = ?
    `).all(mutationId);
    
    return {
      ...mutation,
      therapies,
      pathways
    };
  } catch (err) {
    console.error('[DB-IPC] Get mutation details failed:', err.message);
    throw err;
  }
}

/**
 * Add genomic mutation
 */
function addGenomicMutation(data) {
  if (!db) throw new Error('Database not initialized');
  try {
    const result = db.prepare(`
      INSERT INTO genomic_mutations 
      (gene, mutation_type, mutation_detail, vaf, clinical_significance,
       report_source, report_date, notes,
       transcript_id, coding_effect, exon, protein_change, chromosome, position)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      data.gene, data.mutation_type, data.mutation_detail, data.vaf,
      data.clinical_significance, data.report_source, data.report_date, data.notes,
      data.transcript_id || null, data.coding_effect || null,
      data.exon || null, data.protein_change || null,
      data.chromosome || null, data.position || null
    );
    return { success: true, id: result.lastInsertRowid };
  } catch (err) {
    console.error('[DB-IPC] Add genomic mutation failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Import mutations from a parsed Foundation One report.
 * Returns counts of imported and skipped (duplicate) mutations.
 */
function importFoundationOneMutations(mutations, replaceExisting = false) {
  if (!db) throw new Error('Database not initialized');
  try {
    const checkStmt = db.prepare(
      'SELECT id FROM genomic_mutations WHERE gene = ? AND mutation_detail = ? AND mutation_type = ?'
    );

    let imported = 0;
    let skipped  = 0;

    const insertStmt = db.prepare(`
      INSERT INTO genomic_mutations
        (gene, mutation_type, mutation_detail, vaf, clinical_significance,
         report_source, report_date, notes,
         transcript_id, coding_effect, exon, protein_change)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `);

    db.transaction(() => {
      for (const m of mutations) {
        const existing = checkStmt.get(m.gene, m.mutation_detail || '', m.mutation_type || '');
        if (existing) {
          if (replaceExisting) {
            db.prepare(`
              UPDATE genomic_mutations SET
                vaf = ?, report_date = ?, report_source = ?,
                clinical_significance = ?
              WHERE id = ?
            `).run(m.vaf, m.report_date, m.report_source, m.clinical_significance, existing.id);
            imported++;
          } else {
            skipped++;
          }
        } else {
          insertStmt.run(
            m.gene, m.mutation_type || 'Short Variant', m.mutation_detail || '',
            m.vaf ?? null, m.clinical_significance || 'unknown',
            m.report_source || 'FoundationOne CDx', m.report_date || null,
            m.notes || null,
            m.transcript_id || null, m.coding_effect || null,
            m.exon || null, m.protein_change || null
          );
          imported++;
        }
      }
    })();

    return { success: true, imported, skipped, total: mutations.length };
  } catch (err) {
    console.error('[DB-IPC] importFoundationOneMutations failed:', err.message);
    return { success: false, error: err.message, imported: 0, skipped: 0 };
  }
}

/**
 * Add therapy for mutation
 */
function addMutationTherapy(data) {
  if (!db) throw new Error('Database not initialized');
  
  try {
    const stmt = db.prepare(`
      INSERT INTO mutation_therapies
      (mutation_id, therapy_name, therapy_type, evidence_level, clinical_trial_id, trial_phase, mechanism, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      data.mutation_id,
      data.therapy_name,
      data.therapy_type,
      data.evidence_level,
      data.clinical_trial_id,
      data.trial_phase,
      data.mechanism,
      data.notes
    );
    
    return { success: true, id: result.lastInsertRowid };
  } catch (err) {
    console.error('[DB-IPC] Add mutation therapy failed:', err.message);
    return { success: false, error: err.message };
  }
}

// ── Subscription Tracker ─────────────────────────────────────────────────────

const SUBSCRIPTION_CATEGORIES = [
  'AI & Machine Learning','Cloud Infrastructure','Communication & Collaboration',
  'Database & Storage','Development Tools','Domain & Hosting','Finance & Banking',
  'Healthcare & Medical','Media & Entertainment','Productivity','Security & Privacy',
  'Software / SaaS','Other',
];

function computeNextBillingDate(billing_cycle, billing_day, billing_month) {
  const now  = new Date();
  const next = new Date(now);
  switch (billing_cycle) {
    case 'monthly': {
      const day = billing_day || 1;
      next.setDate(day);
      if (next <= now) next.setMonth(next.getMonth() + 1);
      break;
    }
    case 'annual': {
      next.setMonth((billing_month || 1) - 1);
      next.setDate(billing_day || 1);
      if (next <= now) next.setFullYear(next.getFullYear() + 1);
      break;
    }
    case 'quarterly': { next.setMonth(next.getMonth() + 3); break; }
    case 'biannual':  { next.setMonth(next.getMonth() + 6); break; }
    case 'weekly':    { next.setDate(next.getDate() + 7);   break; }
    case 'one_time':
    default: return null;
  }
  return next.toISOString().split('T')[0];
}

function getSubscriptions(filters = {}) {
  try {
    let sql = 'SELECT * FROM subscriptions';
    const params = [];
    const clauses = [];
    if (filters.status)   { clauses.push('status = ?');   params.push(filters.status); }
    if (filters.category) { clauses.push('category = ?'); params.push(filters.category); }
    if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
    sql += ' ORDER BY service_name ASC';
    const rows = db.prepare(sql).all(...params);
    return rows.map(r => ({ ...r, tags: JSON.parse(r.tags || '[]') }));
  } catch (err) {
    console.error('[DB-IPC] getSubscriptions failed:', err.message);
    return [];
  }
}

function getSubscriptionSummary() {
  try {
    const subs = db.prepare(
      `SELECT * FROM subscriptions WHERE status IN ('active','trial')`
    ).all();
    let monthlyTotal = 0, annualTotal = 0;
    const byCategory = {};
    subs.forEach(s => {
      const cost = s.cost || 0;
      let m = 0;
      switch (s.billing_cycle) {
        case 'monthly':   m = cost;        annualTotal += cost * 12;  break;
        case 'annual':    m = cost / 12;   annualTotal += cost;       break;
        case 'quarterly': m = cost / 3;    annualTotal += cost * 4;   break;
        case 'biannual':  m = cost / 6;    annualTotal += cost * 2;   break;
        case 'weekly':    m = cost * 4.33; annualTotal += cost * 52;  break;
      }
      monthlyTotal += m;
      const cat = s.category || 'Other';
      if (!byCategory[cat]) byCategory[cat] = { count: 0, monthly: 0 };
      byCategory[cat].count++;
      byCategory[cat].monthly += m;
    });
    return {
      total_active:  subs.length,
      monthly_total: Math.round(monthlyTotal * 100) / 100,
      annual_total:  Math.round(annualTotal  * 100) / 100,
      by_category:   byCategory,
    };
  } catch (err) {
    console.error('[DB-IPC] getSubscriptionSummary failed:', err.message);
    return { total_active: 0, monthly_total: 0, annual_total: 0, by_category: {} };
  }
}

function addSubscription(data) {
  try {
    const {
      service_name, provider, category = 'Other', status = 'active',
      cost, currency = 'USD', billing_cycle = 'monthly',
      billing_day, billing_month, next_billing_date, trial_ends_at,
      auto_renews = 1, reminder_days = 3,
      payment_method, account_email, account_username,
      dashboard_url, support_url, notes, tags = [],
    } = data;
    if (!service_name) throw new Error('service_name is required');
    if (cost == null)  throw new Error('cost is required');

    const nextBill = next_billing_date ||
      computeNextBillingDate(billing_cycle, billing_day, billing_month);

    const result = db.prepare(`
      INSERT INTO subscriptions (
        service_name, provider, category, status,
        cost, currency, billing_cycle, billing_day, billing_month,
        next_billing_date, trial_ends_at, auto_renews, reminder_days,
        payment_method, account_email, account_username,
        dashboard_url, support_url, notes, tags
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      service_name, provider || null, category, status,
      cost, currency, billing_cycle,
      billing_day || null, billing_month || null,
      nextBill || null, trial_ends_at || null,
      auto_renews ? 1 : 0, reminder_days,
      payment_method || null, account_email || null, account_username || null,
      dashboard_url || null, support_url || null, notes || null,
      JSON.stringify(tags),
    );
    return { success: true, id: result.lastInsertRowid, service_name };
  } catch (err) {
    console.error('[DB-IPC] addSubscription failed:', err.message);
    return { success: false, error: err.message };
  }
}

function updateSubscription(id, data) {
  try {
    const current = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(id);
    if (!current) return { success: false, error: 'Not found' };
    const u = { ...current, ...data };
    if (data.status === 'cancelled' && current.status !== 'cancelled') {
      u.cancelled_at = new Date().toISOString();
    }
    if (!data.next_billing_date) {
      u.next_billing_date =
        computeNextBillingDate(u.billing_cycle, u.billing_day, u.billing_month)
        || current.next_billing_date;
    }
    db.prepare(`
      UPDATE subscriptions SET
        service_name=?, provider=?, category=?, status=?,
        cost=?, currency=?, billing_cycle=?, billing_day=?, billing_month=?,
        next_billing_date=?, trial_ends_at=?, auto_renews=?, reminder_days=?,
        payment_method=?, account_email=?, account_username=?,
        dashboard_url=?, support_url=?, notes=?, tags=?,
        cancelled_at=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(
      u.service_name, u.provider, u.category, u.status,
      u.cost, u.currency, u.billing_cycle, u.billing_day, u.billing_month,
      u.next_billing_date, u.trial_ends_at,
      u.auto_renews ? 1 : 0, u.reminder_days,
      u.payment_method, u.account_email, u.account_username,
      u.dashboard_url, u.support_url, u.notes,
      JSON.stringify(Array.isArray(u.tags) ? u.tags : JSON.parse(u.tags || '[]')),
      u.cancelled_at || null, id
    );
    return { success: true };
  } catch (err) {
    console.error('[DB-IPC] updateSubscription failed:', err.message);
    return { success: false, error: err.message };
  }
}

function deleteSubscription(id) {
  try {
    const result = db.prepare('DELETE FROM subscriptions WHERE id = ?').run(id);
    return { success: result.changes > 0 };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function getSubscriptionPayments(subscriptionId) {
  try {
    return db.prepare(
      'SELECT * FROM subscription_payments WHERE subscription_id = ? ORDER BY paid_at DESC'
    ).all(subscriptionId);
  } catch (err) {
    return [];
  }
}

function addSubscriptionPayment(subscriptionId, data) {
  try {
    const {
      amount, currency = 'USD', paid_at,
      billing_period_start, billing_period_end,
      status = 'paid', transaction_id, notes,
    } = data;
    if (amount == null) throw new Error('amount is required');

    const result = db.prepare(`
      INSERT INTO subscription_payments (
        subscription_id, amount, currency,
        paid_at, billing_period_start, billing_period_end,
        status, transaction_id, notes
      ) VALUES (?,?,?,?,?,?,?,?,?)
    `).run(
      subscriptionId, amount, currency,
      paid_at || new Date().toISOString(),
      billing_period_start || null, billing_period_end || null,
      status, transaction_id || null, notes || null,
    );

    if (status === 'paid') {
      const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(subscriptionId);
      if (sub) {
        const nextBill = computeNextBillingDate(sub.billing_cycle, sub.billing_day, sub.billing_month);
        if (nextBill) {
          db.prepare('UPDATE subscriptions SET next_billing_date=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
            .run(nextBill, subscriptionId);
        }
      }
    }

    return { success: true, id: result.lastInsertRowid };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  initDatabase,
  needsSetup,
  createUser,
  verifyUser,
  getProfile,
  updateProfile,
  getConditions,
  getMedications,
  getVitals,
  addCondition,
  addMedication,
  addVitals,
  getGenomicDashboard,
  getMutationDetails,
  addGenomicMutation,
  addMutationTherapy,
  importFoundationOneMutations,
  // Subscriptions
  SUBSCRIPTION_CATEGORIES,
  getSubscriptions,
  getSubscriptionSummary,
  addSubscription,
  updateSubscription,
  deleteSubscription,
  getSubscriptionPayments,
  addSubscriptionPayment,
  closeDatabase
};
