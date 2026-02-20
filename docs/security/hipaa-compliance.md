# HIPAA Compliance Roadmap for Medical Research Tracker

**Status:** Proactive compliance preparation for potential future sharing  
**Last Updated:** 2026-02-13  
**Risk Level:** Personal use → Shared deployment

---

## Executive Summary

### Current Security Posture: **Foundation Strong, Gaps Critical**

**Strengths (Already Implemented):**
- ✅ AES-256-GCM encryption for portal credentials
- ✅ PBKDF2 key derivation (100k iterations)
- ✅ Session-based encryption key management
- ✅ bcrypt password hashing (user authentication)
- ✅ JWT authentication with httpOnly cookies
- ✅ SQL prepared statements (injection protection)
- ✅ Local-first data storage (no cloud PHI exposure)

**Critical HIPAA Gaps:**
- ❌ **No database encryption at rest** (PHI stored in plaintext SQLite)
- ❌ **HTTP only** (no TLS/HTTPS transport encryption)
- ❌ **No audit logging** (HIPAA requires access logs + integrity monitoring)
- ❌ **No session timeouts** (abandoned sessions = exposure risk)
- ❌ **No access controls** (single-user, but no role-based permissions)
- ❌ **No encrypted backups** (data copies unprotected)
- ❌ **No breach detection** (no monitoring for unauthorized access)
- ❌ **Weak secrets management** (JWT secret has hardcoded fallback)
- ❌ **Permissive CORS** (allows all local network)

---

## HIPAA Technical Safeguards (45 CFR § 164.312)

### Required (R) vs. Addressable (A)

| Safeguard | Status | Priority |
|-----------|--------|----------|
| Access Control (R) | ⚠️ Partial | Critical |
| Audit Controls (R) | ❌ Missing | Critical |
| Integrity (R) | ⚠️ Partial | High |
| Person/Entity Authentication (R) | ✅ Done | - |
| Transmission Security (A) | ❌ Missing | Critical |

---

## Implementation Roadmap

### Phase 1: Critical Security Hardening (Week 1-2)
**Goal:** Make the app safe for multi-user deployment

#### 1.1 Database Encryption at Rest
**Priority:** Critical  
**Effort:** Medium  
**Dependencies:** None

**Current:** SQLite database stores all PHI in plaintext at `data/health.db`

**Solution:** SQLCipher (FIPS 140-2 compliant encryption)

```bash
npm install @journeyapps/sqlcipher
```

**Implementation:**
```javascript
// server/db.js
import Database from '@journeyapps/sqlcipher';

const dbPath = join(dataDir, 'health.db');
db = new Database(dbPath);

// Set encryption key (from environment variable)
const DB_KEY = process.env.DB_ENCRYPTION_KEY;
if (!DB_KEY) {
  throw new Error('DB_ENCRYPTION_KEY environment variable required');
}

db.pragma(`key = '${DB_KEY}'`);
db.pragma('cipher_compatibility = 4'); // SQLCipher 4.x
```

**Migration Strategy:**
1. Export existing SQLite data to JSON
2. Create new encrypted database
3. Import data into encrypted DB
4. Securely delete old plaintext DB

**Environment:**
```bash
# .env
DB_ENCRYPTION_KEY=<generate 64-char hex key>
```

**Key Generation:**
```bash
openssl rand -hex 32
```

**Risks Addressed:**
- ✅ PHI exposure if database file stolen
- ✅ Compliance with HIPAA encryption at rest requirement

---

#### 1.2 HTTPS/TLS Transport Encryption
**Priority:** Critical  
**Effort:** Low  
**Dependencies:** None

**Current:** HTTP only (plaintext transmission)

**Solution:** Self-signed certificates for development, Let's Encrypt for production

**Development (Self-Signed):**
```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

```javascript
// server/index.js
import https from 'https';
import fs from 'fs';

const httpsOptions = {
  key: fs.readFileSync('./key.pem'),
  cert: fs.readFileSync('./cert.pem')
};

https.createServer(httpsOptions, app).listen(3000, () => {
  console.log('🔒 HTTPS server running on port 3000');
});
```

**Production (Let's Encrypt):**
```bash
# Install certbot
sudo apt-get install certbot

