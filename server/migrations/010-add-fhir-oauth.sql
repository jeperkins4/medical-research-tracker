-- FHIR OAuth State (temporary, for CSRF protection)
CREATE TABLE IF NOT EXISTS fhir_oauth_state (
  credential_id INTEGER PRIMARY KEY,
  state TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (credential_id) REFERENCES portal_credentials(id) ON DELETE CASCADE
);

-- FHIR Access/Refresh Tokens
CREATE TABLE IF NOT EXISTS fhir_tokens (
  credential_id INTEGER PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  patient_id TEXT NOT NULL,  -- FHIR Patient resource ID
  expires_at TEXT NOT NULL,
  scope TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (credential_id) REFERENCES portal_credentials(id) ON DELETE CASCADE
);

-- Index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_fhir_tokens_expires 
  ON fhir_tokens(expires_at);

-- Cleanup expired OAuth states (run periodically)
DELETE FROM fhir_oauth_state WHERE expires_at < datetime('now');
