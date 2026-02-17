# HIPAA Minimum Viable Compliance - Implementation Guide

**Target:** 4 weeks, ~80 hours  
**Goal:** Make MRT safe to share without exposing PHI

This is the **pragmatic path** — critical security only, deferring nice-to-haves.

---

## Prerequisites

```bash
cd ~/.openclaw/workspace/medical-research-tracker

# Install new dependencies
npm install @journeyapps/sqlcipher node-cron
```

---

## Step 1: Database Encryption (SQLCipher)
**Time:** ~12 hours  
**Priority:** Critical

### 1.1 Generate Encryption Key

```bash
# Generate 64-character hex key
openssl rand -hex 32

# Add to .env
echo "DB_ENCRYPTION_KEY=<paste-key-here>" >> .env
```

### 1.2 Backup Existing Database

```bash
# Create backup directory
mkdir -p backups

# Backup current plaintext database
cp data/health.db backups/health_plaintext_$(date +%Y%m%d).db
```

### 1.3 Update Database Layer

Create `server/db-encrypted.js`:

```javascript
import Database from '@journeyapps/sqlcipher';
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
  // Validate encryption key
  const DB_KEY = process.env.DB_ENCRYPTION_KEY;
  if (!DB_KEY) {
    throw new Error('❌ DB_ENCRYPTION_KEY environment variable is required');
  }
  
  if (DB_KEY.length < 64) {
    throw new Error('❌ DB_ENCRYPTION_KEY must be at least 64 characters (use: openssl rand -hex 32)');
  }

  // Open encrypted database
  db = new Database(dbPath);
  
  // Set encryption key
  db.pragma(`key = "${DB_KEY}"`);
  db.pragma('cipher_compatibility = 4'); // SQLCipher 4.x
  
  // Test encryption (this will fail if key is wrong)
  try {
    db.prepare('SELECT 1').get();
    console.log('✅ Database encryption verified');
  } catch (err) {
    throw new Error('❌ Failed to decrypt database. Check DB_ENCRYPTION_KEY.');
  }
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Initialize schema (same as before)
  db.exec(`
    -- [COPY ENTIRE SCHEMA FROM server/db.js]
    -- User authentication
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    
    -- [... rest of schema ...]
  `);

  console.log('✅ Encrypted database initialized');
  
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
```

### 1.4 Migrate Data from Plaintext to Encrypted

Create `migrate-to-encrypted.js`:

```javascript
import Database from 'better-sqlite3';
import EncryptedDb from '@journeyapps/sqlcipher';
import 'dotenv/config';

const PLAINTEXT_DB = './backups/health_plaintext_<date>.db';
const ENCRYPTED_DB = './data/health.db';
const DB_KEY = process.env.DB_ENCRYPTION_KEY;

if (!DB_KEY) {
  throw new Error('DB_ENCRYPTION_KEY required');
}

console.log('📦 Starting migration to encrypted database...\n');

// Open plaintext database (read-only)
const oldDb = new Database(PLAINTEXT_DB, { readonly: true });

// Create new encrypted database
const newDb = new EncryptedDb(ENCRYPTED_DB);
newDb.pragma(`key = "${DB_KEY}"`);
newDb.pragma('cipher_compatibility = 4');

// Get list of all tables
const tables = oldDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();

for (const { name } of tables) {
  console.log(`Migrating table: ${name}`);
  
  // Get table schema
  const schema = oldDb.prepare(`SELECT sql FROM sqlite_master WHERE name = ?`).get(name);
  
  // Create table in encrypted DB
  if (schema && schema.sql) {
    newDb.exec(schema.sql);
  }
  
  // Copy data
  const rows = oldDb.prepare(`SELECT * FROM ${name}`).all();
  
  if (rows.length > 0) {
    const columns = Object.keys(rows[0]);
    const placeholders = columns.map(() => '?').join(',');
    const insertStmt = newDb.prepare(`INSERT INTO ${name} (${columns.join(',')}) VALUES (${placeholders})`);
    
    const insertMany = newDb.transaction((records) => {
      for (const record of records) {
        insertStmt.run(...columns.map(col => record[col]));
      }
    });
    
    insertMany(rows);
    console.log(`  ✅ Migrated ${rows.length} rows`);
  }
}

oldDb.close();
newDb.close();

console.log('\n✅ Migration complete! Encrypted database ready.');
console.log('⚠️  IMPORTANT: Securely delete the plaintext backup after verifying the encrypted DB works:');
console.log(`   shred -u ${PLAINTEXT_DB}`);
```