# Get certificate (requires domain name)
sudo certbot certonly --standalone -d yourdomain.com
```

**Configuration:**
```javascript
const httpsOptions = {
  key: fs.readFileSync('/etc/letsencrypt/live/yourdomain.com/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/yourdomain.com/fullchain.pem')
};
```

**Update Vite Config:**
```javascript
// vite.config.js
export default defineConfig({
  server: {
    https: true, // Enable HTTPS in dev
    proxy: {
      '/api': {
        target: 'https://localhost:3000',
        secure: false, // Allow self-signed in dev
      }
    }
  }
});
```

**Cookie Security:**
```javascript
// server/auth.js
res.cookie('auth_token', token, { 
  httpOnly: true, 
  secure: true, // HTTPS only
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000 
});
```

**Risks Addressed:**
- ✅ Man-in-the-middle attacks
- ✅ Credentials transmitted in plaintext
- ✅ Session hijacking

---

#### 1.3 Audit Logging (HIPAA Required)
**Priority:** Critical  
**Effort:** High  
**Dependencies:** Database schema update

**Current:** No access logs, no integrity monitoring

**HIPAA Requirements (§164.312(b)):**
- Record and examine activity in systems containing ePHI
- Log: who, what, when, where
- Retention: 6 years minimum
- Tamper-proof (append-only)

**Database Schema:**
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

-- Prevent tampering: no updates or deletes allowed
CREATE TRIGGER prevent_audit_update 
  BEFORE UPDATE ON audit_log
  BEGIN
    SELECT RAISE(ABORT, 'Audit logs are immutable');
  END;

CREATE TRIGGER prevent_audit_delete
  BEFORE DELETE ON audit_log
  BEGIN
    SELECT RAISE(ABORT, 'Audit logs cannot be deleted');
  END;
```

**Audit Middleware:**
```javascript
// server/audit.js
import { run } from './db.js';

export function logAudit(userId, username, action, resourceType, resourceId, status, details, req) {
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('user-agent');
  
  run(`
    INSERT INTO audit_log (user_id, username, action, resource_type, resource_id, ip_address, user_agent, status, details)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [userId, username, action, resourceType, resourceId, ip, userAgent, status, JSON.stringify(details)]);
}

// Middleware to auto-log all API requests
export function auditMiddleware(req, res, next) {
  if (!req.user) return next(); // Skip unauthenticated requests
  
  // Capture original res.json to log after response
  const originalJson = res.json.bind(res);
  
  res.json = (data) => {
    const action = req.method === 'GET' ? 'view' : 
                   req.method === 'POST' ? 'create' :
                   req.method === 'PUT' ? 'update' :
                   req.method === 'DELETE' ? 'delete' : 'unknown';
    
    const resourceType = req.path.split('/')[2] || 'unknown'; // e.g., /api/medications -> medications
    const resourceId = req.params.id || null;
    const status = res.statusCode < 400 ? 'success' : 'failure';
    
    logAudit(req.user.userId, req.user.username, action, resourceType, resourceId, status, { path: req.path }, req);
    
    return originalJson(data);
  };
  
  next();
}
```

**Apply to all protected routes:**
```javascript
// server/index.js
import { auditMiddleware } from './audit.js';

app.use('/api', requireAuth, auditMiddleware); // Log all API activity
```

**Audit Log Viewer (Admin UI):**
```javascript
// GET /api/audit/logs (admin only)
app.get('/api/audit/logs', requireAuth, (req, res) => {
  const { limit = 100, offset = 0, user, action, resource } = req.query;
  
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
  
  sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  
  const logs = query(sql, params);
  res.json(logs);
});
```

**Risks Addressed:**
- ✅ No forensic trail for unauthorized access
- ✅ HIPAA audit control requirement
- ✅ Breach investigation capability

---

#### 1.4 Session Timeouts & Inactivity Lockout
**Priority:** High  
**Effort:** Low  
**Dependencies:** None

**Current:** 7-day JWT expiry, no inactivity timeout

**HIPAA Best Practice:** 15-minute inactivity timeout

**Implementation:**
```javascript
// server/auth.js
const TOKEN_EXPIRY = '15m'; // 15 minutes (vs. current 7d)

// Client-side activity tracking
// src/utils/sessionMonitor.js
let activityTimer;
const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes

