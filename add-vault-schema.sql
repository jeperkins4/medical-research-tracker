-- Secure credential vault for healthcare portal integration

-- Master password verification (PBKDF2 hash)
CREATE TABLE IF NOT EXISTS vault_master (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  iterations INTEGER DEFAULT 100000,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Encrypted portal credentials
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

-- Sync history log
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

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_portal_credentials_type ON portal_credentials(portal_type);
CREATE INDEX IF NOT EXISTS idx_sync_log_credential ON portal_sync_log(credential_id);