Run migration:

```bash
node migrate-to-encrypted.js
```

### 1.5 Update Server to Use Encrypted DB

```javascript
// server/index.js
// Change:
// import { init, query, run } from './db.js';
// To:
import { init, query, run } from './db-encrypted.js';
```

### 1.6 Test Encrypted Database

```bash
npm run server

# Should see:
# ✅ Database encryption verified
# ✅ Encrypted database initialized
# 🏥 Medical Research Tracker API running...
```

### 1.7 Securely Delete Plaintext Backup

```bash
# After confirming encrypted DB works:
shred -u backups/health_plaintext_*.db

# Verify it's gone:
ls -la backups/
```

---

## Step 2: HTTPS/TLS Transport Encryption
**Time:** ~4 hours  
**Priority:** Critical

### 2.1 Generate Self-Signed Certificate (Development)

```bash
# Create certs directory
mkdir -p certs

# Generate certificate (valid 365 days)
openssl req -x509 -newkey rsa:4096 -keyout certs/key.pem -out certs/cert.pem -days 365 -nodes -subj "/CN=localhost"

# Add to .gitignore
echo "certs/*.pem" >> .gitignore
```

### 2.2 Update Server for HTTPS

Edit `server/index.js`:

```javascript
import express from 'express';
import https from 'https';
import fs from 'fs';
import cors from 'cors';
import cookieParser from 'cookie-parser';
// ... other imports

const app = express();
const PORT = 3000;

// HTTPS configuration
const httpsOptions = {
  key: fs.readFileSync('./certs/key.pem'),
  cert: fs.readFileSync('./certs/cert.pem')
};

// ... middleware setup (cors, json, cookies)

// ... all route handlers

// Start HTTPS server (not HTTP)
https.createServer(httpsOptions, app).listen(PORT, '0.0.0.0', () => {
  console.log(`🔒 HTTPS server running on https://0.0.0.0:${PORT}`);
  console.log(`   Access from network at https://<your-mac-ip>:${PORT}`);
});
```

### 2.3 Update Vite for HTTPS

Edit `vite.config.js`:

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    https: {
      key: fs.readFileSync('./certs/key.pem'),
      cert: fs.readFileSync('./certs/cert.pem')
    },
    proxy: {
      '/api': {
        target: 'https://localhost:3000',
        changeOrigin: true,
        secure: false, // Allow self-signed cert in dev
      },
    },
  },
});
```

### 2.4 Update Cookie Security

Edit `server/auth.js`:

```javascript
export const generateToken = (userId, username) => {
  return jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
};

// Update cookie options (in login/setup endpoints)
res.cookie('auth_token', token, { 
  httpOnly: true, 
  secure: true,        // ✅ NEW: HTTPS only
  sameSite: 'strict',  // ✅ NEW: CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000 
});
```

### 2.5 Test HTTPS

```bash
npm run server

# In another terminal:
npm run dev

# Access: https://localhost:5173
# Browser will warn about self-signed cert — click "Advanced" → "Proceed"
```

### 2.6 Production Certificate (Let's Encrypt)

**When deploying to a VPS with a domain:**

```bash
# Install certbot
sudo apt-get install certbot

# Get certificate (requires domain pointing to your server)
sudo certbot certonly --standalone -d yourdomain.com

# Update server/index.js:
const httpsOptions = {
  key: fs.readFileSync('/etc/letsencrypt/live/yourdomain.com/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/yourdomain.com/fullchain.pem')
};

# Auto-renewal (certbot sets this up automatically)
sudo certbot renew --dry-run
```

---

## Step 3: Audit Logging
**Time:** ~16 hours  
**Priority:** Critical (HIPAA requirement)