function resetActivityTimer() {
  clearTimeout(activityTimer);
  
  activityTimer = setTimeout(() => {
    // Auto-logout on inactivity
    fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login?reason=inactivity';
  }, INACTIVITY_TIMEOUT);
}

// Track user activity
['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
  document.addEventListener(event, resetActivityTimer, true);
});

resetActivityTimer(); // Start timer on page load
```

**Token Refresh Strategy:**
```javascript
// Refresh token before expiry (every 10 minutes)
setInterval(async () => {
  const response = await fetch('/api/auth/refresh', { method: 'POST' });
  if (!response.ok) {
    window.location.href = '/login?reason=session_expired';
  }
}, 10 * 60 * 1000);
```

**Risks Addressed:**
- ✅ Abandoned sessions exposing PHI
- ✅ HIPAA automatic logoff requirement

---

#### 1.5 Strong Secrets Management
**Priority:** High  
**Effort:** Low  
**Dependencies:** None

**Current:** Hardcoded JWT secret fallback (`'medical-tracker-secret-change-in-production'`)

**Solution:** Environment variables + validation

```javascript
// server/auth.js
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

if (JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}
```

**Generate Strong Secret:**
```bash
openssl rand -base64 64
```

**Environment:**
```bash
# .env
JWT_SECRET=<64-char random base64 string>
DB_ENCRYPTION_KEY=<64-char hex string>
MASTER_PASSWORD_SALT=<32-char hex string> # For vault
```

**Risks Addressed:**
- ✅ JWT forgery with known secret
- ✅ Session hijacking

---

#### 1.6 CORS Hardening
**Priority:** Medium  
**Effort:** Low  
**Dependencies:** None

**Current:** Allows all local network IPs (`192.168.*`, `10.0.*`, `172.*`)

**Solution:** Whitelist specific origins

```javascript
// server/index.js
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [
  'https://localhost:5173',
  'https://localhost:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true
}));
```

**Environment:**
```bash
# .env
ALLOWED_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com
```

**Risks Addressed:**
- ✅ CSRF attacks from malicious sites
- ✅ Unauthorized API access from local network

---

### Phase 2: Access Control & Authorization (Week 3-4)
**Goal:** Multi-user support with role-based permissions

#### 2.1 Role-Based Access Control (RBAC)
**Priority:** High (for multi-user deployment)  
**Effort:** High  
**Dependencies:** Phase 1 complete

**Roles:**
- **Patient**: View own records, update profile, search research
- **Provider**: View assigned patients, add notes, order tests
- **Admin**: Full access, user management, audit logs
- **Guest**: Read-only (for second opinions)

**Database Schema:**
```sql
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL, -- 'patient', 'provider', 'admin', 'guest'
  description TEXT
);

CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resource TEXT NOT NULL, -- 'patient_profile', 'medications', 'audit_log'
  action TEXT NOT NULL, -- 'view', 'create', 'update', 'delete'
  UNIQUE(resource, action)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER NOT NULL,
  permission_id INTEGER NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id),
  FOREIGN KEY (permission_id) REFERENCES permissions(id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER NOT NULL,
  role_id INTEGER NOT NULL,
  granted_by INTEGER, -- User who granted this role
  granted_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (role_id) REFERENCES roles(id),
  FOREIGN KEY (granted_by) REFERENCES users(id)
);
```

**Permission Middleware:**
```javascript
// server/permissions.js
export function requirePermission(resource, action) {
  return (req, res, next) => {
    const userId = req.user.userId;
    
    const hasPermission = query(`
      SELECT COUNT(*) as count
      FROM user_roles ur
      JOIN role_permissions rp ON ur.role_id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE ur.user_id = ?
        AND p.resource = ?
        AND p.action = ?
    `, [userId, resource, action]);
    
    if (hasPermission[0].count > 0) {
      next();
    } else {
      res.status(403).json({ error: 'Insufficient permissions' });
    }
  };
}
```

**Usage:**
```javascript
// server/index.js
import { requirePermission } from './permissions.js';

app.get('/api/medications', requireAuth, requirePermission('medications', 'view'), (req, res) => {
  // ...
});

app.post('/api/medications', requireAuth, requirePermission('medications', 'create'), (req, res) => {
  // ...
});

