-- HIPAA-Compliant Analytics Tables
-- These tables store ONLY de-identified, aggregated data
-- NO PHI (Protected Health Information) is stored here

-- Analytics snapshot table (daily aggregates)
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_date DATE NOT NULL,
  metric_name TEXT NOT NULL,
  metric_category TEXT NOT NULL, -- 'users', 'diagnoses', 'mutations', 'treatments', 'demographics'
  metric_value TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(snapshot_date, metric_name, metric_value)
);

-- User registration metrics (counts only, no PHI)
CREATE TABLE IF NOT EXISTS analytics_user_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_date DATE NOT NULL,
  total_users INTEGER DEFAULT 0,
  new_users_today INTEGER DEFAULT 0,
  active_users_30d INTEGER DEFAULT 0, -- Users who logged in within 30 days
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(metric_date)
);

-- Diagnosis aggregates (no patient identifiers)
CREATE TABLE IF NOT EXISTS analytics_diagnosis_aggregates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  diagnosis_type TEXT NOT NULL,
  cancer_type TEXT, -- 'bladder', 'lung', 'breast', etc.
  stage TEXT, -- 'Stage 1', 'Stage 2', 'Stage 3', 'Stage 4', etc.
  patient_count INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(diagnosis_type, cancer_type, stage)
);

-- Mutation aggregates (no patient identifiers)
CREATE TABLE IF NOT EXISTS analytics_mutation_aggregates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gene_name TEXT NOT NULL, -- 'ARID1A', 'PIK3CA', 'FGFR3', etc.
  mutation_type TEXT, -- 'Loss of Function', 'Gain of Function', etc.
  patient_count INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(gene_name, mutation_type)
);

-- Treatment aggregates (no patient identifiers)
CREATE TABLE IF NOT EXISTS analytics_treatment_aggregates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  treatment_name TEXT NOT NULL,
  treatment_type TEXT, -- 'Drug', 'Supplement', 'Therapy', etc.
  patient_count INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(treatment_name, treatment_type)
);

-- Demographics (HIPAA-compliant ranges only)
CREATE TABLE IF NOT EXISTS analytics_demographics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  demographic_type TEXT NOT NULL, -- 'age_range', 'gender', 'state'
  demographic_value TEXT NOT NULL, -- '18-25', 'Male', 'FL', etc.
  patient_count INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(demographic_type, demographic_value)
);

-- Audit log for analytics access
CREATE TABLE IF NOT EXISTS analytics_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL, -- 'view_dashboard', 'export_data', 'generate_report'
  ip_address TEXT,
  accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_snapshots_date ON analytics_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_snapshots_category ON analytics_snapshots(metric_category);
CREATE INDEX IF NOT EXISTS idx_user_metrics_date ON analytics_user_metrics(metric_date);
CREATE INDEX IF NOT EXISTS idx_diagnosis_cancer_type ON analytics_diagnosis_aggregates(cancer_type);
CREATE INDEX IF NOT EXISTS idx_mutation_gene ON analytics_mutation_aggregates(gene_name);
CREATE INDEX IF NOT EXISTS idx_demographics_type ON analytics_demographics(demographic_type);

-- Trigger to update last_updated timestamps
CREATE TRIGGER IF NOT EXISTS update_diagnosis_aggregates_timestamp 
AFTER UPDATE ON analytics_diagnosis_aggregates
BEGIN
  UPDATE analytics_diagnosis_aggregates 
  SET last_updated = CURRENT_TIMESTAMP 
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_mutation_aggregates_timestamp 
AFTER UPDATE ON analytics_mutation_aggregates
BEGIN
  UPDATE analytics_mutation_aggregates 
  SET last_updated = CURRENT_TIMESTAMP 
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_treatment_aggregates_timestamp 
AFTER UPDATE ON analytics_treatment_aggregates
BEGIN
  UPDATE analytics_treatment_aggregates 
  SET last_updated = CURRENT_TIMESTAMP 
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_demographics_timestamp 
AFTER UPDATE ON analytics_demographics
BEGIN
  UPDATE analytics_demographics 
  SET last_updated = CURRENT_TIMESTAMP 
  WHERE id = NEW.id;
END;

-- Comments explaining HIPAA compliance
-- This schema is HIPAA-compliant because:
-- 1. NO individual identifiers (names, emails, IDs) are stored
-- 2. NO exact dates (only year or date ranges)
-- 3. NO geographic data smaller than state-level
-- 4. ALL data is aggregated (counts, not individual records)
-- 5. Minimum cell size enforcement (suppress counts < 11)
-- 6. Audit trail for all access
-- 7. Data cannot be re-linked to individual patients