### 3.1 Database Schema for Audit Logs

Create `server/migrations/001-audit-log.sql`:

```sql
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  action TEXT NOT NULL, -- 'login', 'logout', 'view', 'create', 'update', 'delete'
  resource_type TEXT NOT NULL, -- 'patient_profile', 'medications', 'vitals', etc.
  resource_id INTEGER,
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  status TEXT NOT NULL, -- 'success', 'failure', 'error'
  details TEXT, -- JSON for additional context
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_log(resource_type, resource_id);

-- Prevent tampering: no updates or deletes allowed
CREATE TRIGGER IF NOT EXISTS prevent_audit_update 
  BEFORE UPDATE ON audit_log
  BEGIN
    SELECT RAISE(ABORT, 'Audit logs are immutable');
  END;

CREATE TRIGGER IF NOT EXISTS prevent_audit_delete
  BEFORE DELETE ON audit_log
  BEGIN
    SELECT RAISE(ABORT, 'Audit logs cannot be deleted');
  END;
```

Run migration:

```javascript
// In server/db-encrypted.js, add to initDb():
db.exec(fs.readFileSync('./server/migrations/001-audit-log.sql', 'utf8'));
```

### 3.2 Audit Logging Module

Create `server/audit.js`:

```javascript
import { run } from './db-encrypted.js';

/**
 * Log an audit event
 * @param {number} userId - User ID performing the action
 * @param {string} username - Username
 * @param {string} action - Action performed (login, view, create, update, delete)
 * @param {string} resourceType - Resource type (medications, vitals, etc.)
 * @param {number|null} resourceId - Resource ID (if applicable)
 * @param {string} status - Status (success, failure, error)
 * @param {object} details - Additional context (JSON)
 * @param {object} req - Express request object (for IP/user agent)
 */
export function logAudit(userId, username, action, resourceType, resourceId, status, details, req) {
  const ip = req?.ip || req?.connection?.remoteAddress || 'unknown';
  const userAgent = req?.get?.('user-agent') || 'unknown';
  
  try {
    run(`
      INSERT INTO audit_log (user_id, username, action, resource_type, resource_id, ip_address, user_agent, status, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [userId, username, action, resourceType, resourceId || null, ip, userAgent, status, JSON.stringify(details || {})]);
  } catch (err) {
    console.error('❌ Failed to write audit log:', err.message);
  }
}

/**
 * Express middleware to auto-log all API requests
 */
export function auditMiddleware(req, res, next) {
  if (!req.user) return next(); // Skip unauthenticated requests
  
  // Capture original res.json to log after response
  const originalJson = res.json.bind(res);
  
  res.json = (data) => {
    const action = req.method === 'GET' ? 'view' : 
                   req.method === 'POST' ? 'create' :
                   req.method === 'PUT' ? 'update' :
                   req.method === 'DELETE' ? 'delete' : 'unknown';
    
    const pathParts = req.path.split('/').filter(Boolean); // ['api', 'medications', '123']
    const resourceType = pathParts[1] || 'unknown'; // 'medications'
    const resourceId = pathParts[2] ? parseInt(pathParts[2]) : null; // 123
    const status = res.statusCode < 400 ? 'success' : 'failure';
    
    logAudit(
      req.user.userId, 
      req.user.username, 
      action, 
      resourceType, 
      resourceId, 
      status, 
      { path: req.path, method: req.method }, 
      req
    );
    
    return originalJson(data);
  };
  
  next();
}
```

### 3.3 Apply Audit Middleware

Edit `server/index.js`:

```javascript
import { auditMiddleware, logAudit } from './audit.js';

// Apply to all protected routes (after requireAuth)
app.use('/api', requireAuth, auditMiddleware);

