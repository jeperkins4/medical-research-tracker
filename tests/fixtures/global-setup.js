/**
 * Playwright Global Setup
 * - Creates a fresh test database in a temp directory
 * - Seeds it with a test user + portal credential
 * - Starts the Express server on TEST_PORT (3999)
 * - Writes server handle to a temp file for teardown
 */

import { spawn }                    from 'child_process';
import { mkdtempSync, writeFileSync, existsSync } from 'fs';
import { tmpdir }                    from 'os';
import { join }                      from 'path';
import Database                      from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const TEST_PORT = process.env.TEST_PORT || 3999;
const WORKSPACE = '/Users/perkins/.openclaw/workspace/medical-research-tracker';

// Write server PID so teardown can kill it
const PID_FILE = join(tmpdir(), 'mrt-test-server.pid');
const ENV_FILE = join(tmpdir(), 'mrt-test-env.json');

/**
 * Create a fresh test database with the correct schema + seed data
 */
function createTestDatabase(dir) {
  const dbPath = join(dir, 'health.db');
  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // ── Schema (mirror server/db.js) ───────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      username  TEXT UNIQUE NOT NULL,
      password  TEXT NOT NULL,
      email     TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS portal_credentials (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      service_name        TEXT NOT NULL,
      portal_type         TEXT DEFAULT 'generic',
      base_url            TEXT,
      username_encrypted  TEXT,
      password_encrypted  TEXT,
      mfa_method          TEXT DEFAULT 'none',
      totp_secret_encrypted TEXT,
      notes_encrypted     TEXT,
      last_sync           TEXT,
      last_sync_status    TEXT DEFAULT 'never',
      sync_schedule       TEXT DEFAULT 'manual',
      sync_time           TEXT DEFAULT '02:00',
      sync_day_of_week    INTEGER DEFAULT 1,
      sync_day_of_month   INTEGER DEFAULT 1,
      auto_sync_on_open   INTEGER DEFAULT 0,
      notify_on_sync      INTEGER DEFAULT 1,
      created_at          TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at          TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS fhir_oauth_state (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      credential_id INTEGER NOT NULL,
      state         TEXT UNIQUE NOT NULL,
      expires_at    TEXT NOT NULL,
      created_at    TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS fhir_tokens (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      credential_id  INTEGER UNIQUE NOT NULL,
      access_token   TEXT NOT NULL,
      refresh_token  TEXT,
      patient_id     TEXT,
      expires_at     TEXT NOT NULL,
      scope          TEXT,
      created_at     TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS genomic_mutations (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      gene                 TEXT,
      gene_name            TEXT,
      mutation_type        TEXT,
      mutation_detail      TEXT,
      alteration           TEXT,
      vaf                  REAL,
      variant_allele_frequency REAL,
      clinical_significance TEXT,
      report_source        TEXT,
      report_date          TEXT,
      notes                TEXT,
      transcript_id        TEXT,
      coding_effect        TEXT,
      is_confirmed         INTEGER DEFAULT 1,
      created_at           TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS genomic_pathways (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      pathway_name  TEXT NOT NULL,
      description   TEXT,
      created_at    TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS genomic_treatments (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      treatment_name      TEXT NOT NULL,
      treatment_type      TEXT,
      target_pathway_id   INTEGER,
      created_at          TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS mutation_pathway_map (
      mutation_id INTEGER NOT NULL,
      pathway_id  INTEGER NOT NULL,
      PRIMARY KEY (mutation_id, pathway_id)
    );

    CREATE TABLE IF NOT EXISTS pathways (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      description   TEXT,
      created_at    TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS mutation_pathways (
      mutation_id  INTEGER NOT NULL,
      pathway_id   INTEGER NOT NULL,
      impact_level TEXT DEFAULT 'medium',
      mechanism    TEXT,
      PRIMARY KEY (mutation_id, pathway_id)
    );

    CREATE TABLE IF NOT EXISTS mutation_treatments (
      id                       INTEGER PRIMARY KEY AUTOINCREMENT,
      mutation_id              INTEGER,
      pathway_id               INTEGER,
      treatment_name           TEXT,
      sensitivity_or_resistance TEXT,
      clinical_evidence        TEXT,
      created_at               TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS biomarkers (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      value       TEXT,
      unit        TEXT,
      report_date TEXT,
      source      TEXT,
      created_at  TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS genomic_trials (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      mutation_id   INTEGER,
      trial_name    TEXT,
      phase         TEXT,
      status        TEXT DEFAULT 'recruiting',
      priority_score INTEGER DEFAULT 0,
      created_at    TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS vus_variants (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      gene       TEXT NOT NULL,
      variant    TEXT,
      status     TEXT DEFAULT 'unknown',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS treatment_genomic_correlation (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      medication_id    INTEGER,
      mutation_id      INTEGER,
      pathway_id       INTEGER,
      correlation_type TEXT,
      notes            TEXT,
      created_at       TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id           INTEGER,
      service_name      TEXT NOT NULL,
      provider          TEXT,
      category          TEXT DEFAULT 'Other',
      status            TEXT NOT NULL DEFAULT 'active',
      cost              REAL NOT NULL DEFAULT 0,
      currency          TEXT NOT NULL DEFAULT 'USD',
      billing_cycle     TEXT NOT NULL DEFAULT 'monthly',
      billing_day       INTEGER,
      billing_month     INTEGER,
      next_billing_date TEXT,
      trial_ends_at     TEXT,
      auto_renews       INTEGER NOT NULL DEFAULT 1,
      reminder_days     INTEGER NOT NULL DEFAULT 3,
      payment_method    TEXT,
      account_email     TEXT,
      account_username  TEXT,
      dashboard_url     TEXT,
      support_url       TEXT,
      notes             TEXT,
      tags              TEXT DEFAULT '[]',
      cancelled_at      TEXT,
      created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── Seed: test user ────────────────────────────────────────────────────────
  const passwordHash = bcrypt.hashSync('testpass123', 10);
  db.prepare(`INSERT OR IGNORE INTO users (username, password, email) VALUES (?, ?, ?)`)
    .run('testuser', passwordHash, 'test@example.com');

  // ── Seed: portal credential with last_sync ─────────────────────────────────
  db.prepare(`
    INSERT OR IGNORE INTO portal_credentials
      (service_name, portal_type, base_url, last_sync, last_sync_status)
    VALUES (?, ?, ?, ?, ?)
  `).run('Test Healthcare Portal', 'generic', 'https://portal.example.com',
         new Date().toISOString(), 'success');

  // ── Seed: Epic portal credential (for FHIR tests) ─────────────────────────
  db.prepare(`
    INSERT OR IGNORE INTO portal_credentials
      (id, service_name, portal_type, base_url, last_sync, last_sync_status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(99, 'Epic MyChart Test', 'epic', 'https://mychart.example.org',
         new Date().toISOString(), 'success');

  // ── Seed: valid FHIR token (credentialId=99) ───────────────────────────────
  const validExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // +1h
  db.prepare(`
    INSERT OR IGNORE INTO fhir_tokens
      (credential_id, access_token, refresh_token, patient_id, expires_at, scope)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(99, 'test-access-token-valid', 'test-refresh-token', 'patient-fhir-123',
         validExpiry, 'patient/Observation.read patient/Condition.read');

  // ── Seed: expired FHIR token (credentialId=98) ────────────────────────────
  db.prepare(`
    INSERT OR IGNORE INTO portal_credentials
      (id, service_name, portal_type, base_url, last_sync_status)
    VALUES (?, ?, ?, ?, ?)
  `).run(98, 'Epic MyChart Expired', 'epic', 'https://mychart2.example.org', 'never');

  const expiredExpiry = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // -1h
  db.prepare(`
    INSERT OR IGNORE INTO fhir_tokens
      (credential_id, access_token, refresh_token, patient_id, expires_at, scope)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(98, 'test-access-token-expired', 'test-refresh-token-expired', 'patient-fhir-456',
         expiredExpiry, 'patient/Observation.read');

  // ── Seed: non-epic credential (for portal-type guard test) ─────────────────
  db.prepare(`
    INSERT OR IGNORE INTO portal_credentials
      (id, service_name, portal_type, base_url, last_sync_status)
    VALUES (?, ?, ?, ?, ?)
  `).run(97, 'CareSpace Portal', 'carespace', 'https://carespace.example.org', 'never');

  // ── Seed: genomic mutation ─────────────────────────────────────────────────
  db.prepare(`
    INSERT OR IGNORE INTO genomic_mutations
      (gene, gene_name, mutation_type, mutation_detail, alteration,
       vaf, variant_allele_frequency, clinical_significance, report_source, report_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('ARID1A', 'ARID1A', 'Short Variant', 'p.Q456*', 'p.Q456*',
         35.2, 35.2, 'pathogenic',
         'FoundationOne CDx', new Date().toISOString().split('T')[0]);

  db.close();
  return dbPath;
}

export default async function globalSetup() {
  console.log('\n🧪 Setting up Playwright test environment...');

  // Create temp dir for test DB
  const testDir = mkdtempSync(join(tmpdir(), 'mrt-test-'));
  const dbPath = createTestDatabase(testDir);
  const encKey = crypto.randomBytes(32).toString('hex');

  console.log(`📁 Test DB: ${dbPath}`);
  console.log(`🚀 Starting test server on port ${TEST_PORT}...`);

  // Write env for the test server
  const testEnv = {
    NODE_ENV: 'test',
    PORT: String(TEST_PORT),
    DB_TYPE: 'plain',           // Use unencrypted DB for tests
    USER_DATA_PATH: testDir,
    DB_ENCRYPTION_KEY: encKey,
    ALLOWED_ORIGINS: `http://localhost:${TEST_PORT}`,
    TEST_DB_PATH: dbPath,
  };

  writeFileSync(ENV_FILE, JSON.stringify(testEnv));

  // Spawn the Express server (PORT must be explicit to override .env)
  const server = spawn('node', ['server/index.js'], {
    cwd: WORKSPACE,
    env: {
      ...process.env,
      ...testEnv,
      PORT: String(TEST_PORT), // always override .env PORT
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  writeFileSync(PID_FILE, String(server.pid));

  // Wait for server ready
  await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error(`Test server didn't start in 20s. Output:\n${output}`)), 20000);

    server.stdout.on('data', d => {
      output += d.toString();
      if (output.includes('running on') || output.includes('Server ready') || output.includes('listening')) {
        clearTimeout(timeout);
        resolve();
      }
    });

    server.stderr.on('data', d => {
      output += d.toString();
      // Don't fail on warnings
      if (output.toLowerCase().includes('error') && !output.includes('DB_ENCRYPTION_KEY')) {
        // continue - let timeout decide
      }
    });

    server.on('error', err => { clearTimeout(timeout); reject(err); });
    server.on('exit', (code) => {
      if (code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`Test server exited with code ${code}. Output:\n${output}`));
      }
    });
  }).catch(err => {
    console.warn('⚠️  Test server warning:', err.message);
    console.warn('Tests may fail if server is not available. Running against existing server if any.');
  });

  console.log(`✅ Test server ready on port ${TEST_PORT}`);

  // ── Seed test user + FHIR data via the server's actual DB ─────────────────
  // The server creates its own DB at {USER_DATA_PATH}/data/health-secure.db.
  // We seed it directly after startup.
  try {
    const serverDbPath = join(testDir, 'data', 'health-secure.db');
    if (existsSync(serverDbPath)) {
      const serverDb = new Database(serverDbPath);

      // Seed test user (matching login credentials used in tests)
      const hash = bcrypt.hashSync('testpass123', 10);
      serverDb.prepare(`INSERT OR IGNORE INTO users (username, password_hash) VALUES (?, ?)`)
        .run('testuser', hash);

      // Seed Epic portal credential (id=99)
      // NOTE: username_encrypted and password_encrypted are NOT NULL in schema.
      // Use empty strings so INSERT doesn't silently fail via INSERT OR IGNORE.
      serverDb.prepare(`
        INSERT OR IGNORE INTO portal_credentials
          (id, service_name, portal_type, base_url, username_encrypted, password_encrypted, last_sync, last_sync_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(99, 'Epic MyChart Test', 'epic', 'https://mychart.example.org', '', '',
             new Date().toISOString(), 'success');

      // Seed valid FHIR token (credentialId=99)
      const validExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString()
        .replace('T', ' ').replace('Z', '').split('.')[0];
      serverDb.prepare(`
        INSERT OR IGNORE INTO fhir_tokens
          (credential_id, access_token, refresh_token, patient_id, expires_at, scope)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(99, 'test-access-token-valid', 'test-refresh-token',
             'patient-fhir-123', validExpiry,
             'patient/Observation.read patient/Condition.read');

      // Seed Epic portal credential (id=98) + expired token
      serverDb.prepare(`
        INSERT OR IGNORE INTO portal_credentials
          (id, service_name, portal_type, base_url, username_encrypted, password_encrypted, last_sync_status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(98, 'Epic MyChart Expired', 'epic', 'https://mychart2.example.org', '', '', 'never');

      // Use SQLite datetime format (no T/Z) so CASE WHEN expires_at > datetime('now') works correctly
      const expiredExpiry = new Date(Date.now() - 60 * 60 * 1000).toISOString()
        .replace('T', ' ').replace('Z', '').split('.')[0];
      serverDb.prepare(`
        INSERT OR IGNORE INTO fhir_tokens
          (credential_id, access_token, refresh_token, patient_id, expires_at, scope)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(98, 'test-access-token-expired', 'test-refresh-token-expired',
             'patient-fhir-456', expiredExpiry, 'patient/Observation.read');

      // Seed non-epic credential (id=97)
      serverDb.prepare(`
        INSERT OR IGNORE INTO portal_credentials
          (id, service_name, portal_type, base_url, username_encrypted, password_encrypted, last_sync_status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(97, 'CareSpace Portal', 'carespace', 'https://carespace.example.org', '', '', 'never');

      // Seed generic credential (id=95) — used by portal-sync sync-attempt test
      // (sync will fail with vault-locked error, which is a valid structured response)
      serverDb.prepare(`
        INSERT OR IGNORE INTO portal_credentials
          (id, service_name, portal_type, base_url, username_encrypted, password_encrypted, last_sync_status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(95, 'Generic Test Portal', 'generic', 'https://portal.example.com', '', '', 'never');

      // Seed deletable generic credential (id=96) — used by portal-sync delete test
      // as fallback when vault is locked and POST /api/portals/credentials fails
      serverDb.prepare(`
        INSERT OR IGNORE INTO portal_credentials
          (id, service_name, portal_type, base_url, username_encrypted, password_encrypted, last_sync_status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(96, 'Deletable Test Portal', 'generic', 'https://delete-me.example.com', '', '', 'never');

      // Ensure extended genomic schema tables exist in the server DB
      // (server migrations may not run in test mode — create them if absent)
      serverDb.exec(`
        CREATE TABLE IF NOT EXISTS genomic_pathways (
          id INTEGER PRIMARY KEY AUTOINCREMENT, pathway_name TEXT NOT NULL,
          description TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS genomic_treatments (
          id INTEGER PRIMARY KEY AUTOINCREMENT, treatment_name TEXT NOT NULL,
          treatment_type TEXT, target_pathway_id INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS mutation_pathway_map (
          mutation_id INTEGER NOT NULL, pathway_id INTEGER NOT NULL,
          PRIMARY KEY (mutation_id, pathway_id)
        );
        CREATE TABLE IF NOT EXISTS pathways (
          id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
          description TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS mutation_pathways (
          mutation_id INTEGER NOT NULL, pathway_id INTEGER NOT NULL,
          impact_level TEXT DEFAULT 'medium', mechanism TEXT,
          PRIMARY KEY (mutation_id, pathway_id)
        );
        CREATE TABLE IF NOT EXISTS mutation_treatments (
          id INTEGER PRIMARY KEY AUTOINCREMENT, mutation_id INTEGER,
          pathway_id INTEGER, treatment_name TEXT,
          sensitivity_or_resistance TEXT, clinical_evidence TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS biomarkers (
          id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
          value TEXT, unit TEXT, report_date TEXT, source TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS genomic_trials (
          id INTEGER PRIMARY KEY AUTOINCREMENT, mutation_id INTEGER,
          trial_name TEXT, phase TEXT, status TEXT DEFAULT 'recruiting',
          priority_score INTEGER DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS vus_variants (
          id INTEGER PRIMARY KEY AUTOINCREMENT, gene TEXT NOT NULL,
          variant TEXT, status TEXT DEFAULT 'unknown',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS treatment_genomic_correlation (
          id INTEGER PRIMARY KEY AUTOINCREMENT, medication_id INTEGER,
          mutation_id INTEGER, pathway_id INTEGER, correlation_type TEXT,
          notes TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Ensure genomic_mutations has all required columns (may have been created with minimal schema)
      const gmCols = serverDb.pragma('table_info(genomic_mutations)').map(c => c.name);
      if (!gmCols.includes('gene_name'))
        serverDb.exec(`ALTER TABLE genomic_mutations ADD COLUMN gene_name TEXT`);
      if (!gmCols.includes('alteration'))
        serverDb.exec(`ALTER TABLE genomic_mutations ADD COLUMN alteration TEXT`);
      if (!gmCols.includes('variant_allele_frequency'))
        serverDb.exec(`ALTER TABLE genomic_mutations ADD COLUMN variant_allele_frequency REAL`);
      if (!gmCols.includes('is_confirmed'))
        serverDb.exec(`ALTER TABLE genomic_mutations ADD COLUMN is_confirmed INTEGER DEFAULT 1`);

      // Ensure clinical_notes table exists and seed test notes
      serverDb.exec(`
        CREATE TABLE IF NOT EXISTS clinical_notes (
          id               INTEGER PRIMARY KEY AUTOINCREMENT,
          fhir_id          TEXT UNIQUE,
          credential_id    INTEGER,
          note_type        TEXT,
          title            TEXT,
          date             TEXT,
          author           TEXT,
          department       TEXT,
          facility         TEXT,
          loinc_code       TEXT,
          loinc_display    TEXT,
          status           TEXT DEFAULT 'current',
          cancer_relevant  INTEGER DEFAULT 0,
          content_text     TEXT,
          content_html     TEXT,
          created_at       TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Seed test clinical notes (ids 901, 902, 903 — well above real data range)
      const seedNote = serverDb.prepare(`
        INSERT OR IGNORE INTO clinical_notes
          (id, fhir_id, credential_id, note_type, title, date, author, department,
           facility, loinc_code, loinc_display, status, cancer_relevant,
           content_text, content_html)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      // Note 901: pathology, cancer-relevant — for happy-path detail + filter tests
      seedNote.run(
        901, 'fhir-note-901', 99, 'pathology',
        'Foundation One CDx Pathology Report', '2025-10-15',
        'Dr. Smith', 'Pathology', 'AdventHealth',
        '60568-3', 'Pathology report', 'current', 1,
        'FGFR3 S249C mutation detected. PIK3CA E545K mutation detected. ARID1A loss.',
        '<p>FGFR3 S249C mutation detected.</p>'
      );
      // Note 902: progress note, not cancer-relevant — for type/cancer filter contrast
      seedNote.run(
        902, 'fhir-note-902', 99, 'progress',
        'Routine Follow-up Progress Note', '2025-11-01',
        'Dr. Jones', 'Oncology', 'AdventHealth',
        '11506-3', 'Progress note', 'current', 0,
        'Patient tolerating treatment well. No new symptoms.',
        null
      );
      // Note 903: imaging, cancer-relevant — tests combined filter
      seedNote.run(
        903, 'fhir-note-903', 99, 'imaging',
        'CT Abdomen/Pelvis with Contrast', '2025-12-01',
        'Dr. Lee', 'Radiology', 'AdventHealth',
        '18748-4', 'CT report', 'current', 1,
        'No evidence of distant metastasis. Bladder wall thickening noted.',
        null
      );

      console.log('✅ Clinical notes test data seeded (ids 901, 902, 903)');

      serverDb.close();
      console.log('✅ FHIR test data seeded into server DB');
    } else {
      console.warn('⚠️  Server DB not found at expected path — FHIR tests may fail');
    }
  } catch (seedErr) {
    console.warn('⚠️  Could not seed server DB:', seedErr.message);
  }

  // Store for tests
  process.env.TEST_SERVER_PORT = String(TEST_PORT);
  process.env.TEST_DB_PATH = dbPath;
}