app.delete('/api/audit/logs/:id', requireAuth, requirePermission('audit_log', 'delete'), (req, res) => {
  // Only admins should have this permission (typically never granted)
  res.status(403).json({ error: 'Audit logs cannot be deleted' });
});
```

---

#### 2.2 Multi-Tenancy (Patient Isolation)
**Priority:** High (for shared deployment)  
**Effort:** High  
**Dependencies:** RBAC implementation

**Current:** Single user system (patient_id = 1 hardcoded)

**Solution:** Patient-scoped data access

**Database Schema Updates:**
```sql
-- Add patient_id to all PHI tables
ALTER TABLE patient_profile ADD COLUMN user_id INTEGER REFERENCES users(id);
ALTER TABLE conditions ADD COLUMN patient_id INTEGER REFERENCES patient_profile(id);
ALTER TABLE medications ADD COLUMN patient_id INTEGER REFERENCES patient_profile(id);
ALTER TABLE vitals ADD COLUMN patient_id INTEGER REFERENCES patient_profile(id);
-- etc. for all PHI tables

-- Row-level security via views (SQLite doesn't have native RLS)
CREATE VIEW my_medications AS
  SELECT * FROM medications
  WHERE patient_id = (
    SELECT id FROM patient_profile WHERE user_id = <current_user_id>
  );
```

**Middleware:**
```javascript
// server/tenancy.js
export function scopeToPatient(req, res, next) {
  const userId = req.user.userId;
  
  // Get patient_id for this user
  const patient = query('SELECT id FROM patient_profile WHERE user_id = ?', [userId]);
  
  if (patient.length === 0) {
    return res.status(404).json({ error: 'No patient profile found' });
  }
  
  req.patientId = patient[0].id;
  next();
}
```

**Query Scoping:**
```javascript
// Before: SELECT * FROM medications
// After: 
app.get('/api/medications', requireAuth, scopeToPatient, (req, res) => {
  const medications = query('SELECT * FROM medications WHERE patient_id = ?', [req.patientId]);
  res.json(medications);
});
```

---

### Phase 3: Data Integrity & Backup (Week 5-6)
**Goal:** Prevent data loss and ensure recoverability

#### 3.1 Encrypted Backups
**Priority:** High  
**Effort:** Medium  
**Dependencies:** Phase 1 (encryption at rest)

**Backup Strategy:**
- **Frequency:** Daily (automated)
- **Retention:** 30 days rolling
- **Encryption:** AES-256-GCM (separate key from DB encryption)
- **Storage:** Local + optional cloud (S3, B2, etc.)

**Implementation:**
```javascript
// server/backup.js
import { createCipheriv, randomBytes } from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

export async function createEncryptedBackup(dbPath, backupPath, encryptionKey) {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(encryptionKey, 'hex'), iv);
  
  const input = createReadStream(dbPath);
  const output = createWriteStream(backupPath);
  
  // Prepend IV to encrypted file
  output.write(iv);
  
  await pipeline(input, cipher, output);
  
  // Append auth tag
  const authTag = cipher.getAuthTag();
  output.write(authTag);
  
  console.log(`✅ Encrypted backup created: ${backupPath}`);
}

// Scheduled daily backup (cron or systemd timer)
import cron from 'node-cron';

cron.schedule('0 2 * * *', async () => { // 2 AM daily
  const timestamp = new Date().toISOString().split('T')[0];
  const backupPath = `./backups/health_${timestamp}.db.enc`;
  
  await createEncryptedBackup(
    './data/health.db',
    backupPath,
    process.env.BACKUP_ENCRYPTION_KEY
  );
  
  // Cleanup old backups (>30 days)
  cleanupOldBackups('./backups', 30);
});
```

**Restore Procedure:**
```javascript
export async function restoreEncryptedBackup(backupPath, dbPath, encryptionKey) {
  const input = createReadStream(backupPath);
  const output = createWriteStream(dbPath);
  
  // Read IV (first 16 bytes)
  const iv = await readBytes(input, 16);
  
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(encryptionKey, 'hex'), iv);
  
  await pipeline(input, decipher, output);
  
  console.log(`✅ Database restored from backup: ${backupPath}`);
}
```

---

#### 3.2 Data Integrity Monitoring
**Priority:** Medium  
**Effort:** Low  
**Dependencies:** None

**Implementation:**
```sql
-- Add checksums to critical tables
ALTER TABLE patient_profile ADD COLUMN data_hash TEXT;
ALTER TABLE medications ADD COLUMN data_hash TEXT;