// Manually log auth events (login/logout don't use auditMiddleware)
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    logAudit(0, username || 'unknown', 'login', 'auth', null, 'failure', { reason: 'missing_credentials' }, req);
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  const users = query('SELECT * FROM users WHERE username = ?', [username]);
  
  if (users.length === 0) {
    logAudit(0, username, 'login', 'auth', null, 'failure', { reason: 'user_not_found' }, req);
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const user = users[0];
  const valid = await verifyPassword(password, user.password_hash);
  
  if (!valid) {
    logAudit(user.id, username, 'login', 'auth', null, 'failure', { reason: 'invalid_password' }, req);
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const token = generateToken(user.id, user.username);
  res.cookie('auth_token', token, { 
    httpOnly: true, 
    secure: true, 
    sameSite: 'strict', 
    maxAge: 7 * 24 * 60 * 60 * 1000 
  });
  
  logAudit(user.id, username, 'login', 'auth', null, 'success', {}, req);
  
  res.json({ success: true, username: user.username });
});

app.post('/api/auth/logout', (req, res) => {
  if (req.user) {
    logAudit(req.user.userId, req.user.username, 'logout', 'auth', null, 'success', {}, req);
  }
  res.clearCookie('auth_token');
  res.json({ success: true });
});
```

### 3.4 Audit Log Viewer API

Add to `server/index.js`:

```javascript
// GET /api/audit/logs (protected - requires auth)
app.get('/api/audit/logs', requireAuth, (req, res) => {
  const { limit = 100, offset = 0, user, action, resource, status } = req.query;
  
  let sql = 'SELECT * FROM audit_log WHERE 1=1';
  const params = [];
  
  if (user) {
    sql += ' AND username = ?';
    params.push(user);
  }
  
  if (action) {
    sql += ' AND action = ?';
    params.push(action);
  }
  
  if (resource) {
    sql += ' AND resource_type = ?';
    params.push(resource);
  }
  
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  
  sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  
  const logs = query(sql, params);
  res.json(logs);
});

