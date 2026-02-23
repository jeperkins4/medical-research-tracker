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
      portal_id INTEGER,
      sync_date TEXT DEFAULT CURRENT_TIMESTAMP,
      records_synced INTEGER DEFAULT 0,
      status TEXT DEFAULT 'success',
      error_message TEXT,
      FOREIGN KEY (portal_id) REFERENCES portal_credentials (id) ON DELETE CASCADE
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
    )`
  ];
  
  tables.forEach(sql => {
    try {
      db.exec(sql);
    } catch (err) {
      console.error('[DB-IPC] Failed to create table:', err.message);
    }
  });
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
          therapies,
          pathways
        };
      }),
      summary: {
        totalMutations: mutations.length,
        actionableMutations: mutations.filter(m => m.clinical_significance === 'pathogenic' || m.clinical_significance === 'likely_pathogenic').length,
        highVAF: mutations.filter(m => m.vaf >= 20).length,
        mediumVAF: mutations.filter(m => m.vaf >= 10 && m.vaf < 20).length,
        lowVAF: mutations.filter(m => m.vaf < 10).length
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
    const stmt = db.prepare(`
      INSERT INTO genomic_mutations 
      (gene, mutation_type, mutation_detail, vaf, clinical_significance, report_source, report_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      data.gene,
      data.mutation_type,
      data.mutation_detail,
      data.vaf,
      data.clinical_significance,
      data.report_source,
      data.report_date,
      data.notes
    );
    
    return { success: true, id: result.lastInsertRowid };
  } catch (err) {
    console.error('[DB-IPC] Add genomic mutation failed:', err.message);
    return { success: false, error: err.message };
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
  closeDatabase
};
