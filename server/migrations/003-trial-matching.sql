-- Migration 003: Trial Matching Panel
-- Adds structured eligibility, fit scoring, and contact info to clinical_trials

ALTER TABLE clinical_trials ADD COLUMN sponsor TEXT;
ALTER TABLE clinical_trials ADD COLUMN primary_endpoint TEXT;
ALTER TABLE clinical_trials ADD COLUMN enrollment_target INTEGER;
ALTER TABLE clinical_trials ADD COLUMN estimated_completion TEXT;
ALTER TABLE clinical_trials ADD COLUMN contact_name TEXT;
ALTER TABLE clinical_trials ADD COLUMN contact_email TEXT;
ALTER TABLE clinical_trials ADD COLUMN contact_phone TEXT;

-- JSON blob of raw eligibility text (backup / display)
-- Format: { "inclusion": ["18+ years", "FGFR3 mutation confirmed", ...], "exclusion": [...] }
ALTER TABLE clinical_trials ADD COLUMN eligibility_json TEXT;

-- John's fit assessment (0-100)
ALTER TABLE clinical_trials ADD COLUMN john_fit_score INTEGER
  CHECK (john_fit_score BETWEEN 0 AND 100);

-- Notes on fit — specific lab values to check, questions to ask
ALTER TABLE clinical_trials ADD COLUMN john_fit_notes TEXT;

-- Workflow priority
ALTER TABLE clinical_trials ADD COLUMN priority TEXT DEFAULT 'watch'
  CHECK (priority IN ('apply-now','discuss-next-visit','watch','not-eligible','enrolled'));

-- When was this last reviewed/updated
ALTER TABLE clinical_trials ADD COLUMN last_reviewed TEXT;

-- Structured eligibility criteria (one row per criterion, with John's match status)
CREATE TABLE IF NOT EXISTS trial_eligibility (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  trial_id  INTEGER NOT NULL REFERENCES clinical_trials(id) ON DELETE CASCADE,
  type      TEXT    NOT NULL CHECK (type IN ('inclusion','exclusion')),
  criterion TEXT    NOT NULL,
  john_match TEXT DEFAULT 'unknown'
    CHECK (john_match IN ('yes','no','unknown','conditional')),
  match_note TEXT,
  -- Display order within type
  sort_order INTEGER DEFAULT 0
);

-- Trial-to-mutation links (for filtering by genomic target)
CREATE TABLE IF NOT EXISTS trial_mutations (
  trial_id      INTEGER NOT NULL REFERENCES clinical_trials(id) ON DELETE CASCADE,
  mutation_name TEXT    NOT NULL,
  PRIMARY KEY (trial_id, mutation_name)
);

CREATE INDEX IF NOT EXISTS idx_trial_eligibility_trial ON trial_eligibility(trial_id);
CREATE INDEX IF NOT EXISTS idx_trial_mutations_name ON trial_mutations(mutation_name);
CREATE INDEX IF NOT EXISTS idx_trials_priority ON clinical_trials(priority);