// GET /api/audit/stats
app.get('/api/audit/stats', requireAuth, (req, res) => {
  const stats = query(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'failure' THEN 1 END) as failures,
      COUNT(CASE WHEN action = 'login' THEN 1 END) as logins,
      COUNT(CASE WHEN action = 'view' THEN 1 END) as views,
      MAX(timestamp) as last_activity
    FROM audit_log
  `);
  
  res.json(stats[0] || {});
});
```

### 3.5 Test Audit Logging

```bash
# Start server
npm run server

# Make some requests (login, view medications, etc.)

# Check audit logs:
curl -k https://localhost:3000/api/audit/logs --cookie "auth_token=<your-token>"

# Or in browser console:
fetch('/api/audit/logs').then(r => r.json()).then(console.log);
```

---

## Step 4: Session Timeouts
**Time:** ~4 hours  
**Priority:** High

### 4.1 Reduce JWT Expiry

Edit `server/auth.js`:

```javascript
// Change from 7 days to 15 minutes
const TOKEN_EXPIRY = '15m'; // HIPAA best practice
```

### 4.2 Client-Side Inactivity Lockout

Create `src/utils/sessionMonitor.js`:

```javascript
const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const WARNING_TIME = 13 * 60 * 1000; // Warn at 13 minutes
let activityTimer;
let warningTimer;

function resetActivityTimer() {
  clearTimeout(activityTimer);
  clearTimeout(warningTimer);
  
  // Show warning after 13 minutes
  warningTimer = setTimeout(() => {
    const shouldStay = confirm('⏰ Your session will expire in 2 minutes due to inactivity. Click OK to stay logged in.');
    
    if (shouldStay) {
      resetActivityTimer(); // User clicked OK, reset timer
    }
  }, WARNING_TIME);
  
  // Auto-logout after 15 minutes
  activityTimer = setTimeout(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login?reason=inactivity';
  }, INACTIVITY_TIMEOUT);
}

// Track user activity
const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
activityEvents.forEach(event => {
  document.addEventListener(event, resetActivityTimer, { passive: true });
});

// Start timer on page load
resetActivityTimer();

export default resetActivityTimer;
```

### 4.3 Token Refresh Strategy

Create `src/utils/tokenRefresh.js`:

```javascript
// Refresh token every 10 minutes (before 15-minute expiry)
setInterval(async () => {
  try {
    const response = await fetch('/api/auth/refresh', { method: 'POST' });
    
    if (!response.ok) {
      window.location.href = '/login?reason=session_expired';
    }
  } catch (err) {
    console.error('Token refresh failed:', err);
  }
}, 10 * 60 * 1000);
```

### 4.4 Add Token Refresh Endpoint

Edit `server/index.js`:

```javascript
app.post('/api/auth/refresh', requireAuth, (req, res) => {
  // Generate new token with same user
  const token = generateToken(req.user.userId, req.user.username);
  
  res.cookie('auth_token', token, { 
    httpOnly: true, 
    secure: true, 
    sameSite: 'strict', 
    maxAge: 7 * 24 * 60 * 60 * 1000 
  });
  
  logAudit(req.user.userId, req.user.username, 'refresh', 'auth', null, 'success', {}, req);
  
  res.json({ success: true });
});
```

### 4.5 Integrate Session Monitor

Edit `src/App.jsx`:

```javascript
import { useEffect } from 'react';
import sessionMonitor from './utils/sessionMonitor';
import './utils/tokenRefresh';

function App() {
  useEffect(() => {
    sessionMonitor(); // Start activity monitoring
  }, []);
  
  // ... rest of App component
}
```

---

## Step 5: Secrets Management
**Time:** ~2 hours  
**Priority:** High

### 5.1 Generate Strong Secrets

```bash
# JWT secret (64 bytes base64)
openssl rand -base64 64

# Database encryption key (32 bytes hex = 64 chars)
openssl rand -hex 32

# Backup encryption key (different from DB key!)
openssl rand -hex 32
```

### 5.2 Update .env Template

Edit `.env.example`:

```bash
# Security Keys (REQUIRED - generate with: openssl rand -base64 64)
JWT_SECRET=<64-char-base64-string>
DB_ENCRYPTION_KEY=<64-char-hex-string>
BACKUP_ENCRYPTION_KEY=<64-char-hex-string>

# OpenAI API Key (optional - for AI Healthcare Summary)
OPENAI_API_KEY=sk-...

# Server Configuration
PORT=3000
NODE_ENV=production

# CORS Configuration (production only - comma-separated HTTPS origins)
ALLOWED_ORIGINS=https://yourdomain.com
```

### 5.3 Enforce Required Secrets

Edit `server/auth.js`:

```javascript
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('❌ JWT_SECRET environment variable is required');
}

if (JWT_SECRET.length < 32) {
  throw new Error('❌ JWT_SECRET must be at least 32 characters (use: openssl rand -base64 64)');
}

// Remove fallback entirely
// const JWT_SECRET = process.env.JWT_SECRET || 'medical-tracker-secret-change-in-production'; // ❌ DELETE THIS
```

### 5.4 Add Startup Validation

Create `server/config-validator.js`:

```javascript
export function validateConfig() {
  const required = [
    'JWT_SECRET',
    'DB_ENCRYPTION_KEY'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\nSee .env.example for required configuration.');
    process.exit(1);
  }
  
  // Validate minimum lengths
  if (process.env.JWT_SECRET.length < 32) {
    console.error('❌ JWT_SECRET must be at least 32 characters');
    process.exit(1);
  }
  
  if (process.env.DB_ENCRYPTION_KEY.length < 64) {
    console.error('❌ DB_ENCRYPTION_KEY must be 64 characters (use: openssl rand -hex 32)');
    process.exit(1);
  }
  
  console.log('✅ Configuration validated');
}
```

Call in `server/index.js`:

```javascript
import { validateConfig } from './config-validator.js';

validateConfig(); // Run before starting server

// ... rest of server.js
```

---

## Step 6: CORS Hardening
**Time:** ~2 hours  
**Priority:** Medium

### 6.1 Update CORS Configuration

Edit `server/index.js`:

```javascript
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [
  'https://localhost:5173',  // Development
  'https://localhost:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like Postman, mobile apps)
    if (!origin) {
      return callback(null, true);
    }
    
    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️  Blocked CORS request from: ${origin}`);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true
}));
```

### 6.2 Production Configuration

```bash
# .env (production)
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

---

## Step 7: Encrypted Backups
**Time:** ~8 hours  
**Priority:** High

