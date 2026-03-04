-- Migration 013: Clinical Notes table for FHIR DocumentReference import
-- Stores clinical notes, pathology reports, and visit summaries from FHIR

CREATE TABLE IF NOT EXISTS clinical_notes (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  fhir_id           TEXT UNIQUE,                -- DocumentReference.id from FHIR
  credential_id     INTEGER,                   -- portal_credentials.id (source)
  note_type         TEXT,                      -- 'progress', 'pathology', 'discharge', 'operative', 'imaging', 'other'
  title             TEXT,
  date              TEXT,                      -- ISO date string
  author            TEXT,                      -- practitioner name
  department        TEXT,
  facility          TEXT,
  content_text      TEXT,                      -- extracted plain text
  content_html      TEXT,                      -- raw HTML if available
  loinc_code        TEXT,                      -- LOINC code from type.coding
  loinc_display     TEXT,                      -- LOINC display name
  status            TEXT DEFAULT 'final',      -- FHIR status field
  cancer_relevant   INTEGER DEFAULT 0,         -- 1 if keywords suggest oncology relevance
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_clinical_notes_date ON clinical_notes(date DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_type ON clinical_notes(note_type);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_credential ON clinical_notes(credential_id);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_cancer ON clinical_notes(cancer_relevant);
