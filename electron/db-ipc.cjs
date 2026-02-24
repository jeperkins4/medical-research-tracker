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

  // Per-column try-catch so one failure never blocks the rest
  let existing = new Set();
  try {
    existing = new Set(db.prepare('PRAGMA table_info(portal_credentials)').all().map(c => c.name));
  } catch (e) { console.error('[DB-IPC] PRAGMA table_info failed:', e.message); }

  for (const [col, def] of needed) {
    if (!existing.has(col)) {
      try {
        db.exec(`ALTER TABLE portal_credentials ADD COLUMN ${col} ${def}`);
        console.log(`[DB-IPC] Migration: added portal_credentials.${col}`);
        existing.add(col);
      } catch (colErr) {
        if (!colErr.message.includes('duplicate column')) {
          console.error(`[DB-IPC] Migration failed for ${col}:`, colErr.message);
        }
      }
    }
  }

  try {
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
  closeDatabase
};