### 7.1 Backup Module

Create `server/backup.js`:

```javascript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { createReadStream, createWriteStream, readdirSync, statSync, unlinkSync } from 'fs';
import { pipeline } from 'stream/promises';
import { join } from 'path';

const BACKUP_KEY = process.env.BACKUP_ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Create encrypted backup of database
 */
export async function createEncryptedBackup(dbPath, backupPath) {
  if (!BACKUP_KEY) {
    throw new Error('BACKUP_ENCRYPTION_KEY environment variable required');
  }
  
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, Buffer.from(BACKUP_KEY, 'hex'), iv);
  
  const input = createReadStream(dbPath);
  const output = createWriteStream(backupPath);
  
  // Write IV to start of file
  output.write(iv);
  
  // Encrypt and write database
  await pipeline(input, cipher, output, { end: false });
  
  // Write auth tag to end of file
  const authTag = cipher.getAuthTag();
  output.write(authTag);
  output.end();
  
  console.log(`✅ Encrypted backup created: ${backupPath}`);
  return backupPath;
}

/**
 * Restore database from encrypted backup
 */
export async function restoreEncryptedBackup(backupPath, dbPath) {
  if (!BACKUP_KEY) {
    throw new Error('BACKUP_ENCRYPTION_KEY environment variable required');
  }
  
  const input = createReadStream(backupPath);
  
  // Read IV (first 16 bytes)
  const iv = await new Promise((resolve, reject) => {
    input.once('readable', () => {
      const chunk = input.read(IV_LENGTH);
      if (chunk) resolve(chunk);
      else reject(new Error('Failed to read IV'));
    });
  });
  
  // Read auth tag (last 16 bytes)
  const fileSize = statSync(backupPath).size;
  const encryptedDataLength = fileSize - IV_LENGTH - AUTH_TAG_LENGTH;
  
  const encrypted = await new Promise((resolve, reject) => {
    const chunks = [];
    input.on('data', chunk => chunks.push(chunk));
    input.on('end', () => resolve(Buffer.concat(chunks)));
    input.on('error', reject);
  });
  
  const encryptedData = encrypted.slice(0, encryptedDataLength);
  const authTag = encrypted.slice(encryptedDataLength);
  
  // Decrypt
  const decipher = createDecipheriv(ALGORITHM, Buffer.from(BACKUP_KEY, 'hex'), iv);
  decipher.setAuthTag(authTag);
  
  const output = createWriteStream(dbPath);
  await pipeline(
    async function* () {
      yield encryptedData;
    },
    decipher,
    output
  );
  
  console.log(`✅ Database restored from: ${backupPath}`);
  return dbPath;
}

/**
 * Delete backups older than specified days
 */
export function cleanupOldBackups(backupDir, retentionDays) {
  const now = Date.now();
  const maxAge = retentionDays * 24 * 60 * 60 * 1000;
  
  const files = readdirSync(backupDir);
  let deletedCount = 0;
  
  for (const file of files) {
    if (!file.endsWith('.db.enc')) continue;
    
    const filePath = join(backupDir, file);
    const stats = statSync(filePath);
    const age = now - stats.mtimeMs;
    
    if (age > maxAge) {
      unlinkSync(filePath);
      console.log(`🗑️  Deleted old backup: ${file} (${Math.floor(age / (24 * 60 * 60 * 1000))} days old)`);
      deletedCount++;
    }
  }
  
  if (deletedCount > 0) {
    console.log(`✅ Cleanup complete: ${deletedCount} old backups deleted`);
  }
}
```

### 7.2 Scheduled Backups

Edit `server/index.js`:

```javascript
import cron from 'node-cron';
import { createEncryptedBackup, cleanupOldBackups } from './backup.js';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const backupDir = './backups';
if (!existsSync(backupDir)) {
  mkdirSync(backupDir, { recursive: true });
}

// Daily backup at 2 AM
cron.schedule('0 2 * * *', async () => {
  const timestamp = new Date().toISOString().split('T')[0];
  const backupPath = join(backupDir, `health_${timestamp}.db.enc`);
  
  try {
    await createEncryptedBackup('./data/health.db', backupPath);
    
    // Cleanup backups older than 30 days
    cleanupOldBackups(backupDir, 30);
  } catch (err) {
    console.error('❌ Backup failed:', err.message);
    // TODO: Alert admin via email/SMS
  }
});

console.log('✅ Automated backups scheduled (daily at 2 AM)');
```