-- Trigger to update hash on changes
CREATE TRIGGER update_medication_hash
  AFTER UPDATE ON medications
  FOR EACH ROW
  BEGIN
    UPDATE medications
    SET data_hash = sha256(name || dosage || frequency || updated_at)
    WHERE id = NEW.id;
  END;
```

**Verification:**
```javascript
// server/integrity.js
export function verifyDataIntegrity(tableName, recordId) {
  const record = query(`SELECT * FROM ${tableName} WHERE id = ?`, [recordId])[0];
  
  const computedHash = crypto.createHash('sha256')
    .update(JSON.stringify(record))
    .digest('hex');
  
  if (computedHash !== record.data_hash) {
    console.error(`⚠️ Data integrity violation detected in ${tableName} #${recordId}`);
    logAudit(0, 'system', 'integrity_violation', tableName, recordId, 'error', { expected: record.data_hash, actual: computedHash });
    return false;
  }
  
  return true;
}
```

---

### Phase 4: Breach Detection & Monitoring (Week 7-8)
**Goal:** Detect and respond to security incidents

#### 4.1 Intrusion Detection
**Priority:** Medium  
**Effort:** High  
**Dependencies:** Audit logging (Phase 1)

**Anomaly Detection Rules:**
- Failed login attempts (>5 in 10 minutes)
- Unusual access patterns (bulk downloads, off-hours access)
- Privilege escalation attempts
- Data export/deletion spikes

**Implementation:**
```javascript
// server/intrusion-detection.js
export function detectAnomalies() {
  // Failed login spike
  const failedLogins = query(`
    SELECT user_id, COUNT(*) as attempts
    FROM audit_log
    WHERE action = 'login' 
      AND status = 'failure'
      AND timestamp > datetime('now', '-10 minutes')
    GROUP BY user_id
    HAVING attempts > 5
  `);
  
  if (failedLogins.length > 0) {
    alertAdmin('Possible brute force attack detected', failedLogins);
    lockAccount(failedLogins[0].user_id);
  }
  
  // Bulk data access (>100 records in 1 minute)
  const bulkAccess = query(`
    SELECT user_id, COUNT(*) as record_count
    FROM audit_log
    WHERE action = 'view'
      AND timestamp > datetime('now', '-1 minute')
    GROUP BY user_id
    HAVING record_count > 100
  `);
  
  if (bulkAccess.length > 0) {
    alertAdmin('Unusual bulk data access detected', bulkAccess);
  }
}

