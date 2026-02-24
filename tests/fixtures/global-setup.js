/**
 * Playwright Global Setup
 * - Creates a fresh test database in a temp directory
 * - Seeds it with a test user + portal credential
 * - Starts the Express server on TEST_PORT (3999)
 * - Writes server handle to a temp file for teardown
 */

import { spawn }                    from 'child_process';
import { mkdtempSync, writeFileSync } from 'fs';
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

    CREATE TABLE IF NOT EXISTS genomic_mutations (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      gene                 TEXT NOT NULL,
      mutation_type        TEXT,
      mutation_detail      TEXT,
      vaf                  REAL,
      clinical_significance TEXT,
      report_source        TEXT,
      report_date          TEXT,
      notes                TEXT,
      transcript_id        TEXT,
      coding_effect        TEXT,
      created_at           TEXT DEFAULT CURRENT_TIMESTAMP
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

  // ── Seed: genomic mutation ─────────────────────────────────────────────────
  db.prepare(`
    INSERT OR IGNORE INTO genomic_mutations
      (gene, mutation_type, mutation_detail, vaf, clinical_significance, report_source, report_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('ARID1A', 'Short Variant', 'p.Q456*', 35.2, 'pathogenic',
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

  // Store for tests
  process.env.TEST_SERVER_PORT = String(TEST_PORT);
  process.env.TEST_DB_PATH = dbPath;
}