### 7.3 Manual Backup Script

Create `scripts/backup-now.js`:

```javascript
import 'dotenv/config';
import { createEncryptedBackup } from '../server/backup.js';
import { join } from 'path';

const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
const backupPath = join('./backups', `health_manual_${timestamp}.db.enc`);

createEncryptedBackup('./data/health.db', backupPath)
  .then(() => {
    console.log('✅ Manual backup complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Backup failed:', err.message);
    process.exit(1);
  });
```

Run manual backup:

```bash
node scripts/backup-now.js
```

---

## Step 8: Privacy Policy & BAA Template
**Time:** ~8 hours (legal review recommended)  
**Priority:** Medium (defer until actually sharing)

### 8.1 Privacy Policy Template

Create `docs/PRIVACY_POLICY.md` — see full HIPAA roadmap for template.

### 8.2 Business Associate Agreement (BAA)

Create `docs/BAA_TEMPLATE.md` — required if sharing with healthcare providers.

---

## Testing & Verification

### Security Checklist

```bash
# ✅ Database encryption
sqlite3 data/health.db ".tables"
# Should fail if encryption is working: "Error: file is not a database"

# ✅ HTTPS enabled
curl https://localhost:3000/api/health
# Should return SSL certificate info

# ✅ Audit logging
curl -k https://localhost:3000/api/audit/logs --cookie "auth_token=..."
# Should show logged actions

# ✅ Session timeout
# Leave browser idle for 15 minutes — should auto-logout

# ✅ Secrets validation
unset JWT_SECRET
npm run server
# Should fail with "JWT_SECRET environment variable is required"

# ✅ CORS hardening
curl -H "Origin: https://evil.com" https://localhost:3000/api/health
# Should return CORS error

# ✅ Encrypted backups
ls -lh backups/
# Should see .db.enc files
```

---

## Deployment

### Environment Variables (.env)

```bash
# Generate all secrets
JWT_SECRET=$(openssl rand -base64 64)
DB_ENCRYPTION_KEY=$(openssl rand -hex 32)
BACKUP_ENCRYPTION_KEY=$(openssl rand -hex 32)

# Create .env file
cat > .env << EOF
JWT_SECRET=${JWT_SECRET}
DB_ENCRYPTION_KEY=${DB_ENCRYPTION_KEY}
BACKUP_ENCRYPTION_KEY=${BACKUP_ENCRYPTION_KEY}
PORT=3000
NODE_ENV=production
ALLOWED_ORIGINS=https://yourdomain.com
EOF

# Secure permissions
chmod 600 .env
```

### Production Checklist

- [ ] All secrets generated and stored securely
- [ ] HTTPS certificate installed (Let's Encrypt)
- [ ] Database encrypted (SQLCipher)
- [ ] Audit logging active
- [ ] Automated backups scheduled
- [ ] Firewall configured (block all except 443)
- [ ] OS security patches applied
- [ ] Dependency vulnerabilities fixed (`npm audit`)

---

## Timeline

| Task | Hours | Week |
|------|-------|------|
| Database encryption (SQLCipher) | 12 | 1 |
| HTTPS/TLS setup | 4 | 1 |
| Audit logging | 16 | 2 |
| Session timeouts | 4 | 2 |
| Secrets management | 2 | 3 |
| CORS hardening | 2 | 3 |
| Encrypted backups | 8 | 3 |
| Privacy policy + BAA | 8 | 4 |
| **Total** | **56 hours** | **4 weeks** |

---

## Next Steps

Ready to implement? Let's start with **Phase 1.1: Database Encryption** — the biggest security win.

I can:
1. Generate the migration script
2. Update db.js to use SQLCipher
3. Test the encrypted database
4. Help you verify everything works

Want me to start? 🚀