// Run every 5 minutes
setInterval(detectAnomalies, 5 * 60 * 1000);
```

---

#### 4.2 Security Alerts & Notifications
**Priority:** Medium  
**Effort:** Low  
**Dependencies:** Intrusion detection

**Channels:**
- Email (critical)
- SMS (critical)
- Slack/Discord (warnings)
- OpenClaw notifications (info)

**Implementation:**
```javascript
// server/alerts.js
export async function alertAdmin(severity, message, details) {
  const alert = {
    severity, // 'critical', 'warning', 'info'
    message,
    details,
    timestamp: new Date().toISOString()
  };
  
  if (severity === 'critical') {
    // Send SMS via Twilio
    await sendSMS(process.env.ADMIN_PHONE, `🚨 SECURITY ALERT: ${message}`);
    
    // Send email
    await sendEmail(process.env.ADMIN_EMAIL, 'HIPAA Security Alert', JSON.stringify(alert, null, 2));
  }
  
  // Log to audit trail
  logAudit(0, 'system', 'security_alert', 'system', null, severity, alert);
  
  // OpenClaw notification
  if (process.env.OPENCLAW_CHANNEL) {
    // Use message tool to send to configured channel
  }
}
```

---

## Phase 5: Documentation & Policies (Week 9-10)
**Goal:** HIPAA documentation requirements

### Required Documents:
1. **Privacy Policy** (HIPAA Privacy Rule compliance)
2. **Security Policy** (Technical safeguards documentation)
3. **Breach Notification Procedure** (72-hour notification requirement)
4. **Business Associate Agreement (BAA)** template (if sharing with providers)
5. **Incident Response Plan**
6. **Risk Assessment Report**
7. **Training Materials** (for users with PHI access)

**Templates Location:** `docs/hipaa/`

---

## Deployment Checklist

### Pre-Deployment Security Audit
- [ ] All environment variables configured (no hardcoded secrets)
- [ ] HTTPS enabled with valid certificate
- [ ] Database encryption enabled (SQLCipher)
- [ ] Audit logging active
- [ ] Session timeouts configured (15 min inactivity)
- [ ] Automated backups scheduled + tested restore
- [ ] Intrusion detection rules active
- [ ] Security alerts configured (email/SMS)
- [ ] CORS whitelist configured (production origins only)
- [ ] Firewall rules configured (block all except 443)
- [ ] OS security patches applied
- [ ] Application dependencies updated (no critical CVEs)

### Compliance Verification
- [ ] Privacy Policy published + user consent flow
- [ ] BAA signed (if applicable)
- [ ] Risk assessment completed
- [ ] Incident response plan tested
- [ ] Admin training completed
- [ ] User documentation reviewed

---

## Risk Assessment Summary

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Database theft (plaintext PHI) | High | Critical | Phase 1.1 (SQLCipher) |
| Man-in-the-middle attack | High | Critical | Phase 1.2 (HTTPS) |
| Session hijacking | Medium | High | Phase 1.4 (timeouts) + 1.2 (secure cookies) |
| Unauthorized access (no audit trail) | Medium | High | Phase 1.3 (audit logging) |
| Data loss (no backups) | Medium | Critical | Phase 3.1 (encrypted backups) |
| Brute force login | Medium | Medium | Phase 4.1 (intrusion detection) |
| Insider threat (no RBAC) | Low | High | Phase 2.1 (RBAC) |
| Data breach (undetected) | Low | Critical | Phase 4.1 (monitoring) |

---

## Estimated Timeline & Budget

| Phase | Duration | Effort (hours) | Dependencies |
|-------|----------|----------------|--------------|
| Phase 1: Critical Security | 2 weeks | 40-60 | None |
| Phase 2: Access Control | 2 weeks | 60-80 | Phase 1 |
| Phase 3: Data Integrity | 2 weeks | 30-40 | Phase 1 |
| Phase 4: Monitoring | 2 weeks | 40-50 | Phase 1 |
| Phase 5: Documentation | 2 weeks | 20-30 | All phases |
| **Total** | **10 weeks** | **190-260 hours** | Sequential |

**Cost Estimate (if outsourced):**
- Developer rate: $100-150/hr
- Total: $19,000 - $39,000

**DIY Approach:**
- Work weekends/evenings: ~5-10 hours/week
- Timeline: 20-50 weeks (5-12 months)
- Cost: $0 (your time)

---

## Recommended Approach

**For Your Use Case ("proactive in case I decide to share"):**

### Minimum Viable HIPAA Compliance (MVP)
**Target: 4 weeks, ~80 hours**

**Must-Have (Phase 1 essentials):**
1. ✅ Database encryption (SQLCipher) - 12 hours
2. ✅ HTTPS/TLS - 4 hours
3. ✅ Audit logging (basic) - 16 hours
4. ✅ Session timeouts - 4 hours
5. ✅ Secrets management - 2 hours
6. ✅ CORS hardening - 2 hours
7. ✅ Encrypted backups (manual) - 8 hours
8. ✅ Privacy Policy + BAA template - 8 hours

**Defer for Now:**
- RBAC (only needed if multi-user)
- Intrusion detection (can use OS-level tools like fail2ban)
- Multi-tenancy (not needed for single-patient deployment)

**When to revisit:**
- Before sharing with anyone outside your household
- Before deploying to cloud/VPS
- Before giving provider access

---

## Next Steps

1. **Review this roadmap** - prioritize what matters most to you
2. **Environment setup** - generate secrets, configure .env
3. **Start with Phase 1.1** - database encryption (biggest risk)
4. **Test incrementally** - each phase should have verification steps
5. **Document as you go** - future you will thank present you

Want me to start implementing any of these phases now? I can:
- Set up SQLCipher database encryption
- Generate HTTPS certificates
- Implement audit logging
- Create the backup system
- Draft privacy policy template

Your call — what's the priority?
