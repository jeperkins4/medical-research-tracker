-- Migration 004: Survival Optimization Dashboard
-- Adds sleep logging, daily survival scoring, and symptom categorization

-- Sleep logs (missing from current schema — exercise_logs exists but not sleep)
CREATE TABLE IF NOT EXISTS sleep_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL UNIQUE,        -- YYYY-MM-DD
  hours       REAL,                        -- actual hours slept
  quality     INTEGER                      -- 1=poor, 5=excellent
    CHECK (quality BETWEEN 1 AND 5),
  disruptions INTEGER DEFAULT 0,           -- number of wake-ups
  notes       TEXT,
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Daily composite survival optimization score
-- Computed nightly or on-demand from nutrition/exercise/sleep/symptom data
CREATE TABLE IF NOT EXISTS daily_scores (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  date             TEXT    NOT NULL UNIQUE,  -- YYYY-MM-DD

  -- Component scores (0-100 each, NULL if data not available)
  nutrition_score  INTEGER CHECK (nutrition_score BETWEEN 0 AND 100),
  exercise_score   INTEGER CHECK (exercise_score BETWEEN 0 AND 100),
  sleep_score      INTEGER CHECK (sleep_score BETWEEN 0 AND 100),
  symptom_score    INTEGER CHECK (symptom_score BETWEEN 0 AND 100),
    -- symptom_score = 100 - (avg_severity * 10), so lower burden = higher score

  -- Composite weighted score
  survival_score   INTEGER CHECK (survival_score BETWEEN 0 AND 100),

  -- Weights (stored so they can be adjusted over time)
  nutrition_weight REAL DEFAULT 0.30,
  exercise_weight  REAL DEFAULT 0.25,
  sleep_weight     REAL DEFAULT 0.25,
  symptom_weight   REAL DEFAULT 0.20,

  -- Raw inputs used for this computation (JSON snapshot for debugging)
  inputs_json      TEXT,

  notes            TEXT,
  computed_at      TEXT DEFAULT CURRENT_TIMESTAMP,
  created_at       TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Extend symptoms with oncology-specific categorization
-- (ALTER TABLE — nullable columns, safe on existing data)
ALTER TABLE symptoms ADD COLUMN category TEXT DEFAULT 'general'
  CHECK (category IN ('treatment-side-effect','cancer-related','comorbidity','general'));

ALTER TABLE symptoms ADD COLUMN treatment_related INTEGER DEFAULT 0;
  -- 1 = caused/worsened by current treatment

CREATE INDEX IF NOT EXISTS idx_sleep_logs_date ON sleep_logs(date);
CREATE INDEX IF NOT EXISTS idx_daily_scores_date ON daily_scores(date);
CREATE INDEX IF NOT EXISTS idx_symptoms_category ON symptoms(category);
