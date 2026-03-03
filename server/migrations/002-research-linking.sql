-- Migration 002: Research Linking
-- Connects papers to medications, conditions, genomic mutations, and clinical trials

CREATE TABLE IF NOT EXISTS paper_medications (
  paper_id      INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  medication_id INTEGER NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  relationship  TEXT DEFAULT 'supports'
    CHECK (relationship IN ('supports','contradicts','mechanism','alternative','synergy','caution')),
  note          TEXT,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (paper_id, medication_id)
);

CREATE TABLE IF NOT EXISTS paper_conditions (
  paper_id     INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  condition_id INTEGER NOT NULL REFERENCES conditions(id) ON DELETE CASCADE,
  relationship TEXT DEFAULT 'relevant',
  created_at   TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (paper_id, condition_id)
);

-- Mutations stored by name (no FK — genomic data uses name strings)
CREATE TABLE IF NOT EXISTS paper_mutations (
  paper_id      INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  mutation_name TEXT    NOT NULL,
  relationship  TEXT    DEFAULT 'targeted'
    CHECK (relationship IN ('targeted','prognostic','mechanism','resistance','synthetic_lethal')),
  created_at    TEXT    DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (paper_id, mutation_name)
);

CREATE TABLE IF NOT EXISTS paper_trials (
  paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  trial_id INTEGER NOT NULL REFERENCES clinical_trials(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (paper_id, trial_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_paper_meds_med ON paper_medications(medication_id);
CREATE INDEX IF NOT EXISTS idx_paper_mutations_name ON paper_mutations(mutation_name);
CREATE INDEX IF NOT EXISTS idx_paper_conditions_cond ON paper_conditions(condition_id);
